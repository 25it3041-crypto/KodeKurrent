import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Clock, Shield, Star, ChevronRight,
  AlertTriangle, Search, Users, Frown,
} from 'lucide-react';

// ─── Helpers ────────────────────────────────────────────────────────────────

function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const AVATAR_GRADIENTS = [
  'from-indigo-400 to-violet-500',
  'from-rose-400 to-pink-500',
  'from-emerald-400 to-teal-500',
  'from-amber-400 to-orange-500',
  'from-sky-400 to-blue-500',
  'from-fuchsia-400 to-purple-500',
];

function avatarGradient(name = '') {
  const idx = (name.charCodeAt(0) || 0) % AVATAR_GRADIENTS.length;
  return AVATAR_GRADIENTS[idx];
}

// ─── Skeleton Card ───────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="w-full p-3.5 rounded-xl border border-slate-100 bg-white animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-slate-200 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="h-3.5 bg-slate-200 rounded w-28" />
            <div className="h-4 bg-slate-100 rounded w-12" />
          </div>
          <div className="h-2.5 bg-slate-100 rounded w-20" />
          <div className="flex gap-3 mt-1">
            <div className="h-2.5 bg-slate-100 rounded w-10" />
            <div className="h-2.5 bg-slate-100 rounded w-10" />
            <div className="h-2.5 bg-slate-100 rounded w-10 ml-auto" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Recommendation Badge ────────────────────────────────────────────────────

