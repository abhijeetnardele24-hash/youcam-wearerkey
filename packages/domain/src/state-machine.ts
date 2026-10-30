import type { SessionStatus, ProposalStatus } from "@wearerkey/contracts";

/**
 * Allowed Session State Transitions
 * DRAFT -> READY -> ACTIVE -> REVOKED
 *                   |  |
 *                   |  +-> EXPIRED
 *                   +----> COMPLETED -> PURGING -> PURGED | PURGE_PARTIAL
 */
const ALLOWED_SESSION_TRANSITIONS: Record<SessionStatus, SessionStatus[]> = {
  DRAFT: ["READY", "REVOKED"],
  READY: ["ACTIVE", "REVOKED", "EXPIRED"],
  ACTIVE: ["COMPLETED", "REVOKED", "EXPIRED"],
  COMPLETED: ["PURGED", "REVOKED", "EXPIRED"],
  EXPIRED: ["PURGED"],
  REVOKED: ["PURGED"],
  PURGED: []
};

export class InvalidStateTransitionError extends Error {
  constructor(entity: string, from: string, to: string) {
    super(`Invalid ${entity} state transition from '${from}' to '${to}'`);
    this.name = "InvalidStateTransitionError";
  }
}

export function transitionSession(currentStatus: SessionStatus, nextStatus: SessionStatus): SessionStatus {
  if (currentStatus === nextStatus) {
    return currentStatus;
  }
  const allowed = ALLOWED_SESSION_TRANSITIONS[currentStatus];
  if (!allowed || !allowed.includes(nextStatus)) {
    throw new InvalidStateTransitionError("Session", currentStatus, nextStatus);
  }
  return nextStatus;
}

/**
 * Allowed Proposal State Transitions
 * CREATED -> GATE_BLOCKED
 *    |
 *    +-> READY -> UPLOADING -> SUBMITTED -> PROCESSING
 *                                       |          |
 *                                       |          +-> SUCCEEDED -> REVIEWED
 *                                       +------------> FAILED
 */
const ALLOWED_PROPOSAL_TRANSITIONS: Record<ProposalStatus, ProposalStatus[]> = {
  CREATED: ["GATE_BLOCKED", "READY", "FAILED"],
  GATE_BLOCKED: ["READY", "FAILED"],
  READY: ["UPLOADING", "FAILED"],
  UPLOADING: ["SUBMITTED", "FAILED"],
  SUBMITTED: ["PROCESSING", "FAILED"],
  PROCESSING: ["SUCCEEDED", "FAILED"],
  SUCCEEDED: ["REVIEWED", "FAILED"],
  REVIEWED: [],
  FAILED: []
};

export function transitionProposal(currentStatus: ProposalStatus, nextStatus: ProposalStatus): ProposalStatus {
  if (currentStatus === nextStatus) {
    return currentStatus;
  }
  const allowed = ALLOWED_PROPOSAL_TRANSITIONS[currentStatus];
  if (!allowed || !allowed.includes(nextStatus)) {
    throw new InvalidStateTransitionError("Proposal", currentStatus, nextStatus);
  }
  return nextStatus;
}
