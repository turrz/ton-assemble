const API_URL = import.meta.env.VITE_API_URL || '';

function getInitData(): string {
  const tg = window.Telegram?.WebApp;
  return tg?.initData || '';
}

function headers(): HeadersInit {
  const initData = getInitData();
  const h: HeadersInit = { 'Content-Type': 'application/json' };
  if (initData) (h as Record<string, string>)['X-Telegram-Init-Data'] = initData;
  return h;
}

async function handleRes<T>(r: Response): Promise<T> {
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data as { error?: string }).error || r.statusText);
  return data as T;
}

export async function linkWallet(address: string, network: string): Promise<{ ok: boolean }> {
  const res = await fetch(`${API_URL}/api/tonconnect/link-wallet`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ address, network }),
  });
  return handleRes(res);
}

export async function getDomains(): Promise<{
  ok: boolean;
  domains: Array<{
    id: number;
    domain: string;
    verified: boolean;
    ownerAddress: string | null;
    sites: Array<{
      id: number;
      domain_id: number;
      template: string;
      status: string;
      data_json: string;
      content_id: string | null;
      slug: string | null;
      created_at: string;
    }>;
  }>;
}> {
  const res = await fetch(`${API_URL}/api/domains`, { headers: headers() });
  return handleRes(res);
}

export async function verifyDomain(domain: string, accessKey?: string): Promise<{
  ok: boolean;
  domain: string;
  ownerAddress: string;
}> {
  const res = await fetch(`${API_URL}/api/domains/verify`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ domain: domain.trim().toLowerCase(), accessKey: accessKey?.trim() || undefined }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((data as { error?: string }).error || res.statusText) as Error & { requiresAccessKey?: boolean };
    (err as Error & { requiresAccessKey?: boolean }).requiresAccessKey = !!(data as { requiresAccessKey?: boolean }).requiresAccessKey;
    throw err;
  }
  return data as { ok: boolean; domain: string; ownerAddress: string };
}

export function is4nDomain(domain: string): boolean {
  const d = domain.trim().toLowerCase();
  if (!d.endsWith('.ton')) return false;
  return /^[0-9]{4}$/.test(d.slice(0, -4));
}

export async function createSite(params: {
  domain: string;
  template: 'linktree' | 'project' | 'for-sale';
  data: unknown;
  slug?: string;
  accessKey?: string;
}): Promise<{ ok: boolean; siteId: number }> {
  const res = await fetch(`${API_URL}/api/sites`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(params),
  });
  return handleRes(res);
}

export async function updateSite(
  siteId: number,
  data: { template?: 'linktree' | 'project' | 'for-sale'; data?: unknown; slug?: string | null }
): Promise<{ ok: boolean; site: unknown }> {
  const res = await fetch(`${API_URL}/api/sites/${siteId}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify({
      template: data.template,
      data: data.data,
      slug: data.slug,
    }),
  });
  return handleRes(res);
}

export async function addDomainToSite(siteId: number, domainId: number): Promise<{ ok: boolean; domains: unknown[] }> {
  const res = await fetch(`${API_URL}/api/sites/${siteId}/domains`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ domainId }),
  });
  return handleRes(res);
}

export async function getSite(siteId: number): Promise<{
  ok: boolean;
  site: {
    id: number;
    domain_id: number;
    template: string;
    data_json: string;
    status: string;
    slug: string | null;
    domainName: string | null;
    domains: Array<{ id: number; domain: string }>;
  };
}> {
  const res = await fetch(`${API_URL}/api/sites/${siteId}`, { headers: headers() });
  return handleRes(res);
}

export async function publishSite(siteId: number): Promise<{
  ok: boolean;
  siteId: number;
  contentId: string | null;
  domain: string;
  tx: { validUntil: number; messages: Array<{ address: string; amount: string; payload?: string }> };
  previewUrl: string;
  useAdnl?: boolean;
  adnlLinkUrl?: string;
}> {
  const res = await fetch(`${API_URL}/api/sites/${siteId}/publish`, {
    method: 'POST',
    headers: headers(),
    body: '{}',
  });
  return handleRes(res);
}

export async function confirmPublish(
  siteId: number,
  txHashHex: string,
  fromAddress: string
): Promise<{ ok: boolean }> {
  const res = await fetch(`${API_URL}/api/sites/${siteId}/publish/confirm`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ txHashHex, fromAddress }),
  });
  return handleRes(res);
}

export async function getSiteHistory(siteId: number): Promise<{
  ok: boolean;
  versions: Array<{ id: number; status: string; updated_at: string }>;
}> {
  const res = await fetch(`${API_URL}/api/sites/${siteId}/history`, { headers: headers() });
  return handleRes(res);
}

export async function rollbackSite(siteId: number): Promise<{ ok: boolean; siteId: number }> {
  const res = await fetch(`${API_URL}/api/sites/${siteId}/rollback`, {
    method: 'POST',
    headers: headers(),
  });
  return handleRes(res);
}

export async function getSupportConfig(): Promise<{
  donateTonAddress: string | null;
  donateText: string | null;
  contactTelegram: string | null;
  contactX: string | null;
  contactEmail: string | null;
}> {
  const res = await fetch(`${API_URL}/api/support-config`);
  return handleRes(res);
}

export function previewUrl(siteId: number): string {
  return `${API_URL}/preview/${siteId}`;
}

export async function getAccountLastTxHash(address: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_URL}/api/account-last-tx?address=${encodeURIComponent(address)}`, {
      headers: headers(),
    });
    const d = await res.json();
    return d.hash ?? null;
  } catch {
    return null;
  }
}
