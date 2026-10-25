import React, { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';

export default function PDFReportExport({ data, recommendation }) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!data) return;
    setExporting(true);

    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 15;
      const contentW = pageW - 2 * margin;
      let y = margin;

      const ensureSpace = (needed = 20) => {
        if (y + needed > pageH - 18) {
          doc.addPage();
          y = margin;
        }
      };

      const safeText = (value, fallback = 'N/A') => {
        if (value === null || value === undefined || value === '') return fallback;
        return String(value);
      };

      // ── Header Banner ───────────────────────────────────────────────────────
      doc.setFillColor(79, 70, 229); // Indigo 600
      doc.rect(0, 0, pageW, 35, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('HireAI — Candidate Evaluation Report', margin, 18);
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generated: ${new Date().toLocaleString()}`, margin, 26);
      doc.text('Confidential — HR Evaluation Document', pageW - margin, 26, { align: 'right' });

      y = 45;

      // ── Candidate Information ───────────────────────────────────────────────
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('Candidate Overview', margin, y);
      y += 5;

      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.4);
      doc.line(margin, y, pageW - margin, y);
      y += 6;

      const formattedDate = data.submittedAt && !isNaN(new Date(data.submittedAt)) 
        ? new Date(data.submittedAt).toLocaleDateString() 
        : new Date().toLocaleDateString();

      const candidateInfo = [
        ['Candidate Name:', safeText(data.name)],
        ['Email Address:', safeText(data.email)],
        ['Job Role:', safeText(data.jobTitle)],
        ['Experience:', safeText(data.experienceLevel)],
        ['Submission Date:', formattedDate],
      ];

      doc.setFontSize(9);
      candidateInfo.forEach(([label, val]) => {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(71, 85, 105);
        doc.text(label, margin, y);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(15, 23, 42);
        doc.text(String(val), margin + 35, y);
        y += 6;
      });

      y += 4;

      // ── Score & Metrics Boxes ────────────────────────────────────────────────
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('Performance Summary', margin, y);
      y += 5;
      doc.line(margin, y, pageW - margin, y);
      y += 6;

      const finalRec = recommendation || data.aiReport?.recommendation || 'HOLD';
      const confidence = data.confidenceIndex ?? Math.round(((Number(data.avgScore || 0)/5)*60) + (((data.trustScore??100)/100)*40));

      const boxes = [
        { label: 'Avg Score', value: `${data.avgScore || '0.00'}/5`, color: [79, 70, 229] },
        { label: 'Trust Score', value: `${data.trustScore ?? 100}%`, color: [16, 185, 129] },
        { label: 'AI Confidence', value: `${confidence}%`, color: [14, 165, 233] },
        { label: 'Recommendation', value: finalRec, color: finalRec === 'HIRE' ? [16, 185, 129] : finalRec === 'REJECT' ? [225, 29, 72] : [245, 158, 11] },
      ];

      const boxW = (contentW - 9) / 4;
      boxes.forEach((box, i) => {
        const bx = margin + i * (boxW + 3);
        doc.setFillColor(...box.color);
        doc.roundedRect(bx, y, boxW, 18, 2, 2, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(String(box.value), bx + boxW / 2, y + 9, { align: 'center' });
        
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'normal');
        doc.text(box.label, bx + boxW / 2, y + 15, { align: 'center' });
      });

      y += 26;

      // ── AI Executive Summary ───────────────────────────────────────────────
      if (data.aiReport) {
        const report = data.aiReport;
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text('AI Executive Summary', margin, y);
        y += 5;
        doc.line(margin, y, pageW - margin, y);
        y += 6;

        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 65, 85);

        const summaryText = doc.splitTextToSize(report.executiveSummary || 'Evaluation completed successfully.', contentW);
        ensureSpace(summaryText.length * 4.5 + 8);
        doc.text(summaryText, margin, y);
        y += summaryText.length * 4.5 + 4;

        // Key Strengths
        if (report.strengths && report.strengths.length > 0) {
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(16, 185, 129);
          doc.text('Key Strengths:', margin, y);
          y += 4;

          doc.setFont('helvetica', 'normal');
          doc.setTextColor(30, 41, 59);
          report.strengths.forEach(s => {
            const lines = doc.splitTextToSize(`• ${s}`, contentW - 5);
            doc.text(lines, margin + 2, y);
            y += lines.length * 4;
          });
          y += 2;
        }

        if (report.knowledgeGaps && report.knowledgeGaps.length > 0) {
          ensureSpace(16);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(225, 29, 72);
          doc.text('Knowledge Gaps:', margin, y);
          y += 4;

          doc.setFont('helvetica', 'normal');
          doc.setTextColor(30, 41, 59);
          report.knowledgeGaps.forEach(g => {
            const lines = doc.splitTextToSize(`• ${g}`, contentW - 5);
            ensureSpace(lines.length * 4 + 2);
            doc.text(lines, margin + 2, y);
            y += lines.length * 4;
          });
          y += 2;
        }

        // Key Concerns
        if (report.concerns && report.concerns.length > 0) {
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(225, 29, 72);
          doc.text('Areas of Concern:', margin, y);
          y += 4;

          doc.setFont('helvetica', 'normal');
          doc.setTextColor(30, 41, 59);
          report.concerns.forEach(c => {
            const lines = doc.splitTextToSize(`• ${c}`, contentW - 5);
            doc.text(lines, margin + 2, y);
            y += lines.length * 4;
          });
          y += 2;
        }

        y += 4;
      }

      // ── Questions & Answers Evaluation Breakdown ─────────────────────────────
      ensureSpace(24);

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('Question Evaluation Breakdown', margin, y);
      y += 5;
      doc.line(margin, y, pageW - margin, y);
      y += 6;

      const questionsList = data.questions || [];
      questionsList.forEach((q, i) => {
        ensureSpace(18);

        const qText = typeof q === 'string' ? q : (q.text || `Question ${i + 1}`);
        const ev = data.evaluations?.[i] || {};
        const scoreVal = ev.hrOverrideScore ?? ev.score ?? 0;

        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);

        const qLines = doc.splitTextToSize(`Q${i + 1}: ${qText}`, contentW - 20);
        doc.text(qLines, margin, y);

        // Score Pill
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(79, 70, 229);
        doc.text(`Score: ${scoreVal}/5`, pageW - margin, y, { align: 'right' });

        y += qLines.length * 4 + 2;

        // Feedback / Key Points
        if (ev.feedback) {
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(71, 85, 105);
          const fbLines = doc.splitTextToSize(`Feedback: ${ev.feedback}`, contentW - 5);
          doc.text(fbLines, margin + 3, y);
          y += fbLines.length * 3.8 + 2;
        }

        y += 3;
      });

      // ── Proctoring & Audit Summary ──────────────────────────────────────────
      const proctorEvents = data.proctorEvents || [];
      if (proctorEvents.length > 0) {
        ensureSpace(24);

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(`Proctoring Logs (${proctorEvents.length} Incidents)`, margin, y);
        y += 5;
        doc.line(margin, y, pageW - margin, y);
        y += 6;

        proctorEvents.slice(0, 8).forEach((evt) => {
          ensureSpace(8);

          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(71, 85, 105);

          const timeStr = evt.timestamp ? new Date(evt.timestamp).toLocaleTimeString() : 'Log';
          const eventLabel = evt.label || evt.type?.replace(/_/g, ' ') || 'Proctor Event';
          const evidence = evt.evidence ? ` — ${evt.evidence}` : '';
          const logLine = `• [${timeStr}] ${eventLabel} (${evt.severity || 'medium'})${evidence}`;

          doc.text(logLine, margin + 2, y);
          y += 4.5;
        });
      }

      // ── Footer ──────────────────────────────────────────────────────────────
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `HireAI Automated Assessment Report — Page ${i} of ${pageCount}`,
          pageW / 2,
          290,
          { align: 'center' }
        );
      }

      doc.save(`HireAI_Report_${(data.name || 'Candidate').replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error('[PDF Export Error]:', err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={exporting}
      className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-all disabled:opacity-60 shadow-sm cursor-pointer"
    >
      {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" /> : <Download className="w-3.5 h-3.5" />}
      {exporting ? 'Generating PDF...' : 'Export PDF'}
    </button>
  );
}