import React, { useEffect, useRef } from 'react';
import { CheckCircle2 } from 'lucide-react';

export default function SecondaryCam({ stream, compact = false }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  if (!stream) return null;

  return (
    <div className={`relative w-full ${compact ? 'h-28' : 'h-44'} bg-black rounded-lg overflow-hidden`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
      />
      <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/90 text-white text-[10px] font-bold">
        <CheckCircle2 className="w-3 h-3" />
        <span>LIVE FEED</span>
      </div>
      <div className="absolute bottom-2 left-2 text-[10px] text-white/80 bg-black/50 px-2 py-0.5 rounded-full">
        Workspace cam
      </div>
    </div>
  );
}
