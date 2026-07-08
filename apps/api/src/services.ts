import fs from 'node:fs';
import path from 'node:path';
import { Address } from '@ton/core';
import { Db, DomainRow, SiteRow } from '@ton-site-builder/db';
import { TonClientProvider } from '@ton-site-builder/blockchain';
import { DomainService as TonDomainService } from '@ton-site-builder/dns';
import { TonStorageService } from '@ton-site-builder/storage';
import { renderTemplate, TemplateId } from '@ton-site-builder/templates';
import { ZodError } from 'zod';
import { ApiEnv } from './config';
import { AppError } from './middleware';
import { ATTRIBUTION_URL, hashAccessKey, is4nDomain, normalizeSlug } from './utils';

export interface BackendServices {
  domains: DomainWorkflowService;
  sites: SiteWorkflowService;
  wallets: WalletWorkflowService;
  render: RenderWorkflowService;
}

export interface BackendServiceDeps {
  env: ApiEnv;
  db: Db;
  dnsService: TonDomainService;
  storageService: TonStorageService | null;
  tonClientProvider: TonClientProvider;
}

export function createServices(deps: BackendServiceDeps): BackendServices {
  const render = new RenderWorkflowService(deps.db);
  return {
    domains: new DomainWorkflowService(deps.db, deps.dnsService),
    sites: new SiteWorkflowService(deps.env, deps.db, deps.dnsService, deps.storageService, render),
    wallets: new WalletWorkflowService(deps.db, deps.tonClientProvider),
    render,
  };
}

export class RenderWorkflowService {
  constructor(private readonly db: Db) {}

  renderSite(site: SiteRow, includeAttribution = true): string {
    return renderTemplate(site.template as TemplateId, JSON.parse(site.data_json), {
      attributionUrl: includeAttribution ? ATTRIBUTION_URL : undefined,
    });
  }

  validateTemplate(template: TemplateId, data: unknown): void {
    renderTemplate(template, data, { attributionUrl: ATTRIBUTION_URL });
  }

  getPublishedHtmlForDomain(host: string): string | null {
    if (!host.endsWith('.ton')) return null;
    const domain = this.db.getDomainByName(host);
    if (!domain) return null;
    const site = this.db.getLatestPublishedSiteByDomainId(domain.id);
    return site ? this.renderSite(site, false) : null;
  }

  getPreviewHtml(siteId: number): string | null {
    const site = this.db.getSiteById(siteId);
    return site ? this.renderSite(site) : null;
  }

  getSlugHtml(slug: string): string | null {
    const site = this.db.getSiteBySlug(slug);
    return site ? this.renderSite(site) : null;
  }
}

export class DomainWorkflowService {
  constructor(
    private readonly db: Db,
    private readonly dnsService: TonDomainService
  ) {}

  listForUser(userTelegramId: string) {
    return this.db.listDomainsForUser(userTelegramId).map((d) => ({
      id: d.id,
      domain: d.domain,
      verified: !!d.verified,
      ownerAddress: d.owner_address,
      sites: this.db.listSitesForDomain(d.id, userTelegramId),
    }));
  }

  async verifyDomain(userTelegramId: string, body: { domain: string; accessKey?: string }) {
    const domainLower = body.domain.toLowerCase();
    this.consumeAccessKeyIfRequired(domainLower, body.accessKey, 'Get a key from the bot: /key');

    const user = this.db.getUser(userTelegramId);
    if (!user || !user.wallet_address) {
      throw new AppError(400, { ok: false, error: 'User wallet not connected' });
    }

    try {
      const owner = await this.dnsService.resolveOwner(domainLower);
      const ownerRaw = Address.parse(owner).toRawString();
      const walletRaw = Address.parse(user.wallet_address).toRawString();
      const matches = ownerRaw === walletRaw;
      const domainRow = this.db.insertOrUpdateDomain({
        telegramId: userTelegramId,
        domain: domainLower,
        ownerAddress: owner,
        verified: matches,
      });

      return {
        ok: matches,
        domain: domainRow.domain,
        ownerAddress: owner,
      };
    } catch {
      throw new AppError(500, { ok: false, error: 'Domain verification failed' });
    }
  }

  consumeAccessKeyIfRequired(domain: string, accessKey: string | undefined, suffix: string): void {
    if (is4nDomain(domain)) return;

    if (!accessKey || !accessKey.trim()) {
      throw new AppError(403, {
        ok: false,
        error: `Only 4N domains (4 digits .ton) are allowed without an access key. ${suffix}`,
        requiresAccessKey: true,
      });
    }

    if (!this.db.consumeAccessKey(hashAccessKey(accessKey))) {
      throw new AppError(403, { ok: false, error: 'Invalid or already used access key' });
    }
  }
}

export class SiteWorkflowService {
  constructor(
    private readonly env: ApiEnv,
    private readonly db: Db,
    private readonly dnsService: TonDomainService,
    private readonly storageService: TonStorageService | null,
    private readonly render: RenderWorkflowService
  ) {}

