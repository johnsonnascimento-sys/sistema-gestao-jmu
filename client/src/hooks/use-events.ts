import { useEffect } from "react";

export interface EventData {
  preId: string;
  type: string; // "task" | "status" | "andamento"
  action: string; // "create" | "update" | "delete" | "reorder"
  timestamp: string;
}

export function useEvents() {
  useEffect(() => {
    // EventSource conecta automaticamente
    const eventSource = new EventSource("/api/events", { withCredentials: true });

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Se for evento de conexão, ignorar
        if (data.type === "connected") return;

        const eventData = data as EventData;

        // Emitir um Evento Customizado no DOM para que qualquer tela escute
        const customEvent = new CustomEvent("pre-demanda-updated", { detail: eventData });
        window.dispatchEvent(customEvent);

      } catch (error) {
        console.error("Erro ao processar evento SSE:", error);
      }
    };

    eventSource.onerror = (err) => {
      console.error("Erro na conexão SSE:", err);
      // O navegador tenta reconectar automaticamente
    };

    return () => {
      eventSource.close();
    };
  }, []);
}
