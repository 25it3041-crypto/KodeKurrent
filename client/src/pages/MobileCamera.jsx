import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Camera, Wifi, WifiOff, CheckCircle, AlertTriangle, Smartphone } from 'lucide-react';
import { useMobileWebRTC } from '../hooks/useWebRTC';

export default function MobileCamera() {
  const [params] = useSearchParams();
  const sessionId = params.get('session');
  const { start, connected, status } = useMobileWebRTC(sessionId);
  const videoRef = useRef(null);
  const [started, setStarted] = useState(false);
  const [stream, setStream] = useState(null);

  const handleStart = async () => {
    setStarted(true);
    const s = await start();
    if (s && videoRef.current) {
      videoRef.current.srcObject = s;
      setStream(s);
    }
  };

  const statusConfig = {
    idle: { icon: Camera, color: 'text-slate-400', label: 'Ready to Connect', bg: 'bg-slate-50' },
    acquiring_camera: { icon: Camera, color: 'text-amber-500', label: 'Accessing Camera…', bg: 'bg-amber-50' },
    joining: { icon: Wifi, color: 'text-indigo-500', label: 'Joining Session…', bg: 'bg-indigo-50' },
    streaming: { icon: CheckCircle, color: 'text-emerald-500', label: 'Live — Streaming to Host', bg: 'bg-emerald-50' },
    camera_error: { icon: AlertTriangle, color: 'text-rose-500', label: 'Camera Access Denied', bg: 'bg-rose-50' },
    failed: { icon: WifiOff, color: 'text-rose-500', label: 'Connection Failed', bg: 'bg-rose-50' },
  };

  const cfg = statusConfig[status] || statusConfig.idle;
  const StatusIcon = cfg.icon;

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
      {/* Brand */}
      <div className="flex items-center gap-2 mb-8">
        <div className="w-8 h-8 rounded-xl gradient-indigo flex items-center justify-center">
          <Smartphone className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="font-bold text-white text-sm">HireAI</p>
          <p className="text-[10px] text-slate-400">Secondary Proctoring Camera</p>
        </div>
      </div>

      {/* Status card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm bg-slate-800 rounded-2xl overflow-hidden border border-slate-700"
      >
        {/* Status banner */}
        <div className={`px-4 py-3 flex items-center gap-2 ${cfg.bg} bg-opacity-10`}>
          <StatusIcon className={`w-4 h-4 ${cfg.color}`} />
          <span className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</span>
          {connected && (
            <span className="ml-auto w-2 h-2 rounded-full bg-emerald-400 recording-dot" />
          )}
        </div>

        {/* Video preview */}
        <div className="aspect-[4/3] bg-slate-900 relative">
          {started ? (
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Camera className="w-12 h-12 text-slate-600" />
            </div>
          )}

          {connected && (
            <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/60 text-white text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 recording-dot" />
              LIVE — Workspace View
            </div>
          )}
        </div>

        {/* Session info */}
        <div className="p-4 space-y-3">
          {sessionId ? (
            <div className="bg-slate-700/50 rounded-lg px-3 py-2">
              <p className="text-[10px] text-slate-400 font-medium mb-0.5">Session ID</p>
              <p className="text-xs text-slate-300 font-mono truncate">{sessionId}</p>
            </div>
          ) : (
            <div className="bg-rose-900/30 border border-rose-700/50 rounded-lg px-3 py-2">
              <p className="text-xs text-rose-400">Invalid QR code — no session ID found</p>
            </div>
          )}

          {!started ? (
            <button
              onClick={handleStart}
              disabled={!sessionId}
              className="w-full py-3.5 gradient-indigo text-white font-semibold rounded-xl text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Start Camera Stream
            </button>
          ) : connected ? (
            <div className="flex items-center gap-2 justify-center py-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-400 text-sm font-medium">Streaming to interview host</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 justify-center py-2">
              <div className="w-4 h-4 border-2 border-indigo-400/40 border-t-indigo-400 rounded-full animate-spin" />
              <span className="text-slate-400 text-sm">Connecting...</span>
            </div>
          )}

          <p className="text-[10px] text-slate-500 text-center leading-relaxed">
            Keep this screen open and the phone facing your workspace throughout the interview.
            Closing this page will be flagged as a proctoring event.
          </p>
        </div>
      </motion.div>

      <p className="mt-6 text-[10px] text-slate-600 text-center">
        HireAI Dual-Camera Proctoring System · Secure WebRTC Stream
      </p>
    </div>
  );
}
