/**
 * Cloudflare Worker: forwards OpenAI- and OpenRouter-compatible requests with CORS.
 *
 * Deploy: Workers dashboard → Create Worker → paste this file, add secret PROXY_SHARED_SECRET (optional).
 * Routes:
 *   /v1/*           → https://api.openai.com/v1/*
 *   /openrouter/*   → https://openrouter.ai/api/*
 *   /custom?target= → full HTTPS URL (OpenAI-compatible base + path)
 *
 * If PROXY_SHARED_SECRET is set, requests must include header: X-Proxy-Secret: <same value>
 */

export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers':
        'Content-Type, Authorization, X-Proxy-Secret, X-Title, HTTP-Referer',
      'Access-Control-Max-Age': '86400',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);
    const secret = env.PROXY_SHARED_SECRET;
    if (secret) {
      const got = request.headers.get('X-Proxy-Secret') || '';
      if (got !== secret) {
        return jsonResponse(401, { error: { message: 'Invalid or missing X-Proxy-Secret' } }, cors);
      }
    }

    let upstream;
    if (url.pathname.startsWith('/v1/')) {
      upstream = `https://api.openai.com${url.pathname}${url.search}`;
    } else if (url.pathname.startsWith('/openrouter/')) {
      const rest = url.pathname.slice('/openrouter'.length);
      upstream = `https://openrouter.ai/api${rest}${url.search}`;
    } else if (url.pathname === '/custom' || url.pathname.startsWith('/custom')) {
      const target = url.searchParams.get('target');
      if (!target) {
        return jsonResponse(400, { error: { message: 'Missing target query parameter' } }, cors);
      }
      let parsed;
      try {
        parsed = new URL(target);
      } catch {
        return jsonResponse(400, { error: { message: 'Invalid target URL' } }, cors);
      }
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        return jsonResponse(400, { error: { message: 'Target must be http(s) URL' } }, cors);
      }
      upstream = target;
    } else {
      return new Response('Paintalive API proxy: use /v1/, /openrouter/, or /custom?target=', {
        status: 404,
        headers: { ...cors, 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    const headers = filterRequestHeaders(request);

    const upstreamRes = await fetch(upstream, {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    });

    const out = new Headers(upstreamRes.headers);
    out.set('Access-Control-Allow-Origin', '*');
    out.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    out.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Proxy-Secret, X-Title, HTTP-Referer'
    );

    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      statusText: upstreamRes.statusText,
      headers: out,
    });
  },
};

function filterRequestHeaders(request) {
  const skip = new Set([
    'host',
    'connection',
    'content-length',
    'cf-connecting-ip',
    'cf-ray',
    'x-proxy-secret',
  ]);
  const h = new Headers();
  for (const [k, v] of request.headers) {
    if (skip.has(k.toLowerCase())) continue;
    h.append(k, v);
  }
  return h;
}

function jsonResponse(status, body, cors) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' },
  });
}
