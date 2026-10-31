import { EventEmitter } from "node:events";

export interface SessionEvent {
  sessionId: string;
  type: "PROPOSAL_CREATED" | "TASK_STATUS_CHANGED" | "DECISION_RECORDED" | "SESSION_REVOKED" | "SOURCE_UPLOADED" | "SESSION_EXPIRED";
  targetRole: "all" | "wearer" | "helper";
  payload: Record<string, unknown>;
}

class EventBus extends EventEmitter {
  publish(event: SessionEvent) {
    this.emit(`session:${event.sessionId}`, event);
  }

  subscribe(sessionId: string, listener: (event: SessionEvent) => void) {
    const channel = `session:${sessionId}`;
    this.on(channel, listener);
    return () => this.off(channel, listener);
  }
}

export const eventBus = new EventBus();
