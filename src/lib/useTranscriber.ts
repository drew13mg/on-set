import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { makeId, type TranscriptLine } from "./clips";

export type TranscriberStatus = "idle" | "starting" | "listening" | "error";

// Errors that just mean "nobody spoke for a while" — on set that's normal, so we
// quietly restart instead of stopping the transcript.
const RECOVERABLE_ERRORS = new Set(["no-speech", "speech-timeout", "network", "busy", "client"]);

/**
 * Live speech-to-text that keeps running until the user taps Stop.
 * Recognizers on both platforms end sessions on their own (silence, time limits),
 * so this hook restarts them automatically while `wantsListening` is true.
 */
export function useTranscriber(lang = "en-US") {
  const [status, setStatus] = useState<TranscriberStatus>("idle");
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);

  const interimRef = useRef("");
  const wantsListening = useRef(false);
  const restartTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startRecognizer = useCallback(() => {
    ExpoSpeechRecognitionModule.start({
      lang,
      interimResults: true,
      continuous: true,
      maxAlternatives: 1,
      addsPunctuation: true,
      // Keep audio on the phone where the device supports it (no network needed on set).
      requiresOnDeviceRecognition: Platform.OS === "ios",
      iosTaskHint: "dictation",
      iosCategory: {
        category: "playAndRecord",
        categoryOptions: ["defaultToSpeaker", "allowBluetooth"],
        mode: "measurement",
      },
    });
  }, [lang]);

  const scheduleRestart = useCallback(() => {
    if (!wantsListening.current) return;
    if (restartTimer.current) clearTimeout(restartTimer.current);
    restartTimer.current = setTimeout(() => {
      if (wantsListening.current) startRecognizer();
    }, 250);
  }, [startRecognizer]);

  useSpeechRecognitionEvent("start", () => {
    setStatus("listening");
    setError(null);
  });

  useSpeechRecognitionEvent("result", (event) => {
    const text = event.results[0]?.transcript ?? "";
    if (event.isFinal) {
      if (text.trim()) {
        setLines((ls) => [...ls, { id: makeId(), text: text.trim(), at: Date.now() }]);
      }
      interimRef.current = "";
      setInterim("");
    } else {
      interimRef.current = text;
      setInterim(text);
    }
  });

  useSpeechRecognitionEvent("error", (event) => {
    if (RECOVERABLE_ERRORS.has(event.error) && wantsListening.current) return; // "end" follows and restarts
    wantsListening.current = false;
    setStatus("error");
    setError(
      event.error === "not-allowed"
        ? "Microphone or speech recognition access is off. Turn it on for ON SET in Settings."
        : event.message || event.error,
    );
  });

  useSpeechRecognitionEvent("end", () => {
    // Keep any words that never got a final result before the session ended.
    const pending = interimRef.current.trim();
    if (pending) {
      setLines((ls) => [...ls, { id: makeId(), text: pending, at: Date.now() }]);
    }
    interimRef.current = "";
    setInterim("");
    if (wantsListening.current) {
      scheduleRestart();
    } else {
      setStatus((s) => (s === "error" ? s : "idle"));
    }
  });

  const start = useCallback(async () => {
    setError(null);
    setStatus("starting");
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) {
      setStatus("error");
      setError("ON SET needs microphone and speech recognition access to transcribe.");
      return;
    }
    wantsListening.current = true;
    startRecognizer();
  }, [startRecognizer]);

  const stop = useCallback(() => {
    wantsListening.current = false;
    if (restartTimer.current) clearTimeout(restartTimer.current);
    ExpoSpeechRecognitionModule.stop();
  }, []);

  const clear = useCallback(() => {
    interimRef.current = "";
    setLines([]);
    setInterim("");
  }, []);

  useEffect(
    () => () => {
      wantsListening.current = false;
      if (restartTimer.current) clearTimeout(restartTimer.current);
      ExpoSpeechRecognitionModule.abort();
    },
    [],
  );

  return {
    status,
    isLive: status === "listening" || status === "starting",
    lines,
    interim,
    error,
    start,
    stop,
    clear,
  };
}
