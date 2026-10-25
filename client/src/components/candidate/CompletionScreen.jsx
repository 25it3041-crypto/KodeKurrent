import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2, PartyPopper, BarChart2, Shield, Star,
  ArrowRight, RotateCcw, Users, TrendingUp, Clock, Award
} from 'lucide-react';
import useStore from '../../lib/store';

const CONFETTI_COLORS = ['#6366F1','#8B5CF6','#10B981','#F59E0B','#F43F5E','#06B6D4'];

function Confetti() {
  const pieces = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    x: Math.random() * 100,
    delay: Math.random() * 1.2,
    duration: 1.5 + Math.random() * 1.5,
    size: 6 + Math.random() * 8,
    rotate: Math.random() * 360,
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {pieces.map(p => (
        <motion.div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: -20,
            width: p.size,
            height: p.size,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            backgroundColor: p.color,
          }}
          initial={{ y: -20, rotate: 0, opacity: 1 }}
          animate={{ y: '100vh', rotate: p.rotate + 360, opacity: 0 }}
          transition={{ duration: p.duration, delay: p.delay, ease: 'easeIn' }}
        />
      ))}
    </div>
  );
}

export default function CompletionScreen() {
  const { candidate, jobConfig, evaluations, trustScore, setPortal, reset, answers } = useStore();
  const [showConfetti, setShowConfetti] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setShowConfetti(false), 4000);
    return () => clearTimeout(t);
  }, []);

  const scores = evaluations.map(e => e.hrOverrideScore || e.score || 3);
  const avg = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const avgDisplay = avg.toFixed(1);

  const recommendation = avg >= 3.5 ? 'HIRE' : avg >= 2.5 ? 'HOLD' : 'REJECT';
  const recConfig = {
    HIRE: { label: '✅ Strong Candidate', cls: 'from-emerald-500 to-teal-500', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', desc: 'Your performance meets or exceeds role requirements.' },
    HOLD: { label: '🔄 Needs Review', cls: 'from-amber-500 to-orange-500', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', desc: 'Your interview will be reviewed by the HR team.' },
    REJECT: { label: '📋 Under Consideration', cls: 'from-slate-500 to-slate-600', bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700', desc: 'The team will be in touch with their decision.' },
  };
  const rec = recConfig[recommendation];

  const circumference = 2 * Math.PI * 45;
  const scoreOffset = circumference - (avg / 5) * circumference;
  const trustOffset = circumference - (trustScore / 100) * circumference;

  const nextSteps = [
    { icon: '📧', label: 'Confirmation email sent', sub: `to ${candidate.email}`, done: true },
    { icon: '🔍', label: 'HR reviewing your session', sub: 'Score & proctoring analysis', done: false },
    { icon: '📞', label: 'Interview feedback call', sub: 'Within 3-5 business days', done: false },
    { icon: '🎯', label: 'Final hiring decision', sub: 'You\'ll hear from us soon', done: false },
  ];

  return (
    <div className="relative min-h-full gradient-canvas flex items-center justify-center p-6 overflow-hidden">
      <AnimatePresence>{showConfetti && <Confetti />}</AnimatePresence>

      <motion.div initial={{ opacity: 0, scale: 0.9, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', bounce: 0.3 }}
        className="w-full max-w-2xl space-y-6 relative z-10">

        {/* Hero card */}
        <div className="bg-white border border-slate-200 rounded-3xl card-shadow-lg overflow-hidden">
          {/* Gradient header */}
          <div className="h-2 gradient-indigo" />
          <div className="p-8 text-center">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', bounce: 0.5, delay: 0.2 }}
              className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5 shadow-lg">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            </motion.div>
            <div className="flex items-center justify-center gap-2 mb-2">
              <PartyPopper className="w-5 h-5 text-amber-500" />
              <h1 className="text-2xl font-black text-slate-900">Interview Complete!</h1>
              <PartyPopper className="w-5 h-5 text-amber-500 scale-x-[-1]" />
            </div>
            <p className="text-slate-500 mb-1">
              Great job, <strong className="text-slate-700">{candidate.name || 'Candidate'}</strong>!
            </p>
            <p className="text-sm text-slate-400">
              You completed <strong>{evaluations.length}</strong> questions for <strong>{jobConfig.jobTitle || 'the role'}</strong>
            </p>
          </div>
        </div>

        {/* Score gauges */}
        <div className="grid grid-cols-2 gap-4">
          <ScoreGauge label="Avg Score" value={avgDisplay} max="5" offset={scoreOffset} circumference={circumference}
            color="#6366F1" bg="#EEF2FF" sub={`${evaluations.length} questions`} />
          <ScoreGauge label="Trust Index" value={`${trustScore}%`} max="100%" offset={trustOffset} circumference={circumference}
            color={trustScore >= 80 ? '#10B981' : trustScore >= 60 ? '#F59E0B' : '#F43F5E'}
            bg={trustScore >= 80 ? '#ECFDF5' : trustScore >= 60 ? '#FFFBEB' : '#FFF1F2'}
            sub="Integrity score" />
        </div>

        {/* Recommendation */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className={`border-2 rounded-2xl p-5 ${rec.bg} ${rec.border}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${rec.cls} flex items-center justify-center shadow-md`}>
              <Award className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className={`font-black text-lg ${rec.text}`}>{rec.label}</p>
              <p className={`text-sm ${rec.text} opacity-80`}>{rec.desc}</p>
            </div>
          </div>
        </motion.div>

        {/* Next steps */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 card-shadow">
          <p className="text-sm font-bold text-slate-700 mb-4">What happens next?</p>
          <div className="space-y-3">
            {nextSteps.map((step, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 + i * 0.1 }}
                className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-base flex-shrink-0 ${step.done ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                  {step.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${step.done ? 'text-emerald-800' : 'text-slate-700'}`}>{step.label}</p>
                  <p className="text-xs text-slate-400">{step.sub}</p>
                </div>
                {step.done && <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
                {!step.done && <div className="w-4 h-4 rounded-full border-2 border-dashed border-slate-300 flex-shrink-0" />}
              </motion.div>
            ))}
          </div>
        </div>

        {/* CTAs */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => reset()}
            className="flex items-center justify-center gap-2 py-3.5 border-2 border-slate-200 text-slate-700 font-semibold rounded-2xl hover:bg-slate-50 hover:border-slate-300 transition-all">
            <RotateCcw className="w-4 h-4" /> New Session
          </button>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setPortal('hr')}
            className="flex items-center justify-center gap-2 py-3.5 gradient-indigo text-white font-bold rounded-2xl shadow-lg shadow-indigo-200 hover:opacity-90 transition-all">
            <Users className="w-4 h-4" /> HR Dashboard <ArrowRight className="w-4 h-4" />
          </motion.button>
        </div>

        <p className="text-center text-xs text-slate-400">
          Preliminary AI score — Final decision by HR team · HireAI Autonomous Platform
        </p>
      </motion.div>
    </div>
  );
}

function ScoreGauge({ label, value, max, offset, circumference, color, bg, sub }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 card-shadow flex flex-col items-center gap-2">
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">{label}</p>
      <div className="relative w-24 h-24">
        <svg width="96" height="96" viewBox="0 0 96 96">
          <circle cx="48" cy="48" r="45" fill="none" stroke={bg} strokeWidth="8" />
          <motion.circle cx="48" cy="48" r="45" fill="none" stroke={color} strokeWidth="8"
            strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
            style={{ transformOrigin: '48px 48px', transform: 'rotate(-90deg)' }}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-black" style={{ color }}>{value}</span>
          <span className="text-[9px] text-slate-400 font-medium">{max}</span>
        </div>
      </div>
      <p className="text-xs text-slate-400">{sub}</p>
    </div>
  );
}
