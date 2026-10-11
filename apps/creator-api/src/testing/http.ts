export type Json = Record<string, unknown>;

export type HttpResult = { status: number; body: Json; headers: Headers };

export function createHttpClient(baseUrl: () => string) {
  async function call(
    method: string,
    path: string,
    options: { token?: string; body?: unknown; rawBody?: string } = {},
  ): Promise<HttpResult> {
    const headers: Record<string, string> = {};
    if (options.token) {
      headers.authorization = `Bearer ${options.token}`;
    }
    const payload =
      options.rawBody ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined);
    if (payload !== undefined) {
      headers['content-type'] = 'application/json';
    }
    const response = await fetch(`${baseUrl()}${path}`, {
      method,
      headers,
      ...(payload !== undefined ? { body: payload } : {}),
    });
    const text = await response.text();
    const body: unknown = text ? JSON.parse(text) : {};
    return {
      status: response.status,
      headers: response.headers,
      body: typeof body === 'object' && body !== null ? (body as Json) : {},
    };
  }

  async function loginDev(telegramId: string): Promise<string> {
    const { status, body } = await call('POST', '/api/v1/auth/dev', {
      body: { telegramId, firstName: `User ${telegramId}` },
    });
    if (status !== 200) {
      throw new Error(`dev login failed: ${status}`);
    }
    return String(body.token);
  }

  return { call, loginDev };
}

export function errorCode(body: Json): unknown {
  const error = body.error;
  return typeof error === 'object' && error !== null ? Reflect.get(error, 'code') : undefined;
}

export function errorDetails(body: Json): Json {
  const error = body.error;
  const details =
    typeof error === 'object' && error !== null ? Reflect.get(error, 'details') : undefined;
  return typeof details === 'object' && details !== null ? (details as Json) : {};
}
