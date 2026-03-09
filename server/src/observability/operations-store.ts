import type { OperationsCounters, OperationsIncident, OperationsIncidentKind, OperationsIncidentLevel } from "../domain/types";

const MAX_INCIDENTS = 30;

function createInitialCounters(): OperationsCounters {
  return {
    requestsTotal: 0,
    successfulRequestsTotal: 0,
    clientErrorsTotal: 0,
    serverErrorsTotal: 0,
    loginSuccessTotal: 0,
    loginFailuresTotal: 0,
    authFailuresTotal: 0,
    readyChecksFailedTotal: 0,
    unhandledErrorsTotal: 0,
  };
}

export class OperationsStore {
  private counters = createInitialCounters();
  private incidents: OperationsIncident[] = [];
  private nextIncidentId = 1;

  recordResponse(statusCode: number) {
    this.counters.requestsTotal += 1;

    if (statusCode >= 500) {
      this.counters.serverErrorsTotal += 1;
      return;
    }

    if (statusCode >= 400) {
      this.counters.clientErrorsTotal += 1;
      return;
    }

    this.counters.successfulRequestsTotal += 1;
  }

  recordLoginSuccess() {
    this.counters.loginSuccessTotal += 1;
  }

  recordAuthFailure(message: string, details: { requestId: string | null; userId: number | null; method: string | null; path: string | null; statusCode: number | null; isLoginFailure?: boolean }) {
    this.counters.authFailuresTotal += 1;

    if (details.isLoginFailure) {
      this.counters.loginFailuresTotal += 1;
    }

    this.addIncident("auth_failure", "warn", message, details);
  }

  recordReadyCheckFailure(message: string, details: { requestId: string | null; userId?: number | null; method?: string | null; path?: string | null; statusCode?: number | null }) {
    this.counters.readyChecksFailedTotal += 1;
    this.addIncident("database_readiness_failure", "error", message, {
      requestId: details.requestId,
      userId: details.userId ?? null,
      method: details.method ?? null,
      path: details.path ?? null,
      statusCode: details.statusCode ?? null,
    });
  }

  recordUnhandledError(message: string, details: { requestId: string | null; userId: number | null; method: string | null; path: string | null; statusCode: number | null }) {
    this.counters.unhandledErrorsTotal += 1;
    this.addIncident("server_error", "error", message, details);
  }

  getSnapshot(limit = 12) {
    return {
      counters: { ...this.counters },
      incidents: this.incidents.slice(0, limit),
    };
  }

  private addIncident(
    kind: OperationsIncidentKind,
    level: OperationsIncidentLevel,
    message: string,
    details: {
      requestId: string | null;
      userId: number | null;
      method: string | null;
      path: string | null;
      statusCode: number | null;
    },
  ) {
    this.incidents.unshift({
      id: `ops-${this.nextIncidentId++}`,
      kind,
      level,
      message,
      occurredAt: new Date().toISOString(),
      requestId: details.requestId,
      userId: details.userId,
      method: details.method,
      path: details.path,
      statusCode: details.statusCode,
    });

    if (this.incidents.length > MAX_INCIDENTS) {
      this.incidents = this.incidents.slice(0, MAX_INCIDENTS);
    }
  }
}