function RecommendationBadge({ rec }) {
  const styles = {
    HIRE:   'bg-emerald-100 text-emerald-700 border border-emerald-200',
    HOLD:   'bg-amber-100   text-amber-700   border border-amber-200',
    REJECT: 'bg-rose-100    text-rose-700    border border-rose-200',
  };
  return (
    <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide ${styles[rec] || styles.HOLD}`}>
      {rec || 'HOLD'}
    </span>
  );
}

// ─── Star Row ────────────────────────────────────────────────────────────────

function StarRow({ score }) {
  const numScore = Number(score || 0);
  const rounded = Math.round(isNaN(numScore) ? 0 : numScore);
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <Star
          key={n}
          className={`w-2.5 h-2.5 ${n <= rounded ? 'text-amber-400 fill-amber-400' : 'text-slate-200 fill-slate-200'}`}
        />
      ))}
    </div>
  );
}

// ─── Trust Bar ───────────────────────────────────────────────────────────────

function TrustBar({ score }) {
  const numScore = Number(score || 0);
  const validScore = isNaN(numScore) ? 0 : numScore;
  const pct = Math.min(100, Math.max(0, validScore));
  const color =
    pct >= 80 ? 'bg-emerald-500' :
    pct >= 60 ? 'bg-amber-500'   :
                'bg-rose-500';
  return (
    <div className="flex items-center gap-1.5">
      <Shield className="w-3 h-3 text-slate-400 flex-shrink-0" />
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-slate-500 w-8 text-right">{pct}%</span>
    </div>
  );
}

// ─── Candidate Card ──────────────────────────────────────────────────────────

function CandidateCard({ candidate: c, isSelected, onClick, index }) {
  const numericScore = Number(c.avgScore || 0);
  const safeScore = isNaN(numericScore) ? 0 : numericScore;

  return (
    <motion.button
      key={c.candidateId}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ delay: index * 0.04, duration: 0.25 }}
      onClick={onClick}
      className={`w-full text-left p-3.5 rounded-xl border transition-all group ${
        isSelected
          ? 'border-indigo-200 bg-indigo-50/80 shadow-sm ring-1 ring-indigo-100'
          : 'border-slate-100 bg-white hover:border-indigo-100 hover:bg-slate-50/80 hover:shadow-sm'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className={`flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br ${avatarGradient(c.name)} flex items-center justify-center text-white font-bold text-sm shadow-sm`}>
          {c.name?.[0]?.toUpperCase() || '?'}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-1">
          {/* Row 1: name + badge */}
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-slate-800 text-sm truncate">{c.name || 'Unknown'}</p>
            <RecommendationBadge rec={c.recommendation} />
          </div>

          {/* Row 2: role */}
          <p className="text-xs text-slate-400 truncate">{c.jobTitle || 'No Role'}</p>

          {/* Row 3: stars */}
          <div className="flex items-center gap-2">
            <StarRow score={safeScore} />
            <span className="text-[10px] text-slate-400">{safeScore.toFixed(1)}/5</span>
          </div>

          {/* Row 4: trust bar */}
          <TrustBar score={c.trustScore} />

          {/* Row 5: flags + time */}
          <div className="flex items-center gap-3 pt-0.5">
            {(c.proctorEventCount ?? 0) > 0 && (
              <div className="flex items-center gap-1 text-[10px] text-amber-600">
                <AlertTriangle className="w-3 h-3" />
                <span>{c.proctorEventCount} flag{c.proctorEventCount !== 1 ? 's' : ''}</span>
              </div>
            )}
            <div className="flex items-center gap-1 text-[10px] text-slate-400 ml-auto">
              <Clock className="w-3 h-3" />
              <span>{timeAgo(c.submittedAt)}</span>
            </div>
          </div>
        </div>

        <ChevronRight className={`w-4 h-4 flex-shrink-0 mt-2 transition-colors ${isSelected ? 'text-indigo-400' : 'text-slate-200 group-hover:text-slate-300'}`} />
      </div>
    </motion.button>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState({ isFiltered, onClear }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center py-14 px-6"
    >
      {isFiltered ? (
        <>
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <Search className="w-7 h-7 text-slate-300" />
          </div>
          <p className="font-semibold text-slate-600">No results found</p>
          <p className="text-sm text-slate-400 mt-1">Try a different name or role</p>
          <button
            onClick={onClear}
            className="mt-4 text-sm text-indigo-500 hover:text-indigo-700 underline transition-colors"
          >
            Clear search
          </button>
        </>
      ) : (
        <>
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 flex items-center justify-center mx-auto mb-3">
            <Users className="w-7 h-7 text-indigo-300" />
          </div>
          <p className="font-semibold text-slate-600">No candidates yet</p>
          <p className="text-sm text-slate-400 mt-1">Completed interviews will appear here automatically</p>
        </>
      )}
    </motion.div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function CandidateList({
  candidates = [],
  loading = false,
  selected = null,
  onSelect,
  searchQuery = '',
  onSearchChange,
}) {
  // Internal search fallback if parent doesn't provide searchQuery
  const [internalQuery, setInternalQuery] = useState('');
  const query = onSearchChange ? searchQuery : internalQuery;
  const setQuery = onSearchChange ?? setInternalQuery;

  const filtered = useMemo(() => {
    if (!query.trim()) return candidates;
    const q = query.toLowerCase();
    return candidates.filter(c =>
      c.name?.toLowerCase().includes(q) ||
      c.jobTitle?.toLowerCase().includes(q) ||
      c.recommendation?.toLowerCase().includes(q)
    );
  }, [candidates, query]);

  return (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <div className="px-3 pt-3 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search candidates…"
            className="w-full pl-8 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300 placeholder-slate-400 text-slate-700 transition"
          />
        </div>
      </div>

      {/* Count */}
      {!loading && candidates.length > 0 && (
        <div className="px-4 pb-1">
          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">
            {filtered.length} of {candidates.length} candidate{candidates.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-auto px-3 pb-3">
        {loading ? (
          <div className="space-y-2 pt-1">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState isFiltered={!!query.trim()} onClear={() => setQuery('')} />
        ) : (
          <div className="space-y-2 pt-1">
            <AnimatePresence>
              {filtered.map((c, i) => (
                <CandidateCard
                  key={c.candidateId || i}
                  candidate={c}
                  isSelected={selected?.candidateId === c.candidateId}
                  onClick={() => onSelect?.(c)}
                  index={i}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}