import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "../hooks/useChat";

const getSpeechRecognition = () => {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
};

// Icons
const MicrophoneIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
  </svg>
);
const StopIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
  </svg>
);

export default function SpeechInput({
  lang = "es-BO",
  autoSend = true,
  className = "",
  onTranscriptionChange,
}) {
  const Recognition = useMemo(() => getSpeechRecognition(), []);
  const { chat, loading } = useChat();

  // Reconocimiento + estado
  const recRef = useRef(null);
  const [supported, setSupported] = useState(!!Recognition);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [listening, setListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentLang, setCurrentLang] = useState(lang);
  const [error, setError] = useState("");

  // Texto (refs para evitar cierres obsoletos)
  const interimRef = useRef("");
  const finalRef = useRef("");
  const [, forceRerender] = useState(0); // solo para mostrar interim/final en UI

  // Mostrar texto en UI (derivado de refs)
  const finalText = finalRef.current;
  const interim = interimRef.current;

  // Inicializa recognition UNA sola vez, y actualiza idioma por prop
  useEffect(() => {
    if (!Recognition) return;
    const rec = new Recognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = currentLang;
    recRef.current = rec;

    // --- Handlers ---
    rec.onstart = () => {
      setError("");
      setListening(true);
      setIsProcessing(false);
      interimRef.current = "";
      finalRef.current = "";
      forceRerender((x) => x + 1);
    };

    rec.onerror = (e) => {
      const code = e?.error || "speech_error";
      const friendly = {
        "not-allowed": "Permiso de micrófono denegado",
        "no-speech": "No se detectó voz",
        "audio-capture": "Error de captura de audio",
        network: "Error de conexión",
        "service-not-allowed": "Servicio no permitido",
        "bad-grammar": "Error de gramática",
        "language-not-supported": "Idioma no soportado",
      };
      if (code === "not-allowed") {
        setPermissionDenied(true);
      }
      setError(friendly[code] || `Error: ${code}`);
      setListening(false);
      setIsProcessing(false);
    };

    rec.onresult = (event) => {
      let interimStr = "";
      let finalStr = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) finalStr += r[0]?.transcript || "";
        else interimStr += r[0]?.transcript || "";
      }
      // Acumula en refs
      interimRef.current = interimStr;
      if (finalStr) {
        finalRef.current = (
          (finalRef.current ? finalRef.current + (finalRef.current.endsWith(" ") ? "" : " ") : "") +
          finalStr
        ).trim();
      }
      // Notificación externa
      if (onTranscriptionChange) {
        const currentText = (finalRef.current + (interimRef.current ? ` ${interimRef.current}` : "")).trim();
        onTranscriptionChange(currentText, !!interimRef.current);
      }
      // Refresca UI
      forceRerender((x) => x + 1);
    };

    rec.onend = () => {
      setListening(false);
      // Construye el texto final desde refs (no uses estado aquí)
      const text = (finalRef.current + (interimRef.current ? ` ${interimRef.current}` : "")).trim();
      if (text && autoSend) {
        setIsProcessing(true);
        chat(text);
      }
      // Limpia refs luego de un breve instante (deja ver el texto 1 seg)
      setTimeout(() => {
        interimRef.current = "";
        finalRef.current = "";
        setIsProcessing(false);
        forceRerender((x) => x + 1);
        if (onTranscriptionChange) onTranscriptionChange("", false);
      }, text && autoSend ? 1000 : 0);
    };

    return () => {
      try {
        rec.onstart = rec.onerror = rec.onresult = rec.onend = null;
        rec.stop?.();
      } catch {}
    };
  }, [Recognition, currentLang, autoSend, chat, onTranscriptionChange]);

  useEffect(() => setSupported(!!Recognition), [Recognition]);

  const start = useCallback(async () => {
    if (!recRef.current || listening || loading) return;
    try {
      setError("");
      setPermissionDenied(false);
      recRef.current.lang = currentLang;
      recRef.current.start();
    } catch (e) {
      setError(e?.message || "No se pudo iniciar el micrófono");
    }
  }, [currentLang, listening, loading]);

  const stop = useCallback(() => {
    if (!recRef.current || !listening) return;
    try {
      recRef.current.stop();
    } catch (e) {
      setError(e?.message || "No se pudo detener el micrófono");
    }
  }, [listening]);

  const requestMicrophonePermission = async () => {
    try {
      setError("");
      setIsProcessing(true);
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Navegador sin mediaDevices");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setPermissionDenied(false);
    } catch (err) {
      setPermissionDenied(true);
      setError("No se pudo acceder al micrófono");
    } finally {
      setIsProcessing(false);
    }
  };

  // Push-to-talk con barra espaciadora (ignora inputs/textarea)
  useEffect(() => {
    const isTypingTarget = (el) =>
      el &&
      (el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA" ||
        el.contentEditable === "true");
    const down = (e) => {
      if (e.code !== "Space" || e.repeat) return;
      if (isTypingTarget(document.activeElement)) return;
      e.preventDefault(); e.stopPropagation();
      if (!listening) start();
    };
    const up = (e) => {
      if (e.code !== "Space") return;
      if (isTypingTarget(document.activeElement)) return;
      e.preventDefault(); e.stopPropagation();
      if (listening) stop();
    };
    window.addEventListener("keydown", down, { capture: true });
    window.addEventListener("keyup", up, { capture: true });
    return () => {
      window.removeEventListener("keydown", down, { capture: true });
      window.removeEventListener("keyup", up, { capture: true });
    };
  }, [listening, start, stop]);

  const buttonState = permissionDenied
    ? "permission_denied"
    : !supported
    ? "unsupported"
    : loading || isProcessing
    ? "processing"
    : listening
    ? "listening"
    : "ready";

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={
          buttonState === "permission_denied"
            ? requestMicrophonePermission
            : buttonState === "unsupported"
            ? null
            : listening
            ? stop
            : start
        }
        disabled={buttonState === "unsupported"}
        className={`
          p-4 rounded-full transition-all duration-300 
          focus:outline-none focus:ring-2 focus:ring-offset-2
          shadow-lg hover:shadow-xl active:scale-95
          ${buttonState === "ready" ? "bg-green-500 hover:bg-green-600 focus:ring-green-500/50 text-white" : ""}
          ${buttonState === "listening" ? "bg-red-500 hover:bg-red-600 focus:ring-red-500/50 text-white" : ""}
          ${buttonState === "processing" ? "bg-blue-500 focus:ring-blue-500/50 text-white cursor-wait" : ""}
          ${buttonState === "permission_denied" ? "bg-orange-500 hover:bg-orange-600 focus:ring-orange-500/50 text-white cursor-pointer" : ""}
          ${buttonState === "unsupported" ? "bg-gray-500 cursor-not-allowed text-white opacity-50" : ""}
        `.replace(/\s+/g, " ").trim()}
        title={
          buttonState === "ready"
            ? "Mantén Space o clic para hablar"
            : buttonState === "listening"
            ? "Suelta para enviar"
            : buttonState === "processing"
            ? "Procesando..."
            : buttonState === "permission_denied"
            ? "Clic para permitir micrófono"
            : "Micrófono no disponible"
        }
      >
        {buttonState === "ready" && <MicrophoneIcon className="w-6 h-6" />}
        {buttonState === "listening" && <StopIcon className="w-6 h-6" />}
        {buttonState === "processing" && (
          <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
        )}
        {buttonState === "permission_denied" && (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
          </svg>
        )}
        {buttonState === "unsupported" && <MicrophoneIcon className="w-6 h-6" />}

        {buttonState === "listening" && (
          <>
            <div className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-75"></div>
            <div className="absolute inset-0 rounded-full bg-red-300 animate-pulse opacity-50"></div>
          </>
        )}
        {buttonState === "processing" && (
          <div className="absolute inset-0 rounded-full bg-blue-400 animate-pulse opacity-30"></div>
        )}
      </button>

      {buttonState === "listening" && (
        <div className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 rounded-full animate-pulse border-2 border-white"></div>
      )}

      {error && buttonState !== "permission_denied" && (
        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 text-center px-2 py-1 bg-red-500/90 text-white text-xs rounded shadow-lg">
          {String(error)}
        </div>
      )}
      {buttonState === "permission_denied" && (
        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 text-center px-2 py-1 bg-orange-500/90 text-white text-xs rounded shadow-lg">
          Clic para permitir
        </div>
      )}

      {/* Vista rápida de la transcripción (opcional) */}
      {(finalText || interim) && (
        <div className="mt-3 text-sm text-neutral-200">
          <span>{finalText}</span>
          {interim && <span className="opacity-60 italic">{finalText ? " " : ""}{interim}</span>}
        </div>
      )}
    </div>
  );
}
