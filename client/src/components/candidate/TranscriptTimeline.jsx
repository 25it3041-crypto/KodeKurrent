import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Brain, User } from 'lucide-react';
import useStore from '../../lib/store';

export default function TranscriptTimeline() {
  const transcript = useStore(s => s.transcript);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-3 py-2.5 border-b border-slate-100 flex items-center gap-2">
        <MessageSquare className="w-3.5 h-3.5 text-indigo-500" />
        <span className="text-xs font-semibold text-slate-700">Live Transcript</span>
        <span className="ml-auto text-[10px] text-slate-400">{transcript.length} entries</span>
      </div>
      <div className="max-h-48 overflow-y-auto p-3 space-y-2">
        {transcript.length === 0 ? (
          <p className="text-[11px] text-slate-400 italic text-center py-4">Interview transcript will appear here...</p>
        ) : (
          transcript.map((entry, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: entry.role === 'ai' ? -10 : 10 }}
              animate={{ opacity: 1, x: 0 }}
              className={`flex gap-2 ${entry.role === 'candidate' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center
                ${entry.role === 'ai' ? 'bg-indigo-100' : 'bg-emerald-100'}`}>
                {entry.role === 'ai'
                  ? <Brain className="w-3 h-3 text-indigo-600" />
                  : <User className="w-3 h-3 text-emerald-600" />}
              </div>
              <div className={`max-w-[80%] rounded-xl px-2.5 py-1.5 text-[11px] leading-relaxed
                ${entry.role === 'ai'
                  ? 'bg-indigo-50 text-indigo-900'
                  : 'bg-emerald-50 text-emerald-900'}`}>
                <p>{entry.text}</p>
                <p className={`text-[9px] mt-0.5 opacity-60 ${entry.role === 'candidate' ? 'text-right' : ''}`}>
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </motion.div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
