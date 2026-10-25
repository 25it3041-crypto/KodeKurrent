import { useEffect, useRef, useCallback, useState } from 'react';
import { getSocket } from '../lib/socket';
import useStore from '../lib/store';

export function useWebRTC(sessionId) {
  const pcRef = useRef(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [connectionState, setConnectionState] = useState('idle');
  const setMobileConnected = useStore(s => s.setMobileConnected);
  const setMobileStream = useStore(s => s.setMobileStream);
  const addProctorEvent = useStore(s => s.addProctorEvent);

  const initPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });

    pc.ontrack = (event) => {
      const stream = event.streams[0];
      setRemoteStream(stream);
      setMobileStream(stream);
      setMobileConnected(true);
      setConnectionState('connected');
    };

    pc.onconnectionstatechange = () => {
      setConnectionState(pc.connectionState);
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setMobileConnected(false);
        setMobileStream(null);
        addProctorEvent({
          type: 'mobile_disconnected',
          eventType: 'MOBILE_DISCONNECTED',
          severity: 'warning',
          evidence: `WebRTC state ${pc.connectionState}`,
        });
      }
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        getSocket().emit('webrtc:ice', {
          sessionId, candidate: e.candidate, target: 'mobile',
        });
      }
    };

    pcRef.current = pc;
    return pc;
  }, [sessionId, setMobileConnected, setMobileStream, addProctorEvent]);

  useEffect(() => {
    if (!sessionId) return;
    const socket = getSocket();
    socket.emit('host:register', { sessionId });

    socket.on('mobile:connected', ({ mobileSocketId }) => {
      setConnectionState('mobile_joined');
    });

    socket.on('mobile:disconnected', ({ timestamp }) => {
      setMobileConnected(false);
      setConnectionState('disconnected');
      addProctorEvent({ type: 'mobile_disconnected', timestamp, severity: 'warning' });
    });

    socket.on('webrtc:offer', async ({ offer }) => {
      const pc = initPeerConnection();
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('webrtc:answer', { sessionId, answer });
      setConnectionState('answering');
    });

    socket.on('webrtc:ice', async ({ candidate }) => {
      if (pcRef.current && candidate) {
        try { await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate)); }
        catch (e) { console.warn('[ICE]', e); }
      }
    });

    return () => {
      socket.off('mobile:connected');
      socket.off('mobile:disconnected');
      socket.off('webrtc:offer');
      socket.off('webrtc:ice');
      if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
    };
  }, [sessionId, initPeerConnection, addProctorEvent, setMobileConnected]);

  return { remoteStream, connectionState };
}

// Mobile-side hook (for /mobile-cam page)
export function useMobileWebRTC(sessionId) {
  const pcRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState('idle');

  const start = useCallback(async () => {
    if (!sessionId) return;
    setStatus('acquiring_camera');
    
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
    } catch (e) {
      setStatus('camera_error');
      return;
    }

    const socket = getSocket();
    socket.emit('mobile:join', { sessionId });
    setStatus('joining');

    socket.on('mobile:joined', async () => {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          socket.emit('webrtc:ice', { sessionId, candidate: e.candidate, target: 'host' });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') { setConnected(true); setStatus('streaming'); }
        if (pc.connectionState === 'failed') { setStatus('failed'); setConnected(false); }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('webrtc:offer', { sessionId, offer });

      socket.on('webrtc:answer', async ({ answer }) => {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      });

      socket.on('webrtc:ice', async ({ candidate }) => {
        if (candidate) {
          try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); }
          catch (e) { console.warn('[Mobile ICE]', e); }
        }
      });

      pcRef.current = pc;
    });

    return stream;
  }, [sessionId]);

  return { start, connected, status };
}
