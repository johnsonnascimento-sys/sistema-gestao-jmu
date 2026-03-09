import "fastify";
import type { AppPermission, SessionUser } from "./domain/types";

declare module "fastify" {
  interface FastifyRequest {
    user: SessionUser | null;
  }

  interface FastifyInstance {
    authenticate: (request: FastifyRequest) => Promise<void>;
    authorize: (permission: AppPermission) => (request: FastifyRequest) => Promise<void>;
  }
}
