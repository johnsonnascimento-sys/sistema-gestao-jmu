import { EventEmitter } from "node:events";

const eventBus = new EventEmitter();

// Aumentar limite de listeners se houver muitas conexões simultâneas
eventBus.setMaxListeners(100);

export const EVENTS = {
  PRE_DEMANDA_UPDATED: "pre_demanda_updated",
};

export interface PreDemandaUpdateEvent {
  preId: string;
  type: string; // "task" | "status" | "andamento"
  action: string; // "create" | "update" | "delete" | "reorder"
  timestamp: string;
}

export function emitPreDemandaUpdate(data: Omit<PreDemandaUpdateEvent, "timestamp">) {
  eventBus.emit(EVENTS.PRE_DEMANDA_UPDATED, {
    ...data,
    timestamp: new Date().toISOString(),
  });
}

export function listenPreDemandaUpdate(callback: (data: PreDemandaUpdateEvent) => void) {
  eventBus.on(EVENTS.PRE_DEMANDA_UPDATED, callback);
  return () => {
    eventBus.off(EVENTS.PRE_DEMANDA_UPDATED, callback);
  };
}
