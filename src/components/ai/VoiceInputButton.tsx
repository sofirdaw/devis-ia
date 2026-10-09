/**
 * VoiceInputButton — Bouton de dictée vocale
 *
 * Utilise la Web Speech API native du navigateur (pas d'appel IA pour la
 * transcription — c'est gratuit et instantané). Le texte transcrit est
 * ensuite envoyé au même pipeline que la saisie texte classique.
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";

// Types minimaux pour l'API Web Speech
interface SpeechRecognitionResult {
  transcript: string;
}
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: SpeechRecognitionResult }>;
}
interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
}

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

type WindowWithSpeech = {
  SpeechRecognition?: new () => SpeechRecognitionInstance;
  webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
};

function getSpeechRecognitionAPI(): (new () => SpeechRecognitionInstance) | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as WindowWithSpeech;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export function VoiceInputButton({ onTranscript, disabled }: VoiceInputButtonProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const onTranscriptRef = useRef(onTranscript);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    const SpeechRecognitionAPI = getSpeechRecognitionAPI();

    if (!SpeechRecognitionAPI) {
      return;
    }

    const supportTimer = window.setTimeout(() => setIsSupported(true), 0);

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = "fr-FR";
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = getFinalSpeechTranscript(event);
      if (transcript) onTranscriptRef.current(transcript);
    };

    recognition.onerror = (event) => {
      setError(`La reconnaissance vocale a échoué (${event.type}). Réessayez.`);
      setIsListening(false);
    };
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;

    return () => {
      window.clearTimeout(supportTimer);
      recognition.stop();
    };
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setError(null);
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  if (!isSupported) return null;

  return (
    <>
      <button
        type="button"
        onClick={toggleListening}
        disabled={disabled}
        className={cn(
          "flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-colors disabled:opacity-50",
          isListening
            ? "bg-red-100 text-red-700 animate-pulse"
            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
        )}
      >
        {isListening ? <MicOff size={13} /> : <Mic size={13} />}
        {isListening ? "Écoute en cours..." : "Dicter à la voix"}
      </button>
      {error && (
        <span role="alert" className="text-xs text-red-600">
          {error}
        </span>
      )}
    </>
  );
}

export function getFinalSpeechTranscript(
  event: Pick<SpeechRecognitionEvent, "results" | "resultIndex">
): string {
  const chunks: string[] = [];
  for (let index = event.resultIndex; index < event.results.length; index += 1) {
    const result = event.results[index];
    if (result?.isFinal && result[0]?.transcript.trim()) {
      chunks.push(result[0].transcript.trim());
    }
  }
  return chunks.join(" ");
}
