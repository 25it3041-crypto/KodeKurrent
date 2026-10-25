import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, RefreshCw, Users, CheckCircle,
  PauseCircle, XCircle, Radio,
} from 'lucide-react';
import CandidateList from './CandidateList';
import CandidateReport from './CandidateReport';
import { getCandidates } from '../../lib/api';
import api from '../../lib/api';
import { getSocket } from '../../lib/socket';

// ─── Live Badge ──────────────────────────────────────────────────────────────

function LiveBadge() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200"
    >
      <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
      <span className="text-[10px] font-bold text-rose-600 tracking-wide">LIVE</span>
    </motion.div>
  );
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, colorClass, bgClass, loading }) {
  return (
    <div className={`relative overflow-hidden rounded-xl border p-3 ${bgClass}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-0.5">{label}</p>
          {loading ? (
            <div className="h-6 w-10 bg-slate-200 rounded animate-pulse" />
          ) : (
            <p className={`text-xl font-black ${colorClass}`}>{value ?? '—'}</p>
          )}
        </div>
        <div className={`p-1.5 rounded-lg ${bgClass} border opacity-70`}>
          <Icon className={`w-3.5 h-3.5 ${colorClass}`} />
        </div>
      </div>
    </div>
  );
}

// ─── Top Stats Bar ───────────────────────────────────────────────────────────

function TopStatsBar({ stats, statsLoading }) {
  const cards = [
    {
      label: 'Total',
      value: stats.total,
      icon: Users,
      colorClass: 'text-indigo-600',
      bgClass: 'bg-indigo-50/80 border-indigo-100',
    },
    {
      label: 'Hired',
      value: stats.hired,
      icon: CheckCircle,
      colorClass: 'text-emerald-600',
      bgClass: 'bg-emerald-50/80 border-emerald-100',
    },
    {
      label: 'On Hold',
      value: stats.hold,
      icon: PauseCircle,
      colorClass: 'text-amber-600',
      bgClass: 'bg-amber-50/80 border-amber-100',
    },
    {
      label: 'Rejected',
      value: stats.rejected,
      icon: XCircle,
      colorClass: 'text-rose-600',
      bgClass: 'bg-rose-50/80 border-rose-100',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {cards.map(card => (
        <StatCard key={card.label} {...card} loading={statsLoading} />
      ))}
    </div>
  );
}

// ─── Empty State (right panel) ───────────────────────────────────────────────

function RightPanelEmpty() {
  return (
    <motion.div
      key="empty"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center h-full min-h-[500px] text-center px-8 py-16 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200"
    >
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-50 to-violet-100 border border-indigo-100 flex items-center justify-center mb-5 shadow-sm">
        <Users className="w-10 h-10 text-indigo-400" />
      </div>
      <p className="font-bold text-slate-700 text-xl">Select a Candidate</p>
      <p className="text-sm text-slate-400 mt-2 max-w-sm leading-relaxed">
        Choose a candidate from the left panel to review their complete AI evaluation report, trust analysis, and proctoring logs.
      </p>
    </motion.div>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────

export default function HRDashboard() {
  const [candidates, setCandidates] = useState([]);
  const [selected, setSelected]     = useState(null);
  const [loading, setLoading]       = useState(true);
  const [liveActive, setLiveActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [stats, setStats]           = useState({ total: 0, hired: 0, hold: 0, rejected: 0 });
  const [statsLoading, setStatsLoading] = useState(true);

  // ── Fetch candidates ──────────────────────────────────────────────────────
  const fetchCandidates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getCandidates();
      setCandidates(res.data.candidates || []);
    } catch {
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Fetch stats from /api/stats ───────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await api.get('/stats');
      const d = res.data;
      setStats({
        total:    d.total    ?? d.totalCandidates ?? 0,
        hired:    d.hired    ?? d.hireCount       ?? d.hire   ?? 0,
        hold:     d.hold     ?? d.holdCount       ?? d.onHold ?? 0,
        rejected: d.rejected ?? d.rejectCount     ?? d.reject ?? 0,
      });
    } catch {
      // fallback if stats fails
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // ── Socket.IO ─────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchCandidates();
    fetchStats();

    const socket = getSocket();

    socket.on('candidate:submitted', () => {
      fetchCandidates();
      fetchStats();
    });

    socket.on('stats:update', (data) => {
      if (data) {
        setStats({
          total:    data.total    ?? data.totalCandidates ?? 0,
          hired:    data.hired    ?? data.hireCount       ?? data.hire   ?? 0,
          hold:     data.hold     ?? data.holdCount       ?? data.onHold ?? 0,
          rejected: data.rejected ?? data.rejectCount     ?? data.reject ?? 0,
        });
      }
    });

    socket.on('interview:started', () => setLiveActive(true));
    socket.on('interview:ended',   () => setLiveActive(false));

    return () => {
      socket.off('candidate:submitted');
      socket.off('stats:update');
      socket.off('interview:started');
      socket.off('interview:ended');
    };
  }, [fetchCandidates, fetchStats]);

  const handleRefresh = () => {
    fetchCandidates();
    fetchStats();
  };

  const handleUpdate = () => {
    fetchCandidates();
    fetchStats();
  };

  return (
    <div className="w-full h-[calc(100vh-3.5rem)] flex overflow-hidden bg-slate-50 border-t border-slate-200">

      {/* ── Left Sidebar (w-80 or w-96 on XL screens) ────────────────────── */}
      <div
        className={`
          flex flex-col w-80 xl:w-96 flex-shrink-0 border-r border-slate-200 bg-white
          h-full overflow-hidden transition-all duration-300
          ${selected ? 'hidden lg:flex' : 'flex'}
        `}
      >
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm">
                <LayoutDashboard className="w-3.5 h-3.5 text-white" />
              </div>
              <h2 className="font-bold text-slate-900 text-sm">HR Command Center</h2>
            </div>
            <div className="flex items-center gap-2">
              {liveActive && <LiveBadge />}
              <button
                onClick={handleRefresh}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 pl-9 mb-3">Candidate Integrity &amp; Evaluation Hub</p>

          {/* Stat cards */}
          <TopStatsBar stats={stats} statsLoading={statsLoading} />
        </div>

        {/* Candidate List with Scroll Area */}
        <div className="flex-1 overflow-y-auto">
          <CandidateList
            candidates={candidates}
            loading={loading}
            selected={selected}
            onSelect={setSelected}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        </div>
      </div>

      {/* ── Right Main Panel (Full Viewport Height & Width Fill) ─────────── */}
      <div className="flex-1 h-full overflow-y-auto bg-slate-50/60 p-4 lg:p-6 flex flex-col">
        <AnimatePresence mode="wait">
          {selected ? (
            <motion.div
              key={selected.candidateId}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="flex-1 w-full flex flex-col"
            >
              <CandidateReport
                candidateId={selected.candidateId}
                onBack={() => setSelected(null)}
                onUpdate={handleUpdate}
              />
            </motion.div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <RightPanelEmpty />
            </div>
          )}
        </AnimatePresence>
      </div>

    </div>
  );
}