import { FastifyInstance } from 'fastify';
import { ApiEnv } from '../config';
import { createTelegramAuth, requireTelegramId } from '../middleware';
import { BackendServices } from '../services';
import {
  accountLastTxQuerySchema,
  addSiteDomainBodySchema,
  confirmPublishBodySchema,
  createSiteBodySchema,
  linkWalletBodySchema,
  siteIdParamsSchema,
  updateSiteBodySchema,
  verifyDomainBodySchema,
} from '../schemas';

export async function registerApiRoutes(
  app: FastifyInstance,
  context: { env: ApiEnv; services: BackendServices }
) {
  const { env, services } = context;
  const telegramAuth = createTelegramAuth(env);

  app.get('/api/domains', { preHandler: telegramAuth }, async (request, reply) => {
    const userTelegramId = requireTelegramId(request);
    return reply.send({ ok: true, domains: services.domains.listForUser(userTelegramId) });
  });

  app.post('/api/domains/verify', { preHandler: telegramAuth }, async (request, reply) => {
    const userTelegramId = requireTelegramId(request);
    const body = verifyDomainBodySchema.parse(request.body);
    return reply.send(await services.domains.verifyDomain(userTelegramId, body));
  });

  app.post('/api/tonconnect/link-wallet', { preHandler: telegramAuth }, async (request, reply) => {
    const userTelegramId = requireTelegramId(request);
    const body = linkWalletBodySchema.parse(request.body);
    return reply.send(services.wallets.linkWallet(userTelegramId, body));
  });

  app.get('/api/sites/:siteId', { preHandler: telegramAuth }, async (request, reply) => {
    const userTelegramId = requireTelegramId(request);
    const params = siteIdParamsSchema.parse(request.params);
    return reply.send({ ok: true, site: services.sites.getSiteForUser(params.siteId, userTelegramId) });
  });

  app.post('/api/sites', { preHandler: telegramAuth }, async (request, reply) => {
    const userTelegramId = requireTelegramId(request);
    const body = createSiteBodySchema.parse(request.body);
    return reply.send(services.sites.createSite(userTelegramId, body, services.domains));
  });

  app.patch('/api/sites/:siteId', { preHandler: telegramAuth }, async (request, reply) => {
    const userTelegramId = requireTelegramId(request);
    const params = siteIdParamsSchema.parse(request.params);
    const body = updateSiteBodySchema.parse(request.body);
    return reply.send(services.sites.updateSite(userTelegramId, params.siteId, body));
  });

  app.post('/api/sites/:siteId/publish', { preHandler: telegramAuth }, async (request, reply) => {
    const userTelegramId = requireTelegramId(request);
    const params = siteIdParamsSchema.parse(request.params);
    return reply.send(await services.sites.publish(userTelegramId, params.siteId));
  });

  app.post('/api/sites/:siteId/publish/confirm', { preHandler: telegramAuth }, async (request, reply) => {
    const userTelegramId = requireTelegramId(request);
    const params = siteIdParamsSchema.parse(request.params);
    const body = confirmPublishBodySchema.parse(request.body);
    return reply.send(await services.sites.confirmPublish(userTelegramId, params.siteId, body));
  });

  app.get('/api/sites/:siteId/history', { preHandler: telegramAuth }, async (request, reply) => {
    const userTelegramId = requireTelegramId(request);
    const params = siteIdParamsSchema.parse(request.params);
    return reply.send(services.sites.getHistory(userTelegramId, params.siteId));
  });

  app.post('/api/sites/:siteId/domains', { preHandler: telegramAuth }, async (request, reply) => {
    const userTelegramId = requireTelegramId(request);
    const params = siteIdParamsSchema.parse(request.params);
    const body = addSiteDomainBodySchema.parse(request.body);
    return reply.send(services.sites.addDomain(userTelegramId, params.siteId, body.domainId));
  });

  app.post('/api/sites/:siteId/rollback', { preHandler: telegramAuth }, async (request, reply) => {
    const userTelegramId = requireTelegramId(request);
    const params = siteIdParamsSchema.parse(request.params);
    return reply.send(services.sites.rollback(userTelegramId, params.siteId));
  });

  app.get('/api/account-last-tx', async (request, reply) => {
    const query = accountLastTxQuerySchema.parse(request.query);
    return reply.send(await services.wallets.getAccountLastTx(query.address));
  });

  app.get('/api/support-config', async () => ({
    donateTonAddress: env.DONATE_TON_ADDRESS ?? null,
    donateText: env.DONATE_TEXT ?? null,
    contactTelegram: env.CONTACT_TELEGRAM ?? null,
    contactX: env.CONTACT_X ?? null,
    contactEmail: env.CONTACT_EMAIL ?? null,
  }));
}
