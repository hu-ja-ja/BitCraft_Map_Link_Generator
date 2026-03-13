import type { APIRoute } from "astro";

const UPSTREAM_BASE = "https://bitjita.com/api/players";
const MIN_QUERY_LENGTH = 2;
const DEFAULT_APP_IDENTIFIER = "Map_Link_Generator (discord: hu_ja_ja_)";
const IS_VERCEL_RUNTIME = import.meta.env.VERCEL === "1";

export const prerender = !IS_VERCEL_RUNTIME;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(),
    },
  });
}

export const OPTIONS: APIRoute = async () =>
  new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders(),
    },
  });

export const GET: APIRoute = async ({ url }) => {
  const q = url.searchParams.get("q")?.trim() ?? "";
  if (q.length < MIN_QUERY_LENGTH) {
    return jsonResponse({ players: [], total: 0 }, 200);
  }

  const upstreamUrl = new URL(UPSTREAM_BASE);
  upstreamUrl.searchParams.set("q", q);

  const appIdentifier = import.meta.env.PLAYER_API_APP_IDENTIFIER ?? DEFAULT_APP_IDENTIFIER;

  try {
    const upstream = await fetch(upstreamUrl.toString(), {
      method: "GET",
      headers: {
        "x-app-identifier": appIdentifier,
        Accept: "application/json",
      },
    });

    const payload = await upstream.text();
    return new Response(payload, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") ?? "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=10",
        ...corsHeaders(),
      },
    });
  } catch (error) {
    return jsonResponse(
      {
        error: "Upstream request failed",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      502,
    );
  }
};
