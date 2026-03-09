import "fastify";
import type { SessionUser } from "./domain/types";

declare module "fastify" {
  interface FastifyRequest {
    user: SessionUser | null;
  }

  interface FastifyInstance {
    authenticate: (request: FastifyRequest) => Promise<void>;
  }
}
