import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, Monitor, Clipboard, Eye, Zap, AlertTriangle,
  Shield, Volume2, Wifi, ChevronDown, ChevronUp, Filter
} from 'lucide-react';

const CATEGORY_MAP = {
  motion: {
    label: 'Motion Analysis',
    icon: Activity,
    color: 'amber',
    types: ['rapid_body_motion', 'head_neck_movement', 'gaze_deviation', 'HEAD_POSE'],
  },
  screen: {
    label: 'Screen & Focus',
    icon: Monitor,
    color: 'rose',
    types: ['tab_switch', 'focus_loss', 'print_attempt'],
  },
  input: {
    label: 'Input Guards',
    icon: Clipboard,
    color: 'rose',
    types: ['copy_attempt', 'paste_attempt', 'right_click'],
  },
  camera: {
    label: 'Camera Events',
    icon: Shield,
    color: 'violet',
    types: ['mobile_disconnected', 'mobile_cam_drop', 'MOBILE_DISCONNECTED', 'MULTIPLE_PERSONS', 'MULTIPLE_FACES_DETECTED', 'NO_FACE_DETECTED'],
  },
  ai: {
    label: 'AI Detection',
    icon: Zap,
    color: 'indigo',
    types: ['ai_response_detected'],
  },
  audio: {
    label: 'Audio Integrity',
    icon: Volume2,
    color: 'amber',
    types: ['MULTIPLE_VOICES', 'BACKGROUND_NOISE_DETECTED'],
  },
};

function getCategoryForType(type) {
  for (const [key, cat] of Object.entries(CATEGORY_MAP)) {
    if (cat.types.includes(type) || cat.types.includes(String(type || '').toUpperCase())) return { key, ...cat };
  }
  return { key: 'other', label: 'Other', icon: AlertTriangle, color: 'slate', types: [] };
}

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
const SEVERITY_COLORS = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-rose-50 text-rose-700 border-rose-100',
  medium: 'bg-amber-50 text-amber-700 border-amber-100',
  low: 'bg-slate-50 text-slate-600 border-slate-100',
};

