import { z } from 'zod';

export const siteIdParamsSchema = z.object({
  siteId: z.coerce.number().int().positive(),
});

export const slugParamsSchema = z.object({
  slug: z.string().min(1).max(64),
});

export const connectQuerySchema = z.object({
  tg_id: z.string().optional(),
});

export const verifyDomainBodySchema = z.object({
  domain: z.string().min(4).max(126),
  accessKey: z.string().optional(),
});

export const createSiteBodySchema = z.object({
  domain: z.string().min(4).max(126),
  template: z.enum(['linktree', 'project', 'for-sale']),
  data: z.record(z.string(), z.unknown()),
  slug: z.string().max(64).optional(),
  accessKey: z.string().optional(),
});

export const updateSiteBodySchema = z.object({
  template: z.enum(['linktree', 'project', 'for-sale']).optional(),
  data: z.unknown().optional(),
  slug: z.string().max(64).nullable().optional(),
});

export const linkWalletBodySchema = z.object({
  address: z.string().min(1),
  network: z.string().min(1),
});

export const confirmPublishBodySchema = z.object({
  txHashHex: z.string().regex(/^[0-9a-fA-F]{64}$/),
  fromAddress: z.string().min(1),
});

export const accountLastTxQuerySchema = z.object({
  address: z.string().min(1),
});

export const addSiteDomainBodySchema = z.object({
  domainId: z.number().int().positive(),
});

export type TemplateId = z.infer<typeof createSiteBodySchema>['template'];
