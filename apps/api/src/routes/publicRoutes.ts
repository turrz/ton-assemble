import fs from 'node:fs';
import path from 'node:path';
import { FastifyInstance } from 'fastify';
import { ApiEnv } from '../config';
import { BackendServices } from '../services';
import { connectQuerySchema, siteIdParamsSchema, slugParamsSchema } from '../schemas';
import { getRequestHost, readPublicIndex, RESERVED_SLUGS, sendNoCacheHtml } from '../utils';

export async function registerPublicRoutes(
  app: FastifyInstance,
  context: { env: ApiEnv; services: BackendServices }
) {
  const { env, services } = context;

  app.get('/', async (request, reply) => {
    const html = services.render.getPublishedHtmlForDomain(getRequestHost(request));
    if (html) return sendNoCacheHtml(reply, html);

    reply.type('text/html; charset=utf-8');
    return reply.send(readPublicIndex());
  });

  app.get('/index.html', async (request, reply) => {
    const html = services.render.getPublishedHtmlForDomain(getRequestHost(request));
    if (html) return sendNoCacheHtml(reply, html);
    return reply.callNotFound();
  });

  app.get('/health', async () => ({ ok: true }));

  app.get('/tonconnect-manifest.json', async (_request, reply) => {
    reply.header('Content-Type', 'application/json; charset=utf-8');
    return reply.send({
      url: env.PUBLIC_BASE_URL,
      name: 'TonAssemble',
      iconUrl: `${env.PUBLIC_BASE_URL}/static/icon.png`,
    });
  });

  app.get('/static/icon.png', async (_request, reply) => {
    const iconPath = path.join(__dirname, '..', '..', 'public', 'static', 'icon.png');
    if (!fs.existsSync(iconPath)) {
      return reply.code(404).send('Not found');
    }
    return reply.type('image/png').send(fs.createReadStream(iconPath));
  });

  app.get('/connect', async (request, reply) => {
    const query = connectQuerySchema.parse(request.query);
    reply.header('Content-Type', 'text/html; charset=utf-8');
    return reply.send(renderConnectPage(env.PUBLIC_BASE_URL, query.tg_id ?? ''));
  });

  app.get('/preview/:siteId', async (request, reply) => {
    const params = siteIdParamsSchema.parse(request.params);
    const html = services.render.getPreviewHtml(params.siteId);
    if (!html) {
      return reply.code(404).send('Site not found');
    }
    reply.header('Content-Type', 'text/html; charset=utf-8');
    return reply.send(html);
  });

  app.get('/:slug', async (request, reply) => {
    const params = slugParamsSchema.parse(request.params);
    const slug = params.slug.toLowerCase();
    if (RESERVED_SLUGS.has(slug)) {
      reply.type('text/html; charset=utf-8');
      return reply.send(readPublicIndex());
    }

    const html = services.render.getSlugHtml(slug);
    if (!html) {
      reply.type('text/html; charset=utf-8');
      return reply.send(readPublicIndex());
    }

    return sendNoCacheHtml(reply, html);
  });
}

function renderConnectPage(publicBaseUrl: string, tgId: string): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Connect TON wallet</title>
    <script src="https://unpkg.com/@tonconnect/sdk@latest/dist/tonconnect-sdk.min.js"></script>
    <style>
      body { font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif; background: #020617; color: #e5e7eb; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; }
      .card { background:#020617; border-radius:16px; padding:20px 18px; max-width:360px; width:100%; border:1px solid rgba(148,163,184,0.4); box-shadow:0 20px 50px rgba(15,23,42,0.9); }
      h1 { margin:0 0 8px; font-size:1.4rem; }
      p { margin:0 0 16px; font-size:0.9rem; color:#9ca3af; }
      button { width:100%; border-radius:999px; border:none; padding:10px 14px; background:linear-gradient(to right,#22d3ee,#0ea5e9); color:#0f172a; font-weight:600; cursor:pointer; }
      button:disabled { opacity:0.6; cursor:default; }
      .status { margin-top:10px; font-size:0.85rem; color:#9ca3af; }
    </style>
  </head>
  <body>
    <main class="card">
      <h1>Connect wallet</h1>
      <p>Connect your TON wallet to link it with your Telegram account.</p>
      <button id="connect-btn">Connect TON wallet</button>
      <div class="status" id="status"></div>
      <script>
        (function() {
          const tgId = ${JSON.stringify(tgId)};
          const statusEl = document.getElementById('status');
          const btn = document.getElementById('connect-btn');
          if (!window.TonConnectSDK) {
            statusEl.textContent = 'TON Connect SDK not loaded.';
            btn.disabled = true;
            return;
          }
          const connector = new window.TonConnectSDK.TonConnect({ manifestUrl: '${publicBaseUrl}/tonconnect-manifest.json' });
          async function connect() {
            try {
              btn.disabled = true;
              statusEl.textContent = 'Requesting connection in wallet...';
              const wallets = await window.TonConnectSDK.TonConnect.getWallets();
              const remote = wallets.find(w => w.universalLink && w.bridgeUrl);
              const link = connector.connect({
                universalLink: remote ? remote.universalLink : 'https://app.tonkeeper.com/ton-connect',
                bridgeUrl: remote ? remote.bridgeUrl : 'https://bridge.tonapi.io/bridge'
              });
              window.location.href = link;
            } catch (e) {
              statusEl.textContent = 'Failed to start connection.';
              btn.disabled = false;
            }
          }
          btn.addEventListener('click', connect);
          connector.onStatusChange(async (walletInfo) => {
            if (!walletInfo || !walletInfo.account) return;
            try {
              const res = await fetch('${publicBaseUrl}/api/tonconnect/link-wallet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  telegramId: tgId,
                  address: walletInfo.account.address,
                  network: walletInfo.account.chain
                })
              });
              const json = await res.json();
              if (json.ok) {
                statusEl.textContent = 'Wallet linked. You may close this window.';
              } else {
                statusEl.textContent = 'Failed to link wallet: ' + (json.error || 'unknown error');
              }
            } catch (e) {
              statusEl.textContent = 'Error while linking wallet.';
            }
          });
        })();
      </script>
    </main>
  </body>
</html>`;
}
