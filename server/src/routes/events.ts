import type { FastifyInstance } from "fastify";
import { listenPreDemandaUpdate } from "../lib/events";

export async function registerEventsRoutes(app: FastifyInstance) {
  app.get("/api/events", async (request, reply) => {
    // Autenticação
    try {
      await (app as any).authenticate(request);
    } catch (error) {
      reply.code(401).send({ error: "Não autorizado" });
      return;
    }

    const { raw } = reply;

    // Cabeçalhos SSE
    raw.setHeader("Content-Type", "text/event-stream");
    raw.setHeader("Connection", "keep-alive");
    raw.setHeader("Cache-Control", "no-cache");
    raw.setHeader("X-Accel-Buffering", "no"); // Previne buffering no Nginx

    // Enviar ping/connect inicial
    raw.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);

    // Escutar eventos do barramento
    const cleanup = listenPreDemandaUpdate((data) => {
      raw.write(`data: ${JSON.stringify(data)}\n\n`);
    });

    // Corrigido: Enviar heartbeat periódico para manter a conexão ativa
    const heartbeatInterval = setInterval(() => {
      raw.write(": heartbeat\n\n");
    }, 15000);

    // Limpar listeners e intervalos ao desconectar
    request.raw.on("close", () => {
      cleanup();
      clearInterval(heartbeatInterval);
    });

    // Evitar que o Fastify envie resposta padrão
    reply.hijack();
  });
}
