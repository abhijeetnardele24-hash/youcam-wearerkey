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

  bootstrap(codeOrToken: string, role?: 'wearer' | 'helper'): Promise<BootstrapResponse> {
    return request<BootstrapResponse>('/auth/bootstrap', {
      method: 'POST',
      body: JSON.stringify({
        bootstrap_code: codeOrToken,
        token: codeOrToken,
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

  retryPurge(tokenOrRecoveryToken?: string): Promise<DeletionReceipt> {
    const headers: Record<string, string> = {};
    if (tokenOrRecoveryToken) {
      headers['X-Purge-Recovery-Token'] = tokenOrRecoveryToken;
      headers['Authorization'] = `Bearer ${tokenOrRecoveryToken}`;
    }
    return request<DeletionReceipt>('/wearer/session/retry-purge', {
      method: 'POST',
      headers,
    });
  },

  getReceipt(tokenOrRecoveryToken?: string): Promise<DeletionReceipt> {
    const headers: Record<string, string> = {};
    if (tokenOrRecoveryToken) {
      headers['X-Purge-Recovery-Token'] = tokenOrRecoveryToken;
      headers['Authorization'] = `Bearer ${tokenOrRecoveryToken}`;
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

  updateWearerSession(token?: string, formData?: FormData): Promise<{
    status: string;
    source_uploaded: boolean;
    content_hash: string;
  }> {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return request('/wearer/session', {
      method: 'PUT',
      headers,
      body: formData,
    });
  },

  createHelperLink(token?: string): Promise<MintHelperLinkResponse> {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return request<MintHelperLinkResponse>('/wearer/helper-link', {
      method: 'POST',
      headers,
    });
  },

  getWearerSession(token?: string): Promise<WearerSessionDTO> {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return request<WearerSessionDTO>('/wearer/session', {
      headers,
    });
  },

  getWearerReceipt(token?: string): Promise<DeletionReceipt> {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      headers['X-Purge-Recovery-Token'] = token;
    }
    return request<DeletionReceipt>('/wearer/receipt', {
      headers,
    });
  },

  decideProposal(
    token: string | undefined,
    proposalId: string,
    input: SubmitDecisionRequest
  ): Promise<{ success: boolean; decision: any }> {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return request(`/wearer/proposals/${proposalId}/decision`, {
      method: 'POST',
      headers,
      body: JSON.stringify(input),
    });
  },

  revokeSession(token?: string): Promise<{ success: boolean; message: string }> {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return request('/wearer/session', {
      method: 'DELETE',
      headers,
    });
  },

  getHelperSession(token?: string): Promise<HelperSessionDTO> {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return request<HelperSessionDTO>('/helper/session', {
      headers,
    });
  },

  getHelperReceipt(token?: string): Promise<any> {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return request('/helper/receipt', {
      headers,
    });
  },

  createHelperProposal(token: string | undefined, formData: FormData): Promise<{
    success: boolean;
    proposal_id: string;
    status: string;
  }> {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return request('/helper/proposals', {
      method: 'POST',
      headers,
      body: formData,
    });
  },

  generateTryOn(
    token: string | undefined,
    proposalId: string,
    idempotencyKey?: string
  ): Promise<{ success: boolean; proposal: any }> {
    const headers: Record<string, string> = {
      'Idempotency-Key': idempotencyKey || `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return request(`/helper/proposals/${proposalId}/generate`, {
      method: 'POST',
      headers,
    });
  },

  seedJudgeDemo(): Promise<{
    session_id: string;
    wearer_token: string;
    helper_token: string;
    wearer_url: string;
    helper_url: string;
    expires_at: string;
    mode: string;
    status: string;
  }> {
    return request('/judge/seed', {
      method: 'POST',
    });
  },
};
