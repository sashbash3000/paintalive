# API proxy for GitHub Pages (CORS)

OpenAI’s HTTP API does not send `Access-Control-Allow-Origin` for browser `fetch` calls. When the game is served from another origin (for example GitHub Pages), the browser blocks the response and the console often shows a **CORS** error even when the real issue is an invalid API key (**401**).

This Worker forwards requests server-side and adds CORS headers so the game can call OpenAI or OpenRouter from static hosting.

## Deploy on Cloudflare

1. Create a **Worker** in the [Cloudflare dashboard](https://dash.cloudflare.com/).
2. Paste `openai-cors-proxy.js` as the worker script (module format / ES modules).
3. **Save and deploy** — note the worker URL (for example `https://paintalive-api.xxx.workers.dev`).
4. Optional but recommended: **Settings → Variables → Secrets** → add `PROXY_SHARED_SECRET` (any long random string). When set, every request must include header `X-Proxy-Secret` with the same value (the game stores this in Settings → “Proxy shared secret”).
5. In the game **Settings**, set **API proxy base URL** to your worker origin only (no trailing path), for example `https://paintalive-api.xxx.workers.dev`.

The game then calls `…/v1/chat/completions` on the worker instead of `api.openai.com`, and the worker forwards to OpenAI with your existing `Authorization: Bearer sk-…` header.

## Security note

Anyone who can guess your worker URL can forward requests **if** you do not set `PROXY_SHARED_SECRET`. With a secret, only clients that know the secret can use the proxy (the OpenAI key is still sent from the browser for each request). For stronger protection, run the whole AI pipeline on a backend you control instead of exposing keys in the browser.
