import { useEffect, useRef, useCallback } from 'react';
import useStore from '../lib/store';

export function useProctoring(videoRef, enabled = true) {
  const deductTrust = useStore(s => s.deductTrust);
  const addProctorEvent = useStore(s => s.addProctorEvent);
  const addGazePoint = useStore(s => s.addGazePoint);
  const trustScore = useStore(s => s.trustScore);
  
  const tabSwitchCountRef = useRef(0);
  const lastEventRef = useRef({});

  // ── 1. Tab visibility & Focus Loss ─────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        tabSwitchCountRef.current++;
        const deduction = Math.min(10, 3 + tabSwitchCountRef.current);
        deductTrust(deduction, `Tab switched (${tabSwitchCountRef.current}x)`);
        addProctorEvent({
          type: 'tab_switch',
          eventType: 'tab_switch',
          label: 'Tab switched during interview',
          count: tabSwitchCountRef.current,
          severity: 'high',
          evidence: `Tab switch #${tabSwitchCountRef.current}`,
        });
      }
    };

    const handleBlur = () => {
      if (!document.hidden) {
        const now = Date.now();
        if (!lastEventRef.current.focus || now - lastEventRef.current.focus > 5000) {
          deductTrust(5, 'Window focus lost');
          addProctorEvent({
            type: 'focus_loss',
            eventType: 'focus_loss',
            label: 'Window focus lost',
            severity: 'medium',
            evidence: 'Primary window lost focus',
          });
        }
        lastEventRef.current.focus = now;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, [enabled, deductTrust, addProctorEvent]);

  // ── 2. Copy-paste & Context Menu Guard ──────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        deductTrust(5, 'Copy attempted (Ctrl+C)');
        addProctorEvent({
          type: 'copy_attempt',
          eventType: 'copy_attempt',
          label: 'Copy keyboard shortcut used',
          severity: 'medium',
          evidence: 'Ctrl/Cmd+C intercepted',
        });
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        deductTrust(8, 'Paste attempted (Ctrl+V)');
        addProctorEvent({
          type: 'paste_attempt',
          eventType: 'paste_attempt',
          label: 'Paste keyboard shortcut used',
          severity: 'high',
          evidence: 'Ctrl/Cmd+V intercepted',
        });
      }
    };

    const handleContextMenu = (e) => {
      e.preventDefault();
      deductTrust(2, 'Right-click blocked');
      addProctorEvent({
        type: 'right_click',
        eventType: 'right_click',
        label: 'Right-click context menu opened',
        severity: 'low',
        evidence: 'Context menu blocked',
      });
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [enabled, deductTrust, addProctorEvent]);

  // ── 3. Mouse Gaze Tracking ──────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;
    
    const handleMouseMove = (e) => {
      const x = (e.clientX / window.innerWidth) * 100;
      const y = (e.clientY / window.innerHeight) * 100;
      addGazePoint({ x, y });

      if (x < 5 || x > 95 || y < 5 || y > 95) {
        const now = Date.now();
        if (!lastEventRef.current.edge || now - lastEventRef.current.edge > 3000) {
          addProctorEvent({
            type: 'gaze_deviation',
            eventType: 'gaze_deviation',
            label: 'Looking off-screen / gaze deviation',
            severity: 'low',
            x, y,
            evidence: `Pointer at edge (${Math.round(x)}%, ${Math.round(y)}%)`,
          });
          lastEventRef.current.edge = now;
        }
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [enabled, addGazePoint, addProctorEvent]);

  // ── 4. WebRTC Audio Analyzer (Multiple Voices & Noise Detection) ───────────
  useEffect(() => {
    if (!enabled) return;

    let audioContext;
    let analyser;
    let intervalId;
    let pollId;
    let attachedStreamId = null;

    const attach = async () => {
      const stream = videoRef?.current?.srcObject;
      if (!stream || attachedStreamId === stream.id) return;
      attachedStreamId = stream.id;

      try {
        if (audioContext) {
          await audioContext.close().catch(() => {});
          audioContext = null;
        }
        const audioTracks = stream.getAudioTracks();
        if (!audioTracks.length) return;

        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        if (audioContext.state === 'suspended') {
          await audioContext.resume().catch(() => {});
        }
        const source = audioContext.createMediaStreamSource(stream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        if (intervalId) clearInterval(intervalId);
        intervalId = setInterval(() => {
          if (!analyser) return;
          analyser.getByteFrequencyData(dataArray);
          const avgVolume = dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length;
          if (avgVolume > 60) {
            const now = Date.now();
            if (!lastEventRef.current.voice || now - lastEventRef.current.voice > 6000) {
              deductTrust(10, 'Multiple voices / background audio detected');
              addProctorEvent({
                type: 'MULTIPLE_VOICES',
                eventType: 'MULTIPLE_VOICES',
                label: 'Multiple voices or heavy background noise detected',
                severity: 'medium',
                volume: Math.round(avgVolume),
                evidence: `Avg volume ${Math.round(avgVolume)}`,
              });
              lastEventRef.current.voice = now;
            }
          }
        }, 2000);
      } catch (err) {
        console.warn('[Audio Proctoring Error]:', err);
      }
    };

    pollId = setInterval(attach, 1000);
    attach();

    return () => {
      if (pollId) clearInterval(pollId);
      if (intervalId) clearInterval(intervalId);
      if (audioContext) audioContext.close().catch(() => {});
    };
  }, [enabled, videoRef, deductTrust, addProctorEvent]);

  // ── 5. Video Frame Face & Motion Detection ─────────────────────────────────
  const analyzeFrame = useCallback(() => {
    if (!videoRef?.current || !enabled) return;

    try {
      const video = videoRef.current;
      if (video.readyState < 2) return; // Wait for video metadata

      // Canvas element to process video frames
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 120;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const frameData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      
      // Skin tone pixel detection heuristic
      let skinPixels = 0;
      let totalPixels = frameData.length / 4;

      for (let i = 0; i < frameData.length; i += 4) {
        const r = frameData[i];
        const g = frameData[i + 1];
        const b = frameData[i + 2];

        // Skin tone RGB thresholds
        if (r > 95 && g > 40 && b > 20 && r > g && r > b && Math.abs(r - g) > 15) {
          skinPixels++;
        }
      }

      const skinRatio = skinPixels / totalPixels;

      // Rough left/right skin balance as a head-pose / gaze indicator
      let leftSkin = 0;
      let rightSkin = 0;
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const i = (y * canvas.width + x) * 4;
          const r = frameData[i];
          const g = frameData[i + 1];
          const b = frameData[i + 2];
          if (r > 95 && g > 40 && b > 20 && r > g && r > b && Math.abs(r - g) > 15) {
            if (x < canvas.width / 2) leftSkin++;
            else rightSkin++;
          }
        }
      }
      const poseBias = (rightSkin - leftSkin) / Math.max(1, leftSkin + rightSkin);

      if (skinRatio > 0.45) {
        const now = Date.now();
        if (!lastEventRef.current.multiFace || now - lastEventRef.current.multiFace > 8000) {
          deductTrust(15, 'Multiple persons detected in camera frame');
          addProctorEvent({
            type: 'MULTIPLE_PERSONS',
            eventType: 'MULTIPLE_PERSONS',
            label: 'Multiple people / faces detected in video feed',
            severity: 'critical',
            skinRatio: Math.round(skinRatio * 100),
            evidence: `Skin coverage ${Math.round(skinRatio * 100)}%`,
          });
          lastEventRef.current.multiFace = now;
        }
      } else if (skinRatio < 0.03) {
        const now = Date.now();
        if (!lastEventRef.current.noFace || now - lastEventRef.current.noFace > 8000) {
          deductTrust(10, 'Candidate face not visible in video');
          addProctorEvent({
            type: 'NO_FACE_DETECTED',
            eventType: 'NO_FACE_DETECTED',
            label: 'No face detected in video feed',
            severity: 'medium',
            evidence: 'Face region below visibility threshold',
          });
          lastEventRef.current.noFace = now;
        }
      } else if (Math.abs(poseBias) > 0.45) {
        const now = Date.now();
        if (!lastEventRef.current.pose || now - lastEventRef.current.pose > 8000) {
          addProctorEvent({
            type: 'HEAD_POSE',
            eventType: 'HEAD_POSE',
            label: 'Head pose / gaze turned away from camera',
            severity: 'low',
            evidence: `Horizontal pose bias ${poseBias.toFixed(2)}`,
          });
          lastEventRef.current.pose = now;
        }
      }
    } catch (e) {
      // Ignore frame read errors
    }
  }, [videoRef, enabled, deductTrust, addProctorEvent]);

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => analyzeFrame(), 1500);
    return () => clearInterval(id);
  }, [enabled, analyzeFrame]);

  return { analyzeFrame };
}