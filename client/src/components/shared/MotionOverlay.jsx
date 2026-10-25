import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, AlertTriangle, Eye, Zap } from 'lucide-react';
import useStore from '../../lib/store';

/**
 * MotionOverlay — Rendered on top of the webcam preview.
 * Shows a live motion intensity bar and flashes an alert when
 * the motion analysis hook detects a head/neck or body event.
 */
export default function MotionOverlay({ getMotionScore }) {
  const motionEvents = useStore(s => s.motionEvents);
  const [motionPct, setMotionPct] = useState(0);
  const [alert, setAlert] = useState(null);
  const alertTimerRef = useRef(null);
  const rafRef = useRef(null);

  // Poll motion score at 15fps
  useEffect(() => {
    if (!getMotionScore) return;
    const tick = () => {
      const score = getMotionScore();
      setMotionPct(Math.min(100, Math.round(score * 1000)));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [getMotionScore]);

  // Show flash alert on new events
  useEffect(() => {
    if (motionEvents.length === 0) return;
    const latest = motionEvents[motionEvents.length - 1];
    clearTimeout(alertTimerRef.current);
    setAlert(latest);
    alertTimerRef.current = setTimeout(() => setAlert(null), 2500);
    return () => clearTimeout(alertTimerRef.current);
  }, [motionEvents]);

  const barColor = motionPct < 20 ? '#10B981' : motionPct < 50 ? '#F59E0B' : '#F43F5E';

  return (
    <>
      {/* Live motion bar at bottom of video */}
      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
        <div className="flex items-center gap-2">
          <Activity className="w-3 h-3 text-white/70 flex-shrink-0" />
          <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: barColor }}
              animate={{ width: `${motionPct}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>
          <span className="text-[9px] text-white/70 font-mono w-8 text-right">{motionPct}%</span>
        </div>
      </div>

      {/* Flash alert overlay */}
      <AnimatePresence>
        {alert && (
          <motion.div
            key={alert.timestamp}
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8 }}
            className="absolute top-2 left-2 right-2 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-rose-600/90 backdrop-blur-sm border border-rose-400/50 shadow-lg"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-white flex-shrink-0" />
            <p className="text-[11px] text-white font-semibold truncate">{alert.label || alert.type}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/**
 * MotionEventLog — scrollable timeline of motion & proctoring events for the HR view.
 */
export function MotionEventLog({ events = [] }) {
  const containerRef = useRef(null);

  useEffect(() => {
    containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight, behavior: 'smooth' });
  }, [events]);

  const ICON_MAP = {
    rapid_body_motion: { Icon: Zap, color: 'rose' },
    head_neck_movement: { Icon: AlertTriangle, color: 'amber' },
    gaze_deviation: { Icon: Eye, color: 'amber' },
    tab_switch: { Icon: Activity, color: 'rose' },
    focus_loss: { Icon: Activity, color: 'amber' },
    copy_attempt: { Icon: Activity, color: 'rose' },
    paste_attempt: { Icon: Activity, color: 'rose' },
  };

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-slate-400">
        <Activity className="w-8 h-8 mb-2 opacity-40" />
        <p className="text-sm font-medium text-slate-500">No motion events logged</p>
        <p className="text-xs mt-0.5">Frame analysis running in background</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
      {events.map((e, i) => {
        const cfg = ICON_MAP[e.type] || { Icon: Activity, color: 'slate' };
        const { Icon } = cfg;
        const colorMap = {
          rose: 'bg-rose-50 border-rose-100 text-rose-700',
          amber: 'bg-amber-50 border-amber-100 text-amber-700',
          slate: 'bg-slate-50 border-slate-100 text-slate-600',
        };
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(i * 0.02, 0.3) }}
            className={`flex items-start gap-2.5 px-3 py-2 rounded-xl border text-xs ${colorMap[cfg.color]}`}
          >
            <Icon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{e.label || e.type?.replace(/_/g, ' ')}</p>
              {(e.motionRatio || e.neckMotionRatio || e.edgeRatio) && (
                <p className="opacity-70 mt-0.5">
                  {e.motionRatio && `Motion: ${e.motionRatio}%`}
                  {e.neckMotionRatio && ` · Neck: ${e.neckMotionRatio}%`}
                  {e.edgeRatio && ` · Edge: ${e.edgeRatio}%`}
                </p>
              )}
            </div>
            <span className="flex-shrink-0 opacity-60">{e.timestamp ? new Date(e.timestamp).toLocaleTimeString() : ''}</span>
          </motion.div>
        );
      })}
    </div>
  );
}
