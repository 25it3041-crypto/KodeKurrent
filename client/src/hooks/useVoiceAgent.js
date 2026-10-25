import { useEffect, useRef, useState, useCallback } from 'react';
import useStore from '../lib/store';

function getRecognitionCtor() {
  return window.SpeechRecognition || window.webkitSpeechRecognition;
}

export function useVoiceAgent() {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef(null);
  const speakingRef = useRef(false);
  const resumeTimerRef = useRef(null);
  const storeSetListening = useStore(s => s.setIsListening);
  const storeSetSpeaking = useStore(s => s.setIsSpeaking);

  const stopListening = useCallback(() => {
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    if (rec) {
      try { rec.onresult = null; rec.onend = null; rec.onerror = null; rec.stop(); } catch { /* already stopped */ }
    }
    setIsListening(false);
    storeSetListening(false);
  }, [storeSetListening]);

  const stopSpeaking = useCallback(() => {
    if (resumeTimerRef.current) {
      clearInterval(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
    try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
    speakingRef.current = false;
    setIsSpeaking(false);
    storeSetSpeaking(false);
  }, [storeSetSpeaking]);

  const speak = useCallback((text, onEnd) => {
    if (!text || !('speechSynthesis' in window)) {
      if (onEnd) onEnd();
      return;
    }

    stopListening();
    window.speechSynthesis.cancel();

    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 0.95;
    utt.pitch = 1.0;
    utt.volume = 1;

    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v =>
      v.lang === 'en-US' && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Neural'))
    ) || voices.find(v => v.lang?.startsWith('en'));
    if (preferred) utt.voice = preferred;

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      if (resumeTimerRef.current) {
        clearInterval(resumeTimerRef.current);
        resumeTimerRef.current = null;
      }
      speakingRef.current = false;
      setIsSpeaking(false);
      storeSetSpeaking(false);
      if (onEnd) onEnd();
    };

    utt.onstart = () => {
      speakingRef.current = true;
      setIsSpeaking(true);
      storeSetSpeaking(true);
    };
    utt.onend = finish;
    utt.onerror = finish;

    speakingRef.current = true;
    setIsSpeaking(true);
    storeSetSpeaking(true);
    window.speechSynthesis.speak(utt);

    // Chrome can freeze speechSynthesis in the paused state; keep it alive.
    if (resumeTimerRef.current) clearInterval(resumeTimerRef.current);
    resumeTimerRef.current = setInterval(() => {
      if (!speakingRef.current) return;
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();
    }, 250);
  }, [stopListening, storeSetSpeaking]);

  const startListening = useCallback((onResult, onEnd) => {
    const SR = getRecognitionCtor();
    if (!SR) {
      console.warn('Speech Recognition not supported');
      return;
    }
    if (speakingRef.current) {
      window.speechSynthesis.cancel();
      speakingRef.current = false;
    }

    stopListening();

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    let finalTranscript = '';
    let silenceTimer = null;

    recognition.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          finalTranscript += e.results[i][0].transcript + ' ';
        } else {
          interim += e.results[i][0].transcript;
        }
      }
      const combined = (finalTranscript + interim).trim();
      setTranscript(combined);
      if (onResult) onResult(combined, finalTranscript);

      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => {
        try { recognition.stop(); } catch { /* ignore */ }
      }, 3000);
    };

    recognition.onstart = () => {
      setIsListening(true);
      storeSetListening(true);
      setTranscript('');
    };

    recognition.onend = () => {
      if (silenceTimer) clearTimeout(silenceTimer);
      setIsListening(false);
      storeSetListening(false);
      if (onEnd) onEnd(finalTranscript.trim());
    };

    recognition.onerror = (e) => {
      if (e.error === 'aborted' || e.error === 'no-speech') return;
      console.warn('[STT]', e.error);
      setIsListening(false);
      storeSetListening(false);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (err) {
      console.warn('[STT start]', err?.message || err);
    }
  }, [stopListening, storeSetListening]);

  useEffect(() => {
    return () => {
      stopListening();
      stopSpeaking();
    };
  }, [stopListening, stopSpeaking]);

  return { isListening, isSpeaking, transcript, speak, stopSpeaking, startListening, stopListening };
}

export default useVoiceAgent;
