import Database from 'better-sqlite3';
import { z } from 'zod';
import path from 'node:path';
import fs from 'node:fs';

export type SiteStatus = 'draft' | 'uploading' | 'waiting_dns_tx' | 'published' | 'failed';

export interface DbConfig {
  dbPath: string;
}

export interface UserRow {
  telegram_id: string;
  wallet_address: string | null;
  created_at: string;
}

export interface DomainRow {
  id: number;
  telegram_id: string;
  domain: string;
  owner_address: string | null;
  verified: number;
  created_at: string;
}

export interface SiteRow {
  id: number;
  telegram_id: string;
  domain_id: number;
  template: string;
  data_json: string;
  status: SiteStatus;
  content_id: string | null;
  dns_tx_hash: string | null;
  slug: string | null;
  created_at: string;
  updated_at: string;
}

export interface AccessKeyRow {
  id: number;
  key_hash: string;
  created_by: string;
  created_at: string;
}

const siteStatusSchema = z.enum(['draft', 'uploading', 'waiting_dns_tx', 'published', 'failed']);

export class Db {
  private db: Database.Database;

  constructor(config: DbConfig) {
    const dir = path.dirname(config.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.db = new Database(config.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.migrate();
  }

  private migrate() {
    const createUsers = `
      CREATE TABLE IF NOT EXISTS users (
        telegram_id TEXT PRIMARY KEY,
        wallet_address TEXT,
        created_at TEXT NOT NULL
      )
    `;
    const createDomains = `
      CREATE TABLE IF NOT EXISTS domains (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_id TEXT NOT NULL,
        domain TEXT NOT NULL,
        owner_address TEXT,
        verified INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        UNIQUE(domain),
        FOREIGN KEY (telegram_id) REFERENCES users(telegram_id)
      )
    `;
    const createSites = `
      CREATE TABLE IF NOT EXISTS sites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_id TEXT NOT NULL,
        domain_id INTEGER NOT NULL,
        template TEXT NOT NULL,
        data_json TEXT NOT NULL,
        status TEXT NOT NULL,
        content_id TEXT,
        dns_tx_hash TEXT,
        slug TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (telegram_id) REFERENCES users(telegram_id),
        FOREIGN KEY (domain_id) REFERENCES domains(id)
      )
    `;
    const createAccessKeys = `
      CREATE TABLE IF NOT EXISTS access_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key_hash TEXT NOT NULL UNIQUE,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `;
    const createSiteDomains = `
      CREATE TABLE IF NOT EXISTS site_domains (
        site_id INTEGER NOT NULL,
        domain_id INTEGER NOT NULL,
        PRIMARY KEY (site_id, domain_id),
        FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE,
        FOREIGN KEY (domain_id) REFERENCES domains(id)
      )
    `;
    this.db.exec('BEGIN');
    try {
      this.db.exec(createUsers);
      this.db.exec(createDomains);
      this.db.exec(createSites);
      this.db.exec(createAccessKeys);
      this.db.exec(createSiteDomains);
      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
    this.migrateAddSlug();
    this.migrateSiteDomains();
  }

  private migrateAddSlug(): void {
    try {
      this.db.exec('ALTER TABLE sites ADD COLUMN slug TEXT');
    } catch {
      // column already exists
    }
  }

  private migrateSiteDomains(): void {
    const count = this.db.prepare('SELECT COUNT(*) as c FROM site_domains').get() as { c: number };
    if (count.c > 0) return;
    const sites = this.db.prepare('SELECT id, domain_id FROM sites').all() as { id: number; domain_id: number }[];
    const insert = this.db.prepare('INSERT OR IGNORE INTO site_domains (site_id, domain_id) VALUES (?, ?)');
    for (const s of sites) {
      insert.run(s.id, s.domain_id);
    }
  }

  upsertUser(telegramId: string, walletAddress?: string | null): UserRow {
    const now = new Date().toISOString();
    const existing = this.getUser(telegramId);
    if (existing) {
      if (walletAddress && walletAddress !== existing.wallet_address) {
        this.db
          .prepare('UPDATE users SET wallet_address = ? WHERE telegram_id = ?')
          .run(walletAddress, telegramId);
        return { ...existing, wallet_address: walletAddress };
      }
      return existing;
    }
    this.db
      .prepare('INSERT INTO users (telegram_id, wallet_address, created_at) VALUES (?, ?, ?)')
      .run(telegramId, walletAddress ?? null, now);
    return {
      telegram_id: telegramId,
      wallet_address: walletAddress ?? null,
      created_at: now,
    };
  }

  getUser(telegramId: string): UserRow | null {
    const row = this.db
      .prepare('SELECT telegram_id, wallet_address, created_at FROM users WHERE telegram_id = ?')
      .get(telegramId) as UserRow | undefined;
    return row ?? null;
  }

  updateUserWallet(telegramId: string, walletAddress: string): void {
    this.db
      .prepare('UPDATE users SET wallet_address = ? WHERE telegram_id = ?')
      .run(walletAddress, telegramId);
  }

  insertOrUpdateDomain(params: {
    telegramId: string;
    domain: string;
    ownerAddress: string | null;
    verified: boolean;
  }): DomainRow {
    const now = new Date().toISOString();
    const existing = this.getDomainByName(params.domain);
    if (existing) {
      this.db
        .prepare(
          'UPDATE domains SET telegram_id = ?, owner_address = ?, verified = ? WHERE id = ?'
        )
        .run(
          params.telegramId,
          params.ownerAddress,
          params.verified ? 1 : 0,
          existing.id
        );
      return {
        ...existing,
        telegram_id: params.telegramId,
        owner_address: params.ownerAddress,
        verified: params.verified ? 1 : 0,
      };
    }
    const info = this.db
      .prepare(
        'INSERT INTO domains (telegram_id, domain, owner_address, verified, created_at) VALUES (?, ?, ?, ?, ?)'
      )
      .run(params.telegramId, params.domain, params.ownerAddress, params.verified ? 1 : 0, now);
    return {
      id: Number(info.lastInsertRowid),
      telegram_id: params.telegramId,
      domain: params.domain,
      owner_address: params.ownerAddress,
      verified: params.verified ? 1 : 0,
      created_at: now,
    };
  }

  getDomainByName(domain: string): DomainRow | null {
    const row = this.db
      .prepare(
        'SELECT id, telegram_id, domain, owner_address, verified, created_at FROM domains WHERE domain = ?'
      )
      .get(domain) as DomainRow | undefined;
    return row ?? null;
  }

  getDomainById(id: number): DomainRow | null {
    const row = this.db
      .prepare(
        'SELECT id, telegram_id, domain, owner_address, verified, created_at FROM domains WHERE id = ?'
      )
      .get(id) as DomainRow | undefined;
    return row ?? null;
  }

  listDomainsForUser(telegramId: string): DomainRow[] {
    const rows = this.db
      .prepare(
        'SELECT id, telegram_id, domain, owner_address, verified, created_at FROM domains WHERE telegram_id = ? ORDER BY created_at DESC'
      )
      .all(telegramId) as DomainRow[];
    return rows;
  }

  createSite(params: {
    telegramId: string;
    domainId: number;
    template: string;
    dataJson: unknown;
    slug?: string | null;
  }): SiteRow {
    const now = new Date().toISOString();
    const dataJson = JSON.stringify(params.dataJson);
    const status: SiteStatus = 'draft';
    const slug = params.slug?.trim() || null;
    const info = this.db
      .prepare(
        `INSERT INTO sites (telegram_id, domain_id, template, data_json, status, content_id, dns_tx_hash, slug, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?)`
      )
      .run(params.telegramId, params.domainId, params.template, dataJson, status, slug, now, now);
    const siteId = Number(info.lastInsertRowid);
    this.db.prepare('INSERT OR IGNORE INTO site_domains (site_id, domain_id) VALUES (?, ?)').run(siteId, params.domainId);
    return {
      id: siteId,
      telegram_id: params.telegramId,
      domain_id: params.domainId,
      template: params.template,
      data_json: dataJson,
      status,
      content_id: null,
      dns_tx_hash: null,
      slug,
      created_at: now,
      updated_at: now,
    };
  }

  getSiteById(id: number): SiteRow | null {
    const row = this.db
      .prepare(
        `SELECT id, telegram_id, domain_id, template, data_json, status, content_id, dns_tx_hash, slug, created_at, updated_at
         FROM sites WHERE id = ?`
      )
      .get(id) as SiteRow | undefined;
    if (!row) return null;
    if (!siteStatusSchema.safeParse(row.status).success) {
      throw new Error(`Invalid site status in DB: ${row.status}`);
    }
    return row;
  }

  updateSiteStatus(id: number, status: SiteStatus, fields?: Partial<Pick<SiteRow, 'content_id' | 'dns_tx_hash'>>): void {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(
      `UPDATE sites
       SET status = ?, content_id = COALESCE(?, content_id), dns_tx_hash = COALESCE(?, dns_tx_hash), updated_at = ?
       WHERE id = ?`
    );
    stmt.run(status, fields?.content_id ?? null, fields?.dns_tx_hash ?? null, now, id);
  }

  listSitesForDomain(domainId: number, telegramId: string): SiteRow[] {
    const rows = this.db
      .prepare(
        `SELECT id, telegram_id, domain_id, template, data_json, status, content_id, dns_tx_hash, slug, created_at, updated_at
         FROM sites WHERE domain_id = ? AND telegram_id = ? ORDER BY created_at DESC`
      )
      .all(domainId, telegramId) as SiteRow[];
    return rows;
  }

  listLastPublishedVersions(domainId: number, telegramId: string, limit = 3): SiteRow[] {
    const rows = this.db
      .prepare(
        `SELECT id, telegram_id, domain_id, template, data_json, status, content_id, dns_tx_hash, slug, created_at, updated_at
         FROM sites
         WHERE domain_id = ? AND telegram_id = ? AND status = 'published'
         ORDER BY updated_at DESC
         LIMIT ?`
      )
      .all(domainId, telegramId, limit) as SiteRow[];
    return rows;
  }

  getSiteBySlug(slug: string): SiteRow | null {
    const row = this.db
      .prepare(
        `SELECT id, telegram_id, domain_id, template, data_json, status, content_id, dns_tx_hash, slug, created_at, updated_at
         FROM sites WHERE slug = ?`
      )
      .get(slug) as SiteRow | undefined;
    return row ?? null;
  }

  updateSiteDraft(id: number, telegramId: string, data: { template?: string; data_json?: string; slug?: string | null }): void {
    const site = this.getSiteById(id);
    if (!site || site.telegram_id !== telegramId || site.status !== 'draft') {
      throw new Error('Site not found or not a draft');
    }
    const now = new Date().toISOString();
    const updates: string[] = ['updated_at = ?'];
    const values: (string | null)[] = [now];
    if (data.template !== undefined) {
      updates.push('template = ?');
      values.push(data.template);
    }
    if (data.data_json !== undefined) {
      updates.push('data_json = ?');
      values.push(data.data_json);
    }
    if (data.slug !== undefined) {
      updates.push('slug = ?');
      values.push(data.slug?.trim() || null);
    }
    values.push(String(id));
    this.db.prepare(`UPDATE sites SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  }

  addSiteDomain(siteId: number, domainId: number, telegramId: string): void {
    const site = this.getSiteById(siteId);
    if (!site || site.telegram_id !== telegramId) throw new Error('Site not found');
    this.db.prepare('INSERT OR IGNORE INTO site_domains (site_id, domain_id) VALUES (?, ?)').run(siteId, domainId);
  }

  listDomainsForSite(siteId: number): DomainRow[] {
    const rows = this.db
      .prepare(
        `SELECT d.id, d.telegram_id, d.domain, d.owner_address, d.verified, d.created_at
         FROM domains d INNER JOIN site_domains sd ON d.id = sd.domain_id WHERE sd.site_id = ?`
      )
      .all(siteId) as DomainRow[];
    return rows;
  }

  createAccessKey(keyHash: string, createdBy: string): void {
    const now = new Date().toISOString();
    this.db.prepare('INSERT INTO access_keys (key_hash, created_by, created_at) VALUES (?, ?, ?)').run(keyHash, createdBy, now);
  }

  consumeAccessKey(keyHash: string): boolean {
    const row = this.db.prepare('SELECT id FROM access_keys WHERE key_hash = ?').get(keyHash) as { id: number } | undefined;
    if (!row) return false;
    this.db.prepare('DELETE FROM access_keys WHERE key_hash = ?').run(keyHash);
    return true;
  }

  /** Latest published site for a domain (by domain_id), via site_domains so multiple domains can point to one site. */
  getLatestPublishedSiteByDomainId(domainId: number): SiteRow | null {
    const row = this.db
      .prepare(
        `SELECT s.id, s.telegram_id, s.domain_id, s.template, s.data_json, s.status, s.content_id, s.dns_tx_hash, s.slug, s.created_at, s.updated_at
         FROM sites s INNER JOIN site_domains sd ON s.id = sd.site_id
         WHERE sd.domain_id = ? AND s.status = 'published' ORDER BY s.updated_at DESC LIMIT 1`
      )
      .get(domainId) as SiteRow | undefined;
    return row ?? null;
  }

  /** True if an upload is currently in progress for this domain (blocks concurrent uploads). */
  hasPendingPublish(telegramId: string, domainId: number): boolean {
    const row = this.db
      .prepare(
        `SELECT id FROM sites
         WHERE telegram_id = ? AND domain_id = ? AND status = 'uploading' LIMIT 1`
      )
      .get(telegramId, domainId) as { id: number } | undefined;
    return !!row;
  }
}

