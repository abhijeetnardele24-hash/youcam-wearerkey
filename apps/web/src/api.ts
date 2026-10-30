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

  createSession(input: CreateSessionRequest): Promise<CreateSessionResponse> {
    return request<CreateSessionResponse>('/sessions', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  updateWearerSession(token: string, formData: FormData): Promise<{
    status: string;
    source_uploaded: boolean;
    content_hash: string;
  }> {
    return request('/wearer/session', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });
  },

  createHelperLink(token: string): Promise<MintHelperLinkResponse> {
    return request<MintHelperLinkResponse>('/wearer/helper-link', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  },

  getWearerSession(token: string): Promise<WearerSessionDTO> {
    return request<WearerSessionDTO>('/wearer/session', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  },

  getWearerReceipt(token: string): Promise<DeletionReceipt> {
    return request<DeletionReceipt>('/wearer/receipt', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  },

  decideProposal(
    token: string,
    proposalId: string,
    input: SubmitDecisionRequest
  ): Promise<{ success: boolean; decision: any }> {
    return request(`/wearer/proposals/${proposalId}/decision`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    });
  },

  revokeSession(token: string): Promise<{ success: boolean; message: string }> {
    return request('/wearer/session', {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  },

  getHelperSession(token: string): Promise<HelperSessionDTO> {
    return request<HelperSessionDTO>('/helper/session', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  },

  getHelperReceipt(token: string): Promise<any> {
    return request('/helper/receipt', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  },

  createHelperProposal(token: string, formData: FormData): Promise<{
    success: boolean;
    proposal_id: string;
    status: string;
  }> {
    return request('/helper/proposals', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });
  },

  generateTryOn(
    token: string,
    proposalId: string,
    idempotencyKey?: string
  ): Promise<{ success: boolean; proposal: any }> {
    return request(`/helper/proposals/${proposalId}/generate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Idempotency-Key': idempotencyKey || `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      },
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
