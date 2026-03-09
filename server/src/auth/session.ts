import type { FastifyReply, FastifyRequest } from "fastify";

const COOKIE_NAME = "jmu_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 8;

interface SessionCookie {
  id: number;
  role: "admin" | "operador";
  exp: number;
}

function encodeCookie(payload: SessionCookie) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decodeCookie(value: string): SessionCookie | null {
  try {
    const decoded = Buffer.from(value, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as SessionCookie;

    if (!parsed.id || !parsed.role || !parsed.exp) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function readSession(request: FastifyRequest) {
  const rawCookie = request.cookies[COOKIE_NAME];

  if (!rawCookie) {
    return null;
  }

  const unsigned = request.unsignCookie(rawCookie);

  if (!unsigned.valid) {
    return null;
  }

  const payload = decodeCookie(unsigned.value);

  if (!payload || payload.exp < Date.now()) {
    return null;
  }

  return payload;
}

export function setSessionCookie(
  reply: FastifyReply,
  user: { id: number; role: "admin" | "operador" },
  isProduction: boolean,
) {
  const payload: SessionCookie = {
    id: user.id,
    role: user.role,
    exp: Date.now() + SESSION_TTL_MS,
  };

  reply.setCookie(COOKIE_NAME, encodeCookie(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/",
    signed: true,
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export function clearSessionCookie(reply: FastifyReply) {
  reply.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}
