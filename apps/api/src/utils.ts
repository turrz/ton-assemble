import fs from 'node:fs';
import path from 'node:path';
import { FastifyReply, FastifyRequest } from 'fastify';

export const ATTRIBUTION_URL = 'https://t.me/TonAssembleBot';

export const RESERVED_SLUGS = new Set([
  'preview',
  'api',
  'assets',
  'static',
  'connect',
  'health',
  'support',
  'domains',
  'create',
  'sites',
  'publish',
  'tonconnect-manifest.json',
  'index.html',
]);

export function is4nDomain(domain: string): boolean {
  const lower = domain.trim().toLowerCase();
  if (!lower.endsWith('.ton')) return false;
  const label = lower.slice(0, -4);
  return /^[0-9]{4}$/.test(label);
}

export function normalizeDomain(domain: string): string {
  return domain.toLowerCase();
}

export function normalizeSlug(slug?: string | null): string | null {
  return slug?.trim().toLowerCase().replace(/[^a-z0-9-]/g, '') || null;
}

export function getRequestHost(request: FastifyRequest): string {
  const raw = request.headers.host || request.headers['x-forwarded-host'] || '';
  return (typeof raw === 'string' ? raw : raw[0] ?? '').split(':')[0].trim().toLowerCase();
}

export function sendNoCacheHtml(reply: FastifyReply, html: string) {
  reply.header('Content-Type', 'text/html; charset=utf-8');
  reply.header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  reply.header('Pragma', 'no-cache');
  return reply.send(html);
}

export function readPublicIndex(): string {
  const indexPath = path.join(__dirname, '..', 'public', 'index.html');
  if (!fs.existsSync(indexPath)) {
    return '<!doctype html><html><head><meta charset="utf-8"><title>TonAssemble</title></head><body><p>TonAssemble web app has not been built yet.</p></body></html>';
  }
  return fs.readFileSync(indexPath, 'utf-8');
}
