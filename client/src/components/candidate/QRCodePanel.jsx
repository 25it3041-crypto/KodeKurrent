import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { Smartphone, Wifi, WifiOff, CheckCircle2 } from 'lucide-react';
import { useWebRTC } from '../../hooks/useWebRTC';
import useStore from '../../lib/store';
import SecondaryCam from './SecondaryCam';

export default function QRCodePanel({ sessionId, compact = false }) {
  const { remoteStream, connectionState } = useWebRTC(sessionId);
  const mobileConnected = useStore(s => s.mobileConnected);
  const addProctorEvent = useStore(s => s.addProctorEvent);

  const [mobileUrl, setMobileUrl] = useState('');

  useEffect(() => {
    const origin = window.location.origin;
    const url = `${origin}/mobile-cam?session=${sessionId || 'demo'}`;
    setMobileUrl(url);
  }, [sessionId]);

  // Handle Disconnect Event Log
  useEffect(() => {
    if (connectionState === 'disconnected') {
      addProctorEvent({
        type: 'MOBILE_DISCONNECTED',
        label: 'Secondary mobile camera feed lost',
        severity: 'high',
        timestamp: new Date().toISOString()
      });
    }
  }, [connectionState, addProctorEvent]);

  return (
    <div className="flex flex-col items-center p-5 bg-white rounded-2xl border border-slate-200 shadow-sm max-w-sm mx-auto text-center">
      <div className="flex items-center gap-2 mb-2 text-indigo-600">
        <Smartphone className="w-5 h-5" />
        <h3 className="font-bold text-sm text-slate-800">Mobile Proctoring Pair</h3>
      </div>

      <p className="text-xs text-slate-500 mb-4 leading-relaxed">
        Scan this QR code using your mobile phone camera to start the secondary feed.
      </p>

      {/* QR Code OR Live Mobile Video Stream */}
      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 relative overflow-hidden flex items-center justify-center min-w-[200px] min-h-[200px]">
        {connectionState === 'connected' || mobileConnected ? (
          <SecondaryCam stream={remoteStream} compact={compact} />
        ) : mobileUrl ? (
          <QRCodeSVG 
            value={mobileUrl} 
            size={180} 
            level="H" 
            includeMargin={true}
          />
        ) : (
          <div className="text-xs text-slate-400">Generating Pairing QR...</div>
        )}
      </div>

      {/* Connection Status Badge */}
      <div className="mt-4 flex items-center justify-center gap-2">
        {connectionState === 'connected' || mobileConnected ? (
          <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
            <Wifi className="w-3.5 h-3.5 animate-pulse" /> Mobile Paired & Active
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-xs text-amber-600 font-medium bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
            <WifiOff className="w-3.5 h-3.5" /> Waiting for Scan...
          </span>
        )}
      </div>

      <p className="text-[10px] text-slate-400 font-mono mt-3 truncate w-full px-2">
        {mobileUrl}
      </p>
    </div>
  );
}