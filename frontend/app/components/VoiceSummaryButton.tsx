'use client';

import React, { useState, useEffect } from 'react';
import { Volume2, Square, AlertCircle } from 'lucide-react';

interface VoiceButtonProps {
  abnormalCount?: number;
  summary?: string;
  specialistName?: string;
}

function buildSummaryText({ abnormalCount, summary, specialistName }: VoiceButtonProps): string {
  const briefingSummary = summary || 'Your tested health metrics have been processed.';
  const recommendedDoctor = specialistName || 'General Physician';

  const needsAttention = (abnormalCount ?? 0) > 0;

  const greeting = needsAttention
    ? 'Your latest report has been processed, and some values need attention.'
    : 'Your latest report has been analyzed, and the extracted values appear stable.';

  const nextStep = needsAttention
    ? `The system recommends consulting a ${recommendedDoctor} for formal review.`
    : `For routine tracking, you may consult a ${recommendedDoctor}.`;

  return `${greeting} ${briefingSummary} ${nextStep}`;
}

export const VoiceSummaryButton: React.FC<VoiceButtonProps> = ({ abnormalCount, summary, specialistName }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [supported, setSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && !window.speechSynthesis) {
      setSupported(false);
    }
  }, []);

  const handleSpeak = () => {
    if (isPlaying) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      return;
    }

    setError(null);

    try {
      const summaryText = buildSummaryText({ abnormalCount, summary, specialistName });
      const utterance = new SpeechSynthesisUtterance(summaryText);
      const voices = window.speechSynthesis.getVoices();
      const premiumVoice = voices.find((voice) =>
        voice.name.includes('Google US English') ||
        voice.name.includes('Samantha') ||
        voice.lang === 'en-US'
      );

      if (premiumVoice) utterance.voice = premiumVoice;
      utterance.rate = 0.93;
      utterance.pitch = 1.02;

      utterance.onstart = () => setIsPlaying(true);
      utterance.onend = () => setIsPlaying(false);
      utterance.onerror = () => {
        setIsPlaying(false);
        setError("Couldn't play audio. Try again.");
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error('Voice summary failed:', err);
      setIsPlaying(false);
      setError("Couldn't generate the summary.");
    }
  };

  if (!supported) return null;

  return (
    <div className="w-full">
      <button
        onClick={handleSpeak}
        className={`w-full flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-[13px] font-bold font-display tracking-tight transition-all outline-none ${
          isPlaying
            ? 'bg-red-50 text-red-600 border-red-200 animate-pulse'
            : 'bg-white border-teal-500/20 text-teal-700 hover:bg-teal-50 hover:border-teal-500/40'
        }`}
      >
        {isPlaying ? (
          <Square className="w-4 h-4 fill-current" />
        ) : (
          <Volume2 className="w-4 h-4" />
        )}

        {isPlaying ? 'Stop Listening' : 'Listen to AI Summary'}
      </button>

      {error && (
        <p className="mt-1.5 flex items-center gap-1 text-[11.5px] font-medium text-red-600">
          <AlertCircle size={12} /> {error}
        </p>
      )}
    </div>
  );
};
