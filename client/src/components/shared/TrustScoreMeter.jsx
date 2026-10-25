import React from 'react';
import { motion } from 'framer-motion';
import { Shield, AlertTriangle, CheckCircle, AlertOctagon } from 'lucide-react';
import useStore from '../../lib/store';

export default function TrustScoreMeter() {
  const trustScore = useStore(s => s.trustScore);
  const proctorEvents = useStore(s => s.proctorEvents);

  const color = trustScore >= 80 ? '#10B981' : trustScore >= 60 ? '#F59E0B' : '#F43F5E';
  const label = trustScore >= 80 ? 'TRUSTWORTHY' : trustScore >= 60 ? 'CAUTION' : 'SUSPICIOUS';
  const Icon = trustScore >= 80 ? CheckCircle : trustScore >= 60 ? AlertTriangle : AlertOctagon;

  const recentEvents = proctorEvents.slice(-3).reverse();
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (trustScore / 100) * circumference;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Shield className="w-3.5 h-3.5 text-indigo-500" />
        <span className="text-xs font-semibold text-slate-700">AI Integrity Trust Score</span>
      </div>

      <div className="flex items-center gap-4">
        {/* Circular gauge */}
        <div className="relative flex-shrink-0">
          <svg width="88" height="88" viewBox="0 0 88 88">
            {/* Background ring */}
            <circle cx="44" cy="44" r="40" fill="none" stroke="#F1F5F9" strokeWidth="8" />
            {/* Score arc */}
            <motion.circle
              cx="44" cy="44" r="40" fill="none"
              stroke={color} strokeWidth="8"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              style={{ transform: 'rotate(-90deg)', transformOrigin: '44px 44px' }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold" style={{ color }}>{trustScore}</span>
            <span className="text-[9px] text-slate-400 font-medium">/ 100</span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <Icon className="w-3.5 h-3.5" style={{ color }} />
            <span className="text-xs font-bold" style={{ color }}>{label}</span>
          </div>

          {recentEvents.length > 0 ? (
            <div className="space-y-1">
              {recentEvents.map((e, i) => (
                <div key={i} className="text-[10px] text-slate-500 flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    e.severity === 'high' || e.severity === 'critical' ? 'bg-rose-400' :
                    e.severity === 'medium' ? 'bg-amber-400' : 'bg-blue-400'
                  }`} />
                  <span className="truncate">{formatEvent(e)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-slate-400">No integrity issues detected</p>
          )}
        </div>
      </div>
    </div>
  );
}

function formatEvent(e) {
  const map = {
    tab_switch: `Tab switched (${e.count}x)`,
    focus_loss: 'Window focus lost',
    copy_attempt: 'Copy intercepted',
    paste_attempt: 'Paste intercepted',
    mobile_disconnected: 'Mobile cam dropped',
    ai_response_detected: `AI answer detected (${e.probability}%)`,
    right_click: 'Right-click blocked',
    print_attempt: 'Print/screenshot blocked',
    gaze_edge: 'Gaze off-screen',
    mobile_cam_drop: 'Mobile camera disconnected',
  };
  return map[e.type] || e.type?.replace(/_/g, ' ');
}