  getSiteForUser(siteId: number, userTelegramId: string) {
    const site = this.db.getSiteById(siteId);
    if (!site || site.telegram_id !== userTelegramId) {
      throw new AppError(404, { ok: false, error: 'Site not found' });
    }
    const domain = this.db.getDomainById(site.domain_id);
    return {
      ...site,
      domainName: domain?.domain ?? null,
      domains: this.db.listDomainsForSite(site.id),
    };
  }

  createSite(
    userTelegramId: string,
    body: { domain: string; template: TemplateId; data: unknown; slug?: string; accessKey?: string },
    domainWorkflow: DomainWorkflowService
  ) {
    const domainLower = body.domain.toLowerCase();
    domainWorkflow.consumeAccessKeyIfRequired(domainLower, body.accessKey, 'Use /key in the bot.');

    const user = this.db.getUser(userTelegramId);
    if (!user || !user.wallet_address) {
      throw new AppError(400, { ok: false, error: 'User wallet not connected' });
    }

    const domainRow = this.db.getDomainByName(domainLower);
    if (!domainRow || !domainRow.verified || domainRow.telegram_id !== userTelegramId) {
      throw new AppError(400, { ok: false, error: 'Domain is not verified for this user' });
    }

    const slug = normalizeSlug(body.slug);
    if (slug && this.db.getSiteBySlug(slug)) {
      throw new AppError(400, { ok: false, error: 'This slug is already taken' });
    }

    try {
      this.render.validateTemplate(body.template, body.data);
    } catch (err) {
      throw new AppError(400, { ok: false, error: formatCreateTemplateError(err) });
    }

    const site = this.db.createSite({
      telegramId: userTelegramId,
      domainId: domainRow.id,
      template: body.template,
      dataJson: body.data,
      slug: slug || undefined,
    });

    return { ok: true, siteId: site.id };
  }

  updateSite(userTelegramId: string, siteId: number, body: { template?: TemplateId; data?: unknown; slug?: string | null }) {
    const site = this.db.getSiteById(siteId);
    if (!site || site.telegram_id !== userTelegramId) {
      throw new AppError(404, { ok: false, error: 'Site not found' });
    }

    try {
      if (body.template !== undefined || body.data !== undefined) {
        this.render.validateTemplate(
          body.template ?? (site.template as TemplateId),
          body.data ?? JSON.parse(site.data_json)
        );
      }
    } catch (err) {
      throw new AppError(400, { ok: false, error: getErrorMessage(err, 'Invalid template data') });
    }

    const slug = body.slug !== undefined ? normalizeSlug(body.slug) : undefined;
    if (slug) {
      const existing = this.db.getSiteBySlug(slug);
      if (existing && existing.id !== siteId) {
        throw new AppError(400, { ok: false, error: 'This slug is already taken' });
      }
    }

    try {
      this.db.updateSiteDraft(siteId, userTelegramId, {
        template: body.template,
        data_json: body.data !== undefined ? JSON.stringify(body.data) : undefined,
        slug,
      });
    } catch (err) {
      throw new AppError(400, { ok: false, error: getErrorMessage(err, 'Cannot update site') });
    }

    return { ok: true, site: this.db.getSiteById(siteId) };
  }

