import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, CheckCircle, X, Loader2, Tag } from 'lucide-react';
import { parseResume } from '../../lib/api';
import useStore from '../../lib/store';

export default function ResumeUploader({ onParsed }) {
  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const setResumeData = useStore(s => s.setResumeData);

  const onDrop = useCallback(async (accepted) => {
    const f = accepted[0];
    if (!f) return;
    setFile(f);
    setError('');
    setParsing(true);

    try {
      const form = new FormData();
      form.append('resume', f);
      const res = await parseResume(form);
      const data = res.data;
      setResult(data);
      setResumeData(data);
      if (onParsed) onParsed(data);
    } catch (e) {
      setError('Failed to parse resume. Try a text or PDF file.');
      console.error(e);
    } finally {
      setParsing(false);
    }
  }, [onParsed, setResumeData]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
    },
    maxFiles: 1,
  });

  return (
    <div className="space-y-3">
      {!result ? (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
            isDragActive
              ? 'border-indigo-400 bg-indigo-50'
              : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/30'
          }`}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-3">
            {parsing ? (
              <>
                <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
                <p className="text-sm font-medium text-indigo-600">Parsing resume with AI...</p>
              </>
            ) : (
              <>
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center">
                  <Upload className="w-7 h-7 text-indigo-500" />
                </div>
                <div>
                  <p className="font-semibold text-slate-700">
                    {isDragActive ? 'Drop your resume here' : 'Drag & drop your resume'}
                  </p>
                  <p className="text-sm text-slate-400 mt-0.5">PDF, DOCX, or TXT — max 10MB</p>
                </div>
                <span className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors">
                  Browse Files
                </span>
              </>
            )}
          </div>
          {error && <p className="mt-3 text-sm text-rose-500">{error}</p>}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
              <span className="font-semibold text-slate-800">Resume Parsed Successfully</span>
            </div>
            <button
              onClick={() => { setResult(null); setFile(null); setResumeData(null); }}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* File info */}
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <FileText className="w-4 h-4" />
            <span>{file?.name}</span>
          </div>

          {/* Extracted Skills */}
          {result.skills?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Detected Skills</p>
              <div className="flex flex-wrap gap-1.5">
                {result.skills.map(s => (
                  <span key={s} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                    <Tag className="w-3 h-3" />
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Experience */}
          {result.experience?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Experience Mentions</p>
              <div className="flex flex-wrap gap-2">
                {result.experience.map((e, i) => (
                  <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100">{e}</span>
                ))}
              </div>
            </div>
          )}

          {/* Education */}
          {result.education?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Education</p>
              <div className="flex flex-wrap gap-2">
                {result.education.map((e, i) => (
                  <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-violet-50 text-violet-700 border border-violet-100">{e}</span>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
