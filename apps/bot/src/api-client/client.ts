import { botConfig } from '../config.js';

type ApiErrorBody = { message?: string | string[]; statusCode?: number };

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

async function serviceFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (!botConfig.serviceToken) {
    throw new ApiClientError('SERVICE_JWT_SECRET is not configured', 503);
  }

  const response = await fetch(`${botConfig.apiUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${botConfig.serviceToken}`,
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
    const message =
      typeof body.message === 'string'
        ? body.message
        : Array.isArray(body.message)
          ? body.message.join(', ')
          : `API error ${response.status}`;
    throw new ApiClientError(message, response.status);
  }

  return (await response.json()) as T;
}

export type BoostStatus = {
  id: string;
  eventId: string;
  plan: string;
  status: 'pending' | 'active' | 'expired' | 'cancelled';
  starsAmount: number;
};

export async function getBoostStatus(boostId: string): Promise<BoostStatus> {
  return serviceFetch<BoostStatus>(`/internal/boosts/${boostId}`);
}

export async function confirmBoostPayment(input: {
  boostId: string;
  telegramPaymentChargeId: string;
  totalAmount: number;
}): Promise<BoostStatus> {
  return serviceFetch<BoostStatus>('/internal/boosts/confirm', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