  async publish(userTelegramId: string, siteId: number) {
    const site = this.requireOwnedSite(siteId, userTelegramId);
    const domain = this.requireVerifiedDomain(site.domain_id);
    const previewUrl = `${this.env.PUBLIC_BASE_URL}/preview/${site.id}`;

    if (this.env.TON_PROXY_ADNL_HEX) {
      const adnlRes = await this.dnsService.buildSetSiteRecordTxAdnl(domain.domain, this.env.TON_PROXY_ADNL_HEX);
      if (site.status !== 'waiting_dns_tx') {
        this.db.updateSiteStatus(site.id, 'waiting_dns_tx', { content_id: null });
      }
      return {
        ok: true,
        siteId: site.id,
        contentId: null,
        domain: domain.domain,
        tx: adnlRes.tx,
        previewUrl,
        useAdnl: true,
        adnlLinkUrl: `ton://transfer/${adnlRes.nftAddress}?amount=200000000&bin=${encodeURIComponent(adnlRes.bodyBase64)}`,
      };
    }

    if (site.status === 'waiting_dns_tx' && site.content_id) {
      const tx = await this.dnsService.buildSetSiteRecordTx(domain.domain, site.content_id);
      return { ok: true, siteId: site.id, contentId: site.content_id, domain: domain.domain, tx, previewUrl };
    }

    if (this.db.hasPendingPublish(userTelegramId, domain.id)) {
      throw new AppError(429, {
        ok: false,
        error: 'There is already a pending publish operation for this domain',
      });
    }

    if (!this.storageService) {
      throw new AppError(500, { ok: false, error: 'Storage not configured' });
    }

    const tmpDir = await fs.promises.mkdtemp(path.join(process.cwd(), 'tmp-site-'));
    await fs.promises.writeFile(path.join(tmpDir, 'index.html'), this.render.renderSite(site), 'utf-8');
    this.db.updateSiteStatus(site.id, 'uploading');

    try {
      const uploadRes = await this.storageService.uploadStaticSite(tmpDir);
      this.db.updateSiteStatus(site.id, 'waiting_dns_tx', { content_id: uploadRes.contentId });
      const tx = await this.dnsService.buildSetSiteRecordTx(domain.domain, uploadRes.contentId);
      return { ok: true, siteId: site.id, contentId: uploadRes.contentId, domain: domain.domain, tx, previewUrl };
    } catch (err) {
      this.db.updateSiteStatus(site.id, 'failed');
      throw new AppError(500, { ok: false, error: getErrorMessage(err, 'Publish failed') });
    } finally {
      await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  async confirmPublish(userTelegramId: string, siteId: number, body: { txHashHex: string; fromAddress: string }) {
    const site = this.requireOwnedSite(siteId, userTelegramId);
    this.requireVerifiedDomain(site.domain_id);

    try {
      const confirmed = await this.dnsService.waitForTx(body.txHashHex, body.fromAddress);
      if (!confirmed) {
        throw new AppError(408, { ok: false, error: 'Transaction not confirmed within timeout' });
      }

      this.db.updateSiteStatus(site.id, 'published', { dns_tx_hash: body.txHashHex });
      return { ok: true };
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(500, { ok: false, error: 'Confirm publish failed' });
    }
  }

  getHistory(userTelegramId: string, siteId: number) {
    const site = this.requireOwnedSite(siteId, userTelegramId);
    return { ok: true, versions: this.db.listLastPublishedVersions(site.domain_id, userTelegramId, 3) };
  }

  addDomain(userTelegramId: string, siteId: number, domainId: number) {
    const domain = this.db.getDomainById(domainId);
    if (!domain || domain.telegram_id !== userTelegramId || !domain.verified) {
      throw new AppError(400, { ok: false, error: 'Domain not found or not verified for you' });
    }

    try {
      this.db.addSiteDomain(siteId, domainId, userTelegramId);
    } catch (err) {
      throw new AppError(400, { ok: false, error: getErrorMessage(err, 'Failed to add domain') });
    }

    return { ok: true, domains: this.db.listDomainsForSite(siteId) };
  }

  rollback(userTelegramId: string, siteId: number) {
    const sourceSite = this.requireOwnedSite(siteId, userTelegramId);
    if (sourceSite.status !== 'published') {
      throw new AppError(400, { ok: false, error: 'Only published versions can be rolled back to' });
    }

    const domain = this.db.getDomainById(sourceSite.domain_id);
    if (!domain || !domain.verified || domain.telegram_id !== userTelegramId) {
      throw new AppError(400, { ok: false, error: 'Domain not verified for this user' });
    }

    const newSite = this.db.createSite({
      telegramId: userTelegramId,
      domainId: sourceSite.domain_id,
      template: sourceSite.template,
      dataJson: JSON.parse(sourceSite.data_json),
    });

    return { ok: true, siteId: newSite.id };
  }

  private requireOwnedSite(siteId: number, userTelegramId: string): SiteRow {
    const site = this.db.getSiteById(siteId);
    if (!site || site.telegram_id !== userTelegramId) {
      throw new AppError(404, { ok: false, error: 'Site not found' });
    }
    return site;
  }

  private requireVerifiedDomain(domainId: number): DomainRow {
    const domain = this.db.getDomainById(domainId);
    if (!domain || !domain.verified) {
      throw new AppError(400, { ok: false, error: 'Domain not verified' });
    }
    return domain;
  }
}

export class WalletWorkflowService {
  constructor(
    private readonly db: Db,
    private readonly tonClientProvider: TonClientProvider
  ) {}

  linkWallet(userTelegramId: string, body: { address: string; network: string }) {
    if (body.network !== 'mainnet' && body.network !== '-239') {
      throw new AppError(400, { ok: false, error: 'Only mainnet network is allowed' });
    }
    const user = this.db.upsertUser(userTelegramId, body.address);
    return { ok: true, walletAddress: user.wallet_address };
  }

  async getAccountLastTx(address: string) {
    try {
      const acc = await this.tonClientProvider.getAccountState(Address.parse(address));
      const last = acc.account.last;
      if (!last?.hash) return { hash: null };

      try {
        return { hash: Buffer.from(last.hash, 'base64').toString('hex') };
      } catch {
        return { hash: last.hash };
      }
    } catch {
      throw new AppError(500, { hash: null });
    }
  }
}

function formatCreateTemplateError(err: unknown): string {
  if (err instanceof ZodError && err.issues.length > 0) {
    const first = err.issues[0];
    if (first.message === 'Invalid url' || first.code === 'invalid_string') {
      return 'Invalid link or URL. Use full URL with https:// (e.g. https://example.com)';
    }
    return first.message ?? 'Invalid template data';
  }
  return getErrorMessage(err, 'Invalid template data');
}

function getErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}
