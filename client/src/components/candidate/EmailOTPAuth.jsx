import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail, KeyRound, ArrowRight, RefreshCw, CheckCircle2,
  Loader2, ShieldCheck, AlertCircle, Eye, EyeOff, Sparkles
} from 'lucide-react';
import { sendOTP, verifyOTP } from '../../lib/api';
import useStore from '../../lib/store';

const STEPS = { EMAIL: 'email', OTP: 'otp', VERIFIED: 'verified' };

export default function EmailOTPAuth({ onVerified }) {
  const [step, setStep] = useState(STEPS.EMAIL);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const [devOtp, setDevOtp] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const inputRefs = useRef([]);
  const timerRef = useRef(null);
  const { setAuthenticated, setCandidate } = useStore();

  // Countdown timer for resend
  useEffect(() => {
    if (resendTimer > 0) {
      timerRef.current = setTimeout(() => setResendTimer(t => t - 1), 1000);
    }
    return () => clearTimeout(timerRef.current);
  }, [resendTimer]);

  // Auto-focus first OTP box when reaching OTP step
  useEffect(() => {
    if (step === STEPS.OTP) {
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [step]);

  const handleSendOTP = async (e) => {
    e?.preventDefault();
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await sendOTP(email.trim().toLowerCase());
      setDevOtp(res.data.devOtp || '');
      setPreviewUrl(res.data.previewUrl || '');
      setStep(STEPS.OTP);
      setResendTimer(60);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOTPInput = (i, val) => {
    const digits = val.replace(/\D/g, '').slice(0, 1);
    const next = [...otp];
    next[i] = digits;
    setOtp(next);
    setError('');
    if (digits && i < 5) inputRefs.current[i + 1]?.focus();
    // Auto-submit when all filled
    if (next.every(d => d) && next.join('').length === 6) {
      handleVerifyOTP(next.join(''));
    }
  };

  const handleOTPKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) {
      inputRefs.current[i - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && i > 0) inputRefs.current[i - 1]?.focus();
    if (e.key === 'ArrowRight' && i < 5) inputRefs.current[i + 1]?.focus();
  };

  const handleOTPPaste = (e) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (text.length === 6) {
      const digits = text.split('');
      setOtp(digits);
      inputRefs.current[5]?.focus();
      handleVerifyOTP(text);
    }
    e.preventDefault();
  };

  const handleVerifyOTP = async (code) => {
    const otpCode = code || otp.join('');
    if (otpCode.length !== 6) { setError('Please enter the 6-digit code'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await verifyOTP(email.trim().toLowerCase(), otpCode);
      setAuthenticated(email, res.data.sessionToken);
      setCandidate({ email: email.trim().toLowerCase() });
      setStep(STEPS.VERIFIED);
      setTimeout(() => onVerified?.(email, res.data.sessionToken), 1200);
    } catch (err) {
      const msg = err.response?.data?.error || 'Incorrect code. Please try again.';
      const left = err.response?.data?.attemptsLeft;
      setError(msg + (left ? ` (${left} attempts left)` : ''));
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen gradient-canvas flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Brand */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center gap-2.5 mb-4">
            <div className="w-11 h-11 rounded-2xl gradient-indigo flex items-center justify-center shadow-lg shadow-indigo-200">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div className="text-left">
              <p className="font-black text-slate-900 text-xl leading-none">HireAI</p>
              <p className="text-[11px] text-slate-400 mt-0.5">AI Interview Platform</p>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1.5">Candidate Verification</h1>
          <p className="text-sm text-slate-500">Secure your interview session with email OTP</p>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white border border-slate-200 rounded-2xl card-shadow-lg overflow-hidden"
        >
          {/* Step indicator */}
          <div className="px-6 pt-5 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              {[
                { id: STEPS.EMAIL, label: 'Email', num: 1 },
                { id: STEPS.OTP,   label: 'Verify', num: 2 },
                { id: STEPS.VERIFIED, label: 'Access', num: 3 },
              ].map((s, i, arr) => (
                <React.Fragment key={s.id}>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-all ${
                      step === s.id ? 'gradient-indigo text-white shadow-sm' :
                      (step === STEPS.OTP && i === 0) || step === STEPS.VERIFIED
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-400'
                    }`}>
                      {((step === STEPS.OTP && i === 0) || step === STEPS.VERIFIED) && i < arr.indexOf(arr.find(x => x.id === step))
                        ? <CheckCircle2 className="w-3.5 h-3.5" />
                        : s.num}
                    </div>
                    <span className={`text-xs font-medium ${step === s.id ? 'text-indigo-700' : 'text-slate-400'}`}>{s.label}</span>
                  </div>
                  {i < arr.length - 1 && <div className="flex-1 h-px bg-slate-100" />}
                </React.Fragment>
              ))}
            </div>
          </div>

          <AnimatePresence mode="wait">
            {/* ─── Step 1: Email ─────────────────────────────────────────── */}
            {step === STEPS.EMAIL && (
              <motion.div key="email" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="p-6">
                <div className="mb-5">
                  <h2 className="font-bold text-slate-800 text-lg mb-0.5">Enter your email</h2>
                  <p className="text-sm text-slate-500">We'll send a 6-digit verification code</p>
                </div>
                <form onSubmit={handleSendOTP} className="space-y-4">
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={e => { setEmail(e.target.value); setError(''); }}
                      placeholder="candidate@example.com"
                      className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 text-slate-900 placeholder:text-slate-400 bg-slate-50 focus:bg-white transition-colors"
                      autoFocus
                    />
                  </div>
                  {error && <ErrorMsg msg={error?.message || JSON.stringify(error)}/>}
                  <motion.button
                    type="submit"
                    disabled={loading || !email.trim()}
                    whileTap={{ scale: 0.98 }}
                    className="w-full py-3.5 gradient-indigo text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {loading
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending OTP...</>
                      : <><ArrowRight className="w-4 h-4" /> Send Verification Code</>}
                  </motion.button>
                </form>
              </motion.div>
            )}

            {/* ─── Step 2: OTP ───────────────────────────────────────────── */}
            {step === STEPS.OTP && (
              <motion.div key="otp" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="p-6">
                <div className="mb-5">
                  <h2 className="font-bold text-slate-800 text-lg mb-0.5">Check your inbox</h2>
                  <p className="text-sm text-slate-500">
                    We sent a 6-digit code to <strong className="text-slate-700">{email}</strong>
                  </p>
                </div>

                {/* Ethereal dev notice */}
                {previewUrl && (
                  <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <p className="text-xs font-semibold text-amber-700 mb-1">🔧 Development Mode — Ethereal SMTP</p>
                    <p className="text-xs text-amber-600 mb-1.5">
                      No real email sent. View your OTP email at:
                    </p>
                    <a href={previewUrl} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-indigo-600 underline font-mono break-all">
                      {previewUrl}
                    </a>
                    {devOtp && (
                      <p className="mt-2 text-xs font-bold text-amber-800">
                        Dev OTP: <span className="font-mono tracking-widest text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">{devOtp}</span>
                      </p>
                    )}
                  </div>
                )}

                {/* 6-box OTP Input */}
                <div className="flex gap-2.5 justify-center mb-5" onPaste={handleOTPPaste}>
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={el => inputRefs.current[i] = el}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={e => handleOTPInput(i, e.target.value)}
                      onKeyDown={e => handleOTPKeyDown(i, e)}
                      className={`w-12 h-14 text-center text-xl font-bold border-2 rounded-xl outline-none transition-all
                        ${digit ? 'border-indigo-400 bg-indigo-50 text-indigo-800' : 'border-slate-200 bg-white text-slate-900'}
                        focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100`}
                    />
                  ))}
                </div>

                {error && <ErrorMsg msg={error?.message || JSON.stringify(error)}/>}

                <motion.button
                  onClick={() => handleVerifyOTP()}
                  disabled={loading || otp.join('').length !== 6}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-3.5 gradient-indigo text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed mb-4"
                >
                  {loading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</>
                    : <><KeyRound className="w-4 h-4" /> Verify & Enter Interview</>}
                </motion.button>

                <div className="flex items-center justify-between text-sm">
                  <button
                    onClick={() => { setStep(STEPS.EMAIL); setOtp(['','','','','','']); setError(''); }}
                    className="text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    ← Change email
                  </button>
                  {resendTimer > 0 ? (
                    <span className="text-slate-400">Resend in {resendTimer}s</span>
                  ) : (
                    <button
                      onClick={handleSendOTP}
                      disabled={loading}
                      className="flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Resend Code
                    </button>
                  )}
                </div>
              </motion.div>
            )}

            {/* ─── Step 3: Verified ──────────────────────────────────────── */}
            {step === STEPS.VERIFIED && (
              <motion.div
                key="verified"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-8 text-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', bounce: 0.5, delay: 0.1 }}
                  className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4"
                >
                  <CheckCircle2 className="w-9 h-9 text-emerald-600" />
                </motion.div>
                <h3 className="text-xl font-bold text-slate-900 mb-1.5">Identity Verified!</h3>
                <p className="text-sm text-slate-500 mb-2">
                  Welcome, <strong className="text-slate-700">{email}</strong>
                </p>
                <p className="text-xs text-indigo-500 flex items-center justify-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Entering interview portal...
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Security badge */}
          <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            End-to-end encrypted · OTP valid for 10 minutes · Max 5 attempts
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function ErrorMsg({ msg }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700"
    >
      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
      {msg}
    </motion.div>
  );
}