export default function AuditEventLog({ events = [], motionEvents = [] }) {
  const [filter, setFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('time'); // 'time' | 'severity'
  const [expanded, setExpanded] = useState(null);

  // Merge all events
  const allEvents = [
    ...events.map(e => ({ ...e, source: 'proctor' })),
    ...motionEvents.map(e => ({ ...e, source: 'motion' })),
  ];

  // Filter
  const filtered = allEvents.filter(e => {
    if (filter === 'all') return true;
    const cat = getCategoryForType(e.type);
    return cat.key === filter;
  });

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    if (sortOrder === 'severity') {
      return (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99);
    }
    return new Date(b.timestamp) - new Date(a.timestamp);
  });

  // Category counts
  const counts = {};
  allEvents.forEach(e => {
    const cat = getCategoryForType(e.type);
    counts[cat.key] = (counts[cat.key] || 0) + 1;
  });

  return (
    <div className="space-y-4">
      {/* Summary chips */}
      <div className="flex flex-wrap gap-2">
        <FilterChip
          label={`All (${allEvents.length})`}
          active={filter === 'all'}
          onClick={() => setFilter('all')}
          color="slate"
        />
        {Object.entries(CATEGORY_MAP).map(([key, cat]) => {
          const count = counts[key] || 0;
          if (count === 0) return null;
          return (
            <FilterChip
              key={key}
              label={`${cat.label} (${count})`}
              active={filter === key}
              onClick={() => setFilter(key)}
              color={cat.color}
            />
          );
        })}
      </div>

      {/* Sort control */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">{sorted.length} events</p>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-400">Sort:</span>
          <button
            onClick={() => setSortOrder(s => s === 'time' ? 'severity' : 'time')}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
          >
            {sortOrder === 'time' ? 'Newest first' : 'By severity'}
          </button>
        </div>
      </div>

      {/* Event list */}
      {sorted.length === 0 ? (
        <div className="text-center py-8 text-slate-400">
          <Shield className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No events in this category</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((e, i) => {
            const cat = getCategoryForType(e.type);
            const CatIcon = cat.icon;
            const sevStyle = SEVERITY_COLORS[e.severity] || SEVERITY_COLORS.low;
            const isOpen = expanded === i;

            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.2) }}
                className={`border rounded-xl overflow-hidden cursor-pointer ${sevStyle}`}
                onClick={() => setExpanded(isOpen ? null : i)}
              >
                <div className="flex items-center gap-3 px-3.5 py-2.5">
                  <CatIcon className="w-4 h-4 flex-shrink-0 opacity-70" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">
                      {e.label || e.type?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </p>
                    <p className="text-[10px] opacity-60 mt-0.5">{cat.label}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {e.points && (
                      <span className="text-[10px] font-bold opacity-80">−{e.points}pts</span>
                    )}
                    <span className="text-[10px] opacity-60">
                      {e.timestamp ? new Date(e.timestamp).toLocaleTimeString() : ''}
                    </span>
                    {isOpen ? <ChevronUp className="w-3 h-3 opacity-60" /> : <ChevronDown className="w-3 h-3 opacity-60" />}
                  </div>
                </div>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-current/10 px-3.5 py-2 text-[11px] opacity-80 space-y-0.5"
                    >
                      {(e.evidence || e.reason) && (
                        <p><span className="font-semibold">Evidence:</span> {e.evidence || e.reason}</p>
                      )}
                      {e.reason && e.evidence && e.reason !== e.evidence && (
                        <p><span className="font-semibold">Reason:</span> {e.reason}</p>
                      )}
                      {e.motionRatio !== undefined && (
                        <p><span className="font-semibold">Motion intensity:</span> {e.motionRatio}%</p>
                      )}
                      {e.neckMotionRatio !== undefined && (
                        <p><span className="font-semibold">Head/neck region:</span> {e.neckMotionRatio}%</p>
                      )}
                      {e.edgeRatio !== undefined && (
                        <p><span className="font-semibold">Gaze edge deviation:</span> {e.edgeRatio}%</p>
                      )}
                      {e.probability !== undefined && (
                        <p><span className="font-semibold">AI probability:</span> {e.probability}%</p>
                      )}
                      {e.count !== undefined && (
                        <p><span className="font-semibold">Occurrence count:</span> {e.count}</p>
                      )}
                      <p><span className="font-semibold">Severity:</span> {e.severity?.toUpperCase() || 'INFO'}</p>
                      <p><span className="font-semibold">Source:</span> {e.source === 'motion' ? 'Frame Motion Analysis' : 'Proctoring Guard'}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FilterChip({ label, active, onClick, color }) {
  const base = 'text-[11px] font-medium px-3 py-1.5 rounded-full border cursor-pointer transition-all';
  const activeMap = {
    slate: 'bg-slate-800 text-white border-slate-800',
    rose: 'bg-rose-600 text-white border-rose-600',
    amber: 'bg-amber-500 text-white border-amber-500',
    violet: 'bg-violet-600 text-white border-violet-600',
    indigo: 'bg-indigo-600 text-white border-indigo-600',
  };
  const inactiveMap = {
    slate: 'bg-white text-slate-600 border-slate-200 hover:border-slate-400',
    rose: 'bg-white text-rose-600 border-rose-200 hover:border-rose-400',
    amber: 'bg-white text-amber-600 border-amber-200 hover:border-amber-400',
    violet: 'bg-white text-violet-600 border-violet-200 hover:border-violet-400',
    indigo: 'bg-white text-indigo-600 border-indigo-200 hover:border-indigo-400',
  };
  return (
    <button onClick={onClick} className={`${base} ${active ? (activeMap[color] || activeMap.slate) : (inactiveMap[color] || inactiveMap.slate)}`}>
      {label}
    </button>
  );
}
