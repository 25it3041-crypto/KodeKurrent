import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Target, Building2, Zap, Wifi, WifiOff, Clock } from 'lucide-react';
import useStore from '../../lib/store';

export default function Header() {
  const { activePortal, setPortal, isAuthenticated, authEmail, interviewPhase } = useStore();
  const [time, setTime] = useState(new Date());
  const [online, setOnline] = useState(navigator.onLine);
  const isLive = interviewPhase === 'interview';

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => { clearInterval(t); window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, []);

  const fmt = time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <header className="glass border-b border-slate-200/80 sticky top-0 z-50">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 h-15 flex items-center justify-between gap-3" style={{ height: 60 }}>

        {/* Brand */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div className="relative w-9 h-9 rounded-xl gradient-indigo flex items-center justify-center shadow-md">
            <Brain className="w-5 h-5 text-white" />
            {isLive && (
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 border-2 border-white recording-dot" />
            )}
          </div>
          <div className="hidden sm:block">
            <p className="font-black text-slate-900 text-base leading-none tracking-tight">HireAI</p>
            <p className="text-[10px] text-slate-400 leading-none mt-0.5">Autonomous Interview Platform</p>
          </div>
        </div>

        {/* Portal Switcher — pill style */}
        <div className="flex-1 flex justify-center">
          <div className="relative flex items-center bg-slate-100 rounded-xl p-1 gap-0">
            {/* Sliding background */}
            <motion.div
              className="absolute top-1 bottom-1 rounded-lg bg-white shadow-sm border border-slate-200"
              animate={{ left: activePortal === 'candidate' ? 4 : '50%', right: activePortal === 'candidate' ? '50%' : 4 }}
              transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            />
            <PillBtn
              active={activePortal === 'candidate'}
              onClick={() => setPortal('candidate')}
              icon={<Target className="w-3.5 h-3.5" />}
              label="Candidate Terminal"
            />
            <PillBtn
              active={activePortal === 'hr'}
              onClick={() => setPortal('hr')}
              icon={<Building2 className="w-3.5 h-3.5" />}
              label="HR Command Center"
            />
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Live badge */}
          <AnimatePresence>
            {isLive && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8, x: 10 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-bold"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 recording-dot" />
                LIVE INTERVIEW
              </motion.span>
            )}
          </AnimatePresence>

          {/* Clock */}
          <div className="hidden md:flex items-center gap-1 text-xs text-slate-400 font-mono">
            <Clock className="w-3 h-3" />
            {fmt}
          </div>

          {/* Connection */}
          <div className={`w-2 h-2 rounded-full ${online ? 'bg-emerald-400' : 'bg-rose-400'}`}
            title={online ? 'Connected' : 'Offline'} />

          {/* Auth chip */}
          {isAuthenticated ? (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold max-w-32">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="truncate">{authEmail?.split('@')[0]}</span>
            </span>
          ) : (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-400 text-[11px] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
              Guest
            </span>
          )}
        </div>
      </div>
    </header>
  );
}

function PillBtn({ active, onClick, icon, label }) {
  return (
    <button onClick={onClick}
      className={`relative z-10 flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors duration-200 whitespace-nowrap ${
        active ? 'text-indigo-700' : 'text-slate-500 hover:text-slate-700'
      }`}
    >
      {icon}<span className="hidden sm:inline">{label}</span>
    </button>
  );
}
