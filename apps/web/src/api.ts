import type {
  CreateSessionRequest,
  CreateSessionResponse,
  MintHelperLinkResponse,
  SubmitDecisionRequest,
  WearerSessionDTO,
  HelperSessionDTO,
  HealthCheckResponse,
  MetaResponse,
  DeletionReceipt,
  BootstrapResponse,
  ReceiptVerificationRequest,
  ReceiptVerificationResponse,
} from '@wearerkey/contracts';

const API_BASE = '/api';

export interface ApiErrorPayload {
  statusCode?: number;
  error?: string;
  message?: string;
  details?: any;
}

export class ApiError extends Error {
  constructor(public statusCode: number, public error: string, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${path}`;
  const headers = new Headers(options.headers || {});

  if (options.body !== undefined && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  // Include credentials (HttpOnly session cookies) on all requests
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers,
  });

  if (!response.ok) {
    let errJson: ApiErrorPayload | null = null;
    try {
      errJson = await response.json();
    } catch {
      // not json
    }
    throw new ApiError(
      response.status,
      errJson?.error || 'HTTP_ERROR',
      errJson?.message || response.statusText || 'An unexpected error occurred'
    );
  }

  return response.json();
}

export const api = {
  getHealth(): Promise<HealthCheckResponse> {
    return request<HealthCheckResponse>('/health');
  },

  getMeta(): Promise<MetaResponse> {
    return request<MetaResponse>('/meta');
  },

  /**
   * Redeems a single-use capability bootstrap code from URL fragment.
   * Atomically exchanges for secure HttpOnly session cookie.
   */
  bootstrap(bootstrapCode: string, role?: 'wearer' | 'helper'): Promise<BootstrapResponse> {
    return request<BootstrapResponse>('/auth/bootstrap', {
      method: 'POST',
      body: JSON.stringify({
        bootstrap_code: bootstrapCode,
        role,
      }),
    });
  },

  verifyReceipt(body: ReceiptVerificationRequest): Promise<ReceiptVerificationResponse> {
    return request<ReceiptVerificationResponse>('/receipts/verify', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  retryPurge(recoveryToken?: string): Promise<DeletionReceipt> {
    const headers: Record<string, string> = {};
    if (recoveryToken) {
      headers['X-Purge-Recovery-Token'] = recoveryToken;
    }
    return request<DeletionReceipt>('/wearer/session/retry-purge', {
      method: 'POST',
      headers,
    });
  },

  getReceipt(recoveryToken?: string): Promise<DeletionReceipt> {
    const headers: Record<string, string> = {};
    if (recoveryToken) {
      headers['X-Purge-Recovery-Token'] = recoveryToken;
    }
    return request<DeletionReceipt>('/receipts', {
      headers,
    });
  },

  createSession(input: CreateSessionRequest): Promise<CreateSessionResponse> {
    return request<CreateSessionResponse>('/sessions', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  updateWearerSession(formData: FormData): Promise<{
    status: string;
    source_uploaded: boolean;
    content_hash: string;
  }> {
    return request('/wearer/session', {
      method: 'PUT',
      body: formData,
    });
  },

  createHelperLink(): Promise<MintHelperLinkResponse> {
    return request<MintHelperLinkResponse>('/wearer/helper-link', {
      method: 'POST',
    });
  },

  getWearerSession(): Promise<WearerSessionDTO> {
    return request<WearerSessionDTO>('/wearer/session');
  },

  getWearerReceipt(): Promise<DeletionReceipt> {
    return request<DeletionReceipt>('/wearer/receipt');
  },

  decideProposal(
    proposalId: string,
    input: SubmitDecisionRequest
  ): Promise<{ success: boolean; decision: any }> {
    return request(`/wearer/proposals/${proposalId}/decision`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  revokeSession(): Promise<DeletionReceipt> {
    return request<DeletionReceipt>('/wearer/session', {
      method: 'DELETE',
    });
  },

  getHelperSession(): Promise<HelperSessionDTO> {
    return request<HelperSessionDTO>('/helper/session');
  },

  getHelperReceipt(): Promise<any> {
    return request('/helper/receipt');
  },

  createHelperProposal(formData: FormData): Promise<{
    success: boolean;
    proposal_id: string;
    status: string;
  }> {
    return request('/helper/proposals', {
      method: 'POST',
      body: formData,
    });
  },

  generateTryOn(
    proposalId: string,
    idempotencyKey?: string
  ): Promise<{ success: boolean; proposal: any }> {
    const headers: Record<string, string> = {
      'Idempotency-Key': idempotencyKey || `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    };
    return request(`/helper/proposals/${proposalId}/generate`, {
      method: 'POST',
      headers,
    });
  },

  seedJudgeDemo(): Promise<{
    session_id: string;
    wearer_bootstrap_code: string;
    helper_bootstrap_code: string;
    wearer_url: string;
    helper_url: string;
    status: string;
    mode: string;
    message: string;
  }> {
    return request('/judge/seed', {
      method: 'POST',
    });
  },
};
