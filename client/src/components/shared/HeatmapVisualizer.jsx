import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Eye } from 'lucide-react';
import useStore from '../../lib/store';

export default function HeatmapVisualizer() {
  const gazePoints = useStore(s => s.gazePoints);
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Draw subtle grid
    ctx.strokeStyle = 'rgba(226,232,240,0.4)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= w; x += w / 4) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y <= h; y += h / 4) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // Draw heatmap points
    const recent = gazePoints.slice(-150);
    recent.forEach((pt, i) => {
      const x = (pt.x / 100) * w;
      const y = (pt.y / 100) * h;
      const age = i / recent.length;
      const r = 8 + age * 4;

      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, `rgba(99,102,241,${0.15 * age})`);
      grad.addColorStop(1, 'rgba(99,102,241,0)');
      ctx.beginPath();
      ctx.fillStyle = grad;
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw most recent point
    if (recent.length > 0) {
      const last = recent[recent.length - 1];
      const lx = (last.x / 100) * w;
      const ly = (last.y / 100) * h;
      ctx.beginPath();
      ctx.arc(lx, ly, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#6366F1';
      ctx.fill();
    }
  }, [gazePoints]);

  // Zone labels
  const zones = [
    { label: 'TL', x: '10%', y: '10%' }, { label: 'TC', x: '50%', y: '10%' },
    { label: 'TR', x: '90%', y: '10%' }, { label: 'BL', x: '10%', y: '90%' },
    { label: 'BC', x: '50%', y: '90%' }, { label: 'BR', x: '90%', y: '90%' },
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-3 py-2.5 border-b border-slate-100 flex items-center gap-2">
        <Eye className="w-3.5 h-3.5 text-violet-500" />
        <span className="text-xs font-semibold text-slate-700">Gaze Heatmap</span>
        <span className="ml-auto text-[10px] text-slate-400">{gazePoints.length} pts</span>
      </div>
      <div className="p-3">
        <div className="relative">
          <canvas ref={canvasRef} width={240} height={135} className="w-full rounded-lg bg-slate-50 border border-slate-100" />
          {zones.map(z => (
            <span key={z.label} className="absolute text-[8px] text-slate-300 font-bold"
              style={{ left: z.x, top: z.y, transform: 'translate(-50%,-50%)' }}>
              {z.label}
            </span>
          ))}
        </div>
        <p className="text-[10px] text-slate-400 text-center mt-1.5">Mouse/cursor focus zones</p>
      </div>
    </div>
  );
}
