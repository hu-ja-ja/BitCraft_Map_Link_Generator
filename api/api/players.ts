const UPSTREAM_BASE = "https://bitjita.com/api/players";
const MIN_QUERY_LENGTH = 2;
const DEFAULT_APP_IDENTIFIER = "Map_Link_Generator (discord: hu_ja_ja_)";
const runtimeEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
  ?.env;

type QueryValue = string | string[] | undefined;

type RequestLike = {
  method?: string;
  query?: {
    q?: QueryValue;
  };
};

type ResponseLike = {
  status: (statusCode: number) => ResponseLike;
  setHeader: (name: string, value: string) => void;
  send: (body: string) => void;
  end: () => void;
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

function sendJson(response: ResponseLike, body: unknown, status = 200) {
  response.status(status).setHeader("Content-Type", "application/json; charset=utf-8");

  const headers = corsHeaders();
  for (const [key, value] of Object.entries(headers)) {
    response.setHeader(key, value);
  }

  response.send(JSON.stringify(body));
}

export default async function handler(request: RequestLike, response: ResponseLike) {
  if (request.method === "OPTIONS") {
    const headers = corsHeaders();
    for (const [key, value] of Object.entries(headers)) {
      response.setHeader(key, value);
    }

    response.status(204).end();
    return;
  }

  if (request.method !== "GET") {
    sendJson(response, { error: "Method Not Allowed" }, 405);
    return;
  }

  const rawQ = request.query?.q;
  const q = String(Array.isArray(rawQ) ? rawQ[0] ?? "" : rawQ ?? "").trim();
  if (q.length < MIN_QUERY_LENGTH) {
    sendJson(response, { players: [], total: 0 }, 200);
    return;
  }

  const upstreamUrl = new URL(UPSTREAM_BASE);
  upstreamUrl.searchParams.set("q", q);

  const appIdentifier = runtimeEnv?.PLAYER_API_APP_IDENTIFIER ?? DEFAULT_APP_IDENTIFIER;

  try {
    const upstream = await fetch(upstreamUrl.toString(), {
      method: "GET",
      headers: {
        "x-app-identifier": appIdentifier,
        Accept: "application/json",
      },
    });

    const payload = await upstream.text();

    const headers = corsHeaders();
    for (const [key, value] of Object.entries(headers)) {
      response.setHeader(key, value);
    }

    response.setHeader(
      "Content-Type",
      upstream.headers.get("Content-Type") ?? "application/json; charset=utf-8",
    );
    response.setHeader("Cache-Control", "public, max-age=10");
    response.status(upstream.status).send(payload);
  } catch (error) {
    sendJson(
      response,
      {
        error: "Upstream request failed",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      502,
    );
  }
}
