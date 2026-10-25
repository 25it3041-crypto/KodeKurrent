import { useEffect, useRef, useCallback } from 'react';
import useStore from '../lib/store';

/**
 * useMotionAnalysis — HTML5 Canvas frame differencing for head/neck motion detection.
 * 
 * Approach:
 *  - Captures webcam frames at ~10 fps to a hidden canvas
 *  - Computes pixel-level diff between frames to detect rapid movement
 *  - Segments the upper third of the frame (head/neck region) separately
 *  - High-motion frames in that region trigger a logged proctoring event
 *  - Returns a ref to attach to an existing <video> element
 */
export function useMotionAnalysis(videoRef, enabled = true) {
  const canvasRef = useRef(null);
  const prevFrameRef = useRef(null);
  const animFrameRef = useRef(null);
  const lastEventRef = useRef({});
  const motionScoreRef = useRef(0);
  const addProctorEvent = useStore(s => s.addProctorEvent);
  const addMotionEvent = useStore(s => s.addMotionEvent);
  const deductTrust = useStore(s => s.deductTrust);

  // Thresholds (tunable)
  const MOTION_THRESHOLD = 18;        // pixel diff to count as "moved"
  const NECK_REGION_FRACTION = 0.40;  // top 40% of frame = head/neck
  const HIGH_MOTION_PIXELS_RATIO = 0.055; // >5.5% active pixels = rapid motion
  const GAZE_DEVIATION_RATIO = 0.030;     // >3% pixels in top region = gaze deviation
  const EVENT_COOLDOWN_MS = 2500;     // don't spam events

  const analyzeFrame = useCallback(() => {
    if (!enabled) return;
    const video = videoRef?.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const W = canvas.width;
    const H = canvas.height;

    // Draw current frame
    ctx.drawImage(video, 0, 0, W, H);
    const currentFrame = ctx.getImageData(0, 0, W, H);

    if (!prevFrameRef.current) {
      prevFrameRef.current = currentFrame;
      return;
    }

    const prev = prevFrameRef.current.data;
    const curr = currentFrame.data;
    const totalPixels = W * H;
    const neckBoundary = Math.floor(H * NECK_REGION_FRACTION) * W; // pixel index boundary

    let totalMotionPixels = 0;
    let neckMotionPixels = 0;
    const motionMap = new Uint8Array(totalPixels); // 1 if pixel moved

    for (let i = 0; i < totalPixels; i++) {
      const pi = i * 4;
      const dr = Math.abs(curr[pi]     - prev[pi]);
      const dg = Math.abs(curr[pi + 1] - prev[pi + 1]);
      const db = Math.abs(curr[pi + 2] - prev[pi + 2]);
      const diff = (dr + dg + db) / 3;

      if (diff > MOTION_THRESHOLD) {
        motionMap[i] = 1;
        totalMotionPixels++;
        if (i < neckBoundary) neckMotionPixels++;
      }
    }

    const motionRatio = totalMotionPixels / totalPixels;
    const neckMotionRatio = neckMotionPixels / neckBoundary;

    // Update rolling motion score (exponential moving average)
    motionScoreRef.current = motionScoreRef.current * 0.7 + motionRatio * 0.3;

    const now = Date.now();

    // ── High overall motion (rapid body movement) ──
    if (
      motionRatio > HIGH_MOTION_PIXELS_RATIO &&
      (!lastEventRef.current.body || now - lastEventRef.current.body > EVENT_COOLDOWN_MS)
    ) {
      lastEventRef.current.body = now;
      const intensity = motionRatio > 0.12 ? 'EXTREME' : motionRatio > 0.08 ? 'HIGH' : 'MODERATE';
      const event = {
        type: 'rapid_body_motion',
        severity: intensity === 'EXTREME' ? 'critical' : intensity === 'HIGH' ? 'high' : 'medium',
        motionRatio: +(motionRatio * 100).toFixed(1),
        label: `Rapid body movement detected (${intensity})`,
      };
      addProctorEvent(event);
      addMotionEvent({ ...event, neckRatio: +(neckMotionRatio * 100).toFixed(1) });
      if (intensity === 'HIGH' || intensity === 'EXTREME') {
        deductTrust(intensity === 'EXTREME' ? 8 : 4, `Rapid body motion (${intensity})`);
      }
    }

    // ── Head/Neck region high motion (gaze deviation / head turn) ──
    if (
      neckMotionRatio > GAZE_DEVIATION_RATIO &&
      motionRatio < HIGH_MOTION_PIXELS_RATIO * 1.5 && // not whole-body (that's handled above)
      (!lastEventRef.current.neck || now - lastEventRef.current.neck > EVENT_COOLDOWN_MS)
    ) {
      lastEventRef.current.neck = now;
      const event = {
        type: 'head_neck_movement',
        severity: neckMotionRatio > 0.07 ? 'high' : 'medium',
        neckMotionRatio: +(neckMotionRatio * 100).toFixed(1),
        label: `Head/neck movement detected (${(neckMotionRatio * 100).toFixed(1)}% region active)`,
      };
      addProctorEvent(event);
      addMotionEvent({ ...event, totalRatio: +(motionRatio * 100).toFixed(1) });
      if (neckMotionRatio > 0.07) {
        deductTrust(3, 'Repeated head/neck movement (possible gaze deviation)');
      }
    }

    // ── Gaze deviation: motion concentrated at frame edges (looking off-screen) ──
    // Check left/right edge columns (outer 15%)
    const edgeW = Math.floor(W * 0.15);
    let edgeMotionPixels = 0;
    for (let row = 0; row < Math.floor(H * NECK_REGION_FRACTION); row++) {
      for (let col = 0; col < edgeW; col++) {
        if (motionMap[row * W + col] || motionMap[row * W + (W - 1 - col)]) edgeMotionPixels++;
      }
    }
    const edgeRatio = edgeMotionPixels / (2 * edgeW * Math.floor(H * NECK_REGION_FRACTION));
    if (
      edgeRatio > 0.08 &&
      (!lastEventRef.current.gaze || now - lastEventRef.current.gaze > EVENT_COOLDOWN_MS * 1.5)
    ) {
      lastEventRef.current.gaze = now;
      const event = {
        type: 'gaze_deviation',
        severity: 'medium',
        edgeRatio: +(edgeRatio * 100).toFixed(1),
        label: 'Gaze deviation — eyes/head looking off-screen',
      };
      addProctorEvent(event);
      addMotionEvent(event);
      deductTrust(2, 'Gaze deviation detected');
    }

    prevFrameRef.current = currentFrame;
  }, [enabled, videoRef, addProctorEvent, addMotionEvent, deductTrust]);

  // Run analysis loop at ~10 fps
  useEffect(() => {
    if (!enabled) return;

    // Create hidden canvas for frame processing
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
      canvasRef.current.width = 160;  // Low-res for performance
      canvasRef.current.height = 90;
    }

    let lastTime = 0;
    const TARGET_FPS = 10;
    const FRAME_INTERVAL = 1000 / TARGET_FPS;

    const loop = (timestamp) => {
      if (timestamp - lastTime >= FRAME_INTERVAL) {
        analyzeFrame();
        lastTime = timestamp;
      }
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [enabled, analyzeFrame]);

  // Return motion score for real-time display
  const getMotionScore = useCallback(() => motionScoreRef.current, []);

  return { getMotionScore };
}
