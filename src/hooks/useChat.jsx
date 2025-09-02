import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

const backendUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
const ChatContext = createContext();

const LS_KEY = "chat_session_id";

export const ChatProvider = ({ children }) => {
  // ===== Estado principal =====
  const [queue, setQueue] = useState([]);     // Cola de mensajes del asistente (cada item tiene {text,audio,...})
  const [message, setMessage] = useState(null); // Mensaje actual (cabeza de la cola)
  const [loading, setLoading] = useState(false);

  // ===== Sesión =====
  const [sessionId, setSessionId] = useState(() => {
    const saved = localStorage.getItem(LS_KEY);
    return saved || "default";
  });

  // Guarda la sesión de forma persistente
  useEffect(() => {
    if (sessionId) localStorage.setItem(LS_KEY, sessionId);
  }, [sessionId]);

  // ===== Cola de envíos del usuario para no solaparnos =====
  const userQueueRef = useRef([]);
  const sendingRef = useRef(false);

  // ===== Helper: consumir cola de usuario secuencialmente =====
  const pumpUserQueue = async () => {
    if (sendingRef.current) return;
    sendingRef.current = true;

    while (userQueueRef.current.length > 0) {
      const nextText = userQueueRef.current.shift();
      try {
        setLoading(true);
        const resp = await fetch(`${backendUrl}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: nextText ?? null,
            sessionId, // se la pasamos siempre
          }),
        });

        const json = await resp.json();
        const assistantMsgs = Array.isArray(json?.messages) ? json.messages : [];

        // Encolar respuestas del asistente para reproducir (audio base64 incluido)
        setQueue((q) => [...q, ...assistantMsgs]);

        // Si el backend sugiere reset de sesión, cámbiala (y persiste)
        if (json?.resetSuggested && json?.newSessionId) {
          setSessionId(json.newSessionId); // el backend ya te la da lista :contentReference[oaicite:3]{index=3}
        }
      } catch (e) {
        console.error("[chat] error:", e);
        // Encola un fallback para no cortar UX
        setQueue((q) => [
          ...q,
          {
            text: "Tengo un problema técnico momentáneo. Intentemos otra vez en unos segundos.",
            facialExpression: "sad",
            animation: "Crying",
            audio: "",
            audioMime: "audio/mpeg",
          },
        ]);
      } finally {
        setLoading(false);
      }
    }

    sendingRef.current = false;
  };

  // ===== API pública: enviar mensaje del usuario =====
  const chat = async (text) => {
    userQueueRef.current.push(text);
    pumpUserQueue();
  };

  // ===== Mensaje se “consume” cuando avisa el Avatar =====
  const onMessagePlayed = () => {
    setQueue((q) => q.slice(1));
  };

  // Mantener message = cabeza de la cola
  useEffect(() => {
    setMessage(queue.length > 0 ? queue[0] : null);
  }, [queue]);

  // ===== Llamada de “bienvenida” inicial (sin message) =====
  useEffect(() => {
    // Solo si no hay nada en cola ni reproduciendo
    if (queue.length === 0) {
      userQueueRef.current.push(null); // backend responde con saludo si no hay message :contentReference[oaicite:4]{index=4}
      pumpUserQueue();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // una vez

  const value = useMemo(
    () => ({
      chat,
      message,
      onMessagePlayed,
      loading,
      // si quieres exponer la sesión para debug:
      sessionId,
      setSessionId,
    }),
    [chat, message, onMessagePlayed, loading, sessionId]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export const useChat = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within a ChatProvider");
  return ctx;
};
