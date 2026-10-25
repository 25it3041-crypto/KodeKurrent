import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Shield, Eye, Clipboard, Monitor, Film, Volume2 } from 'lucide-react';

const EVENT_CONFIG = {
  tab_switch: { icon: Monitor, color: 'rose', label: 'Tab Switch', severity: 'HIGH' },
  focus_loss: { icon: Eye, color: 'amber', label: 'Focus Lost', severity: 'MEDIUM' },
  copy_attempt: { icon: Clipboard, color: 'rose', label: 'Copy Attempt', severity: 'HIGH' },
  paste_attempt: { icon: Clipboard, color: 'rose', label: 'Paste Attempt', severity: 'HIGH' },
  mobile_disconnected: { icon: Shield, color: 'amber', label: 'Mobile Cam Drop', severity: 'MEDIUM' },
  ai_response_detected: { icon: AlertTriangle, color: 'rose', label: 'AI Response', severity: 'HIGH' },
  print_attempt: { icon: Monitor, color: 'rose', label: 'Print/Screenshot', severity: 'CRITICAL' },
  gaze_edge: { icon: Eye, color: 'amber', label: 'Gaze Off-Screen', severity: 'LOW' },
  right_click: { icon: Clipboard, color: 'slate', label: 'Right-Click', severity: 'LOW' },
  mobile_cam_drop: { icon: Shield, color: 'amber', label: 'Cam Disconnected', severity: 'MEDIUM' },
};

export default function SuspicionTimeline({ events = [] }) {
  if (events.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400">
        <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="font-medium text-slate-500">No proctoring flags detected</p>
        <p className="text-sm mt-1">Clean integrity record throughout the interview</p>
      </div>
    );
  }

  // Group high-severity events for suspicion clips
  const topEvents = [...events]
    .filter(e => e.severity === 'high' || e.severity === 'critical')
    .slice(0, 5);

  return (
    <div className="space-y-5">
      {/* Suspicion clip highlights */}
      {topEvents.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Film className="w-4 h-4 text-rose-500" />
            <p className="font-semibold text-rose-700 text-sm">
              Auto-Extracted Suspicion Clips — Top {topEvents.length} Flagged Moments
            </p>
          </div>
          <div className="space-y-2">
            {topEvents.map((e, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex items-center gap-3 bg-white border border-rose-100 rounded-xl p-3"
              >
                <div className="w-14 h-10 rounded-lg bg-slate-900 flex items-center justify-center flex-shrink-0 text-[9px] text-slate-400">
                  {/* Simulated clip thumbnail */}
                  <div className="text-center">
                    <div className="w-5 h-5 border-2 border-rose-400 rounded-full flex items-center justify-center mx-auto mb-0.5">
                      <span className="text-rose-400">▶</span>
                    </div>
                    <span>10s clip</span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800 truncate">
                    {EVENT_CONFIG[e.type]?.label || e.type}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {e.timestamp ? new Date(e.timestamp).toLocaleTimeString() : 'Unknown time'}
                  </p>
                </div>
                <span className="flex-shrink-0 px-2 py-0.5 rounded text-[9px] font-bold bg-rose-100 text-rose-700">
                  {EVENT_CONFIG[e.type]?.severity || 'FLAG'}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Full timeline */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 card-shadow">
        <p className="text-sm font-semibold text-slate-700 mb-4">Complete Event Timeline ({events.length} events)</p>
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-100" />
          <div className="space-y-3">
            {events.map((e, i) => {
              const cfg = EVENT_CONFIG[e.type] || { icon: AlertTriangle, color: 'slate', label: e.type, severity: 'INFO' };
              const Icon = cfg.icon;
              const colorMap = {
                rose: { dot: 'bg-rose-400', text: 'text-rose-700', bg: 'bg-rose-50' },
                amber: { dot: 'bg-amber-400', text: 'text-amber-700', bg: 'bg-amber-50' },
                slate: { dot: 'bg-slate-300', text: 'text-slate-500', bg: 'bg-slate-50' },
              };
              const col = colorMap[cfg.color] || colorMap.slate;

              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="relative flex items-start gap-3 pl-8"
                >
                  <div className={`absolute left-3 top-2 w-2.5 h-2.5 rounded-full border-2 border-white ${col.dot}`} />
                  <div className={`flex-1 rounded-xl px-3 py-2 ${col.bg}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <Icon className={`w-3.5 h-3.5 ${col.text}`} />
                        <span className={`text-xs font-semibold ${col.text}`}>{cfg.label}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <span className={`px-1.5 py-0.5 rounded font-bold ${col.bg} ${col.text} border border-current/20`}>
                          {cfg.severity}
                        </span>
                        <span>{e.timestamp ? new Date(e.timestamp).toLocaleTimeString() : ''}</span>
                      </div>
                    </div>
                    {e.reason && <p className="text-[10px] text-slate-500 mt-0.5">{e.reason}</p>}
                    {e.points && <p className="text-[10px] text-rose-500">−{e.points} trust points</p>}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
