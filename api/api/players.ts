const UPSTREAM_BASE = "https://bitjita.com/api/players";
const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 64;
const UPSTREAM_TIMEOUT_MS = 3_000;
const DEFAULT_APP_IDENTIFIER = "Map_Link_Generator (discord: hu_ja_ja_)";
const DEFAULT_ALLOWED_ORIGINS = [
  "https://hu-ja-ja.github.io",
] as const;
const runtimeEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
  ?.env;

type QueryValue = string | string[] | undefined;
type HeaderValue = string | string[] | undefined;

type RequestLike = {
  method?: string;
  query?: {
    q?: QueryValue;
  };
  headers?: Record<string, HeaderValue>;
};

type ResponseLike = {
  status: (statusCode: number) => ResponseLike;
  setHeader: (name: string, value: string) => void;
  send: (body: string) => void;
  end: () => void;
};

const allowedOrigins = parseAllowedOrigins(runtimeEnv?.PLAYER_API_ALLOWED_ORIGINS);

function parseAllowedOrigins(rawOrigins: string | undefined) {
  const parsed = rawOrigins
    ?.split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .map((item) => normalizeOrigin(item))
    .filter((item): item is string => item !== null);

  if (parsed && parsed.length > 0) {
    return new Set(parsed);
  }

  return new Set(DEFAULT_ALLOWED_ORIGINS);
}

function readHeader(headers: Record<string, HeaderValue> | undefined, name: string) {
  const value = headers?.[name] ?? headers?.[name.toLowerCase()];
  if (Array.isArray(value)) {
    return value[0] ?? undefined;
  }
  return value;
}

function normalizeOrigin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function requestOrigin(request: RequestLike) {
  const origin = readHeader(request.headers, "origin")?.trim();
  if (!origin) {
    return null;
  }

  return normalizeOrigin(origin);
}

function corsHeaders(origin: string | null) {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Accept",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };

  if (origin && allowedOrigins.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  } else {
    delete headers["Access-Control-Allow-Origin"];
  }

  return headers;
}

function applyHeaders(response: ResponseLike, headers: Record<string, string>) {
  for (const [key, value] of Object.entries(headers)) {
    response.setHeader(key, value);
  }
}

function sendJson(response: ResponseLike, body: unknown, status = 200, origin: string | null = null) {
  response.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  applyHeaders(response, corsHeaders(origin));
  response.send(JSON.stringify(body));
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

export default async function handler(request: RequestLike, response: ResponseLike) {
  const origin = requestOrigin(request);
  const hasAllowedOrigin = origin !== null && allowedOrigins.has(origin);

  if (request.method === "OPTIONS") {
    if (!hasAllowedOrigin) {
      sendJson(response, { error: "Forbidden" }, 403);
      return;
    }

    applyHeaders(response, corsHeaders(origin));
    response.status(204).end();
    return;
  }

  if (!hasAllowedOrigin) {
    sendJson(response, { error: "Forbidden" }, 403);
    return;
  }

  if (request.method !== "GET") {
    sendJson(response, { error: "Method Not Allowed" }, 405, origin);
    return;
  }

  const rawQ = request.query?.q;
  const q = String(Array.isArray(rawQ) ? rawQ[0] ?? "" : rawQ ?? "").trim();
  if (q.length < MIN_QUERY_LENGTH) {
    sendJson(response, { players: [], total: 0 }, 200, origin);
    return;
  }

  if (q.length > MAX_QUERY_LENGTH) {
    sendJson(response, { error: "Query too long" }, 400, origin);
    return;
  }

  const upstreamUrl = new URL(UPSTREAM_BASE);
  upstreamUrl.searchParams.set("q", q);

  const appIdentifier = runtimeEnv?.PLAYER_API_APP_IDENTIFIER ?? DEFAULT_APP_IDENTIFIER;
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const upstream = await fetch(upstreamUrl.toString(), {
      method: "GET",
      headers: {
        "x-app-identifier": appIdentifier,
        Accept: "application/json",
      },
      signal: abortController.signal,
    });

    const payload = await upstream.text();

    applyHeaders(response, corsHeaders(origin));

    response.setHeader(
      "Content-Type",
      upstream.headers.get("Content-Type") ?? "application/json; charset=utf-8",
    );
    response.setHeader(
      "Cache-Control",
      upstream.ok
        ? "public, max-age=0, s-maxage=30, stale-while-revalidate=120"
        : "no-store",
    );
    response.status(upstream.status).send(payload);
  } catch (error) {
    if (isAbortError(error)) {
      sendJson(response, { error: "Upstream timeout" }, 504, origin);
      return;
    }

    sendJson(
      response,
      {
        error: "Upstream request failed",
      },
      502,
      origin,
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
