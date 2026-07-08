import { z } from 'zod';

export const htmlEscape = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export interface RenderOptions {
  attributionUrl?: string;
}

const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/).optional();

export const linktreeSchema = z.object({
  title: z.string().min(1).max(80),
  subtitle: z.string().max(160).optional(),
  avatarUrl: z.string().url().max(200).optional(),
  accentColor: hexColorSchema,
  links: z
    .array(
      z.object({
        label: z.string().min(1).max(64),
        url: z.string().url().max(256),
      })
    )
    .min(1)
    .max(20),
});

export type LinktreeData = z.infer<typeof linktreeSchema>;

export const projectSchema = z.object({
  name: z.string().min(1).max(80),
  tagline: z.string().min(1).max(160),
  description: z.string().min(1).max(2000),
  accentColor: hexColorSchema,
  primaryActionLabel: z.string().min(1).max(40).optional(),
  primaryActionUrl: z.string().url().max(256).optional(),
  secondaryActionLabel: z.string().min(1).max(40).optional(),
  secondaryActionUrl: z.string().url().max(256).optional(),
  features: z
    .array(
      z.object({
        title: z.string().min(1).max(80),
        body: z.string().min(1).max(400),
      })
    )
    .max(12)
    .optional(),
});

export type ProjectData = z.infer<typeof projectSchema>;

export const forSaleSchema = z.object({
  domain: z.string().min(4).max(126),
  priceTon: z.number().min(0).max(1_000_000),
  accentColor: hexColorSchema,
  contactTelegram: z.string().min(1).max(64).optional(),
  contactEmail: z.string().email().max(160).optional(),
  description: z.string().max(1000).optional(),
});

export type ForSaleData = z.infer<typeof forSaleSchema>;

export type TemplateId = 'linktree' | 'project' | 'for-sale';

export type TemplateData = LinktreeData | ProjectData | ForSaleData;

const TONASSEMBLE_BOT_URL = 'https://t.me/TonAssembleBot';

/** Shared design tokens for all TON site templates */
const TF_BASE_STYLES = `
  :root {
    color-scheme: dark;
    --tf-bg: #0a0e14;
    --tf-card: rgba(15, 20, 28, 0.92);
    --tf-text: #e6e9ec;
    --tf-muted: #8b95a0;
    --tf-border: rgba(148, 163, 184, 0.2);
    --tf-accent: #3b82f6;
    --tf-accent-rgb: 59, 130, 246;
    --tf-radius: 20px;
    --tf-radius-sm: 12px;
  }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: var(--tf-text); -webkit-font-smoothing: antialiased; }
  .tf-badge {
    display: inline-block;
    margin-top: 12px;
    padding: 6px 12px;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--tf-muted);
    text-decoration: none;
    border: 1px solid var(--tf-border);
    background: var(--tf-card);
    transition: color 0.15s ease, border-color 0.15s ease;
  }
  .tf-badge:hover { color: var(--tf-accent); border-color: rgba(var(--tf-accent-rgb), 0.4); }
`;

/** CSS override when user sets accentColor (valid hex #RRGGBB). */
function accentOverride(hex: string | undefined): string {
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return '';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `:root { --tf-accent: ${hex}; --tf-accent-rgb: ${r}, ${g}, ${b}; } .tf-badge:hover { border-color: rgba(${r}, ${g}, ${b}, 0.4); }`;
}

function renderAttribution(options?: RenderOptions): string {
  const url = options?.attributionUrl ?? TONASSEMBLE_BOT_URL;
  const safeUrl = htmlEscape(url);
  return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="tf-badge">Made with TonAssemble</a>`;
}

export function renderLinktree(data: LinktreeData, options?: RenderOptions): string {
  const title = htmlEscape(data.title);
  const subtitle = data.subtitle ? htmlEscape(data.subtitle) : '';
  const avatar = data.avatarUrl ? `<img class="avatar" src="${htmlEscape(data.avatarUrl)}" alt="${title}">` : '';
  const links = data.links
    .map(
      (l) =>
        `<a class="link" href="${htmlEscape(l.url)}" rel="noopener noreferrer">${htmlEscape(
          l.label
        )}</a>`
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    ${TF_BASE_STYLES}
    ${accentOverride(data.accentColor)}
    body {
      background: radial-gradient(ellipse 80% 50% at 50% 0%, #1e293b, var(--tf-bg) 55%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      width: 100%;
      max-width: 520px;
      background: var(--tf-card);
      border-radius: var(--tf-radius);
      padding: 28px 24px 24px;
      box-shadow: 0 24px 56px rgba(0,0,0,0.35), 0 0 0 1px var(--tf-border);
      backdrop-filter: blur(12px);
    }
    .header { text-align: center; margin-bottom: 20px; }
    .avatar {
      width: 84px;
      height: 84px;
      border-radius: 50%;
      object-fit: cover;
      margin-bottom: 14px;
      border: 2px solid rgba(var(--tf-accent-rgb), 0.5);
      box-shadow: 0 0 0 4px rgba(var(--tf-accent-rgb), 0.12);
    }
    h1 { margin: 0 0 4px; font-size: 1.5rem; letter-spacing: -0.03em; font-weight: 600; }
    .subtitle { margin: 0; color: var(--tf-muted); font-size: 0.9rem; }
    .links { display: flex; flex-direction: column; gap: 10px; margin-top: 18px; }
    .link {
      display: block;
      width: 100%;
      text-align: center;
      text-decoration: none;
      padding: 14px 16px;
      border-radius: var(--tf-radius-sm);
      background: rgba(255,255,255,0.04);
      color: var(--tf-text);
      font-weight: 500;
      font-size: 0.95rem;
      border: 1px solid var(--tf-border);
      transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
    }
    .link:hover {
      background: rgba(var(--tf-accent-rgb), 0.12);
      border-color: rgba(var(--tf-accent-rgb), 0.4);
      transform: translateY(-1px);
    }
    .footer { margin-top: 20px; text-align: center; font-size: 0.8rem; color: var(--tf-muted); }
  </style>
</head>
<body>
  <main class="card">
    <header class="header">
      ${avatar}
      <h1>${title}</h1>
      ${subtitle ? `<p class="subtitle">${subtitle}</p>` : ''}
    </header>
    <section class="links">
      ${links}
    </section>
    <footer class="footer">
      ${renderAttribution(options)}
    </footer>
  </main>
</body>
</html>`;
}

export function renderProject(data: ProjectData, options?: RenderOptions): string {
  const name = htmlEscape(data.name);
  const tagline = htmlEscape(data.tagline);
  const description = htmlEscape(data.description);
  const primary =
    data.primaryActionLabel && data.primaryActionUrl
      ? `<a class="btn primary" href="${htmlEscape(
          data.primaryActionUrl
        )}" rel="noopener noreferrer">${htmlEscape(data.primaryActionLabel)}</a>`
      : '';
  const secondary =
    data.secondaryActionLabel && data.secondaryActionUrl
      ? `<a class="btn secondary" href="${htmlEscape(
          data.secondaryActionUrl
        )}" rel="noopener noreferrer">${htmlEscape(data.secondaryActionLabel)}</a>`
      : '';
  const features =
    data.features && data.features.length
      ? `<section class="features">
    ${data.features
      .map(
        (f) => `<article class="feature">
      <h3>${htmlEscape(f.title)}</h3>
      <p>${htmlEscape(f.body)}</p>
    </article>`
      )
      .join('\n')}
  </section>`
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${name}</title>
  <style>
    ${TF_BASE_STYLES}
    ${accentOverride(data.accentColor)}
    body {
      background:
        radial-gradient(ellipse 70% 45% at 0% 0%, #1e3a5f, transparent 55%),
        radial-gradient(ellipse 60% 40% at 100% 100%, #0f172a, var(--tf-bg) 60%);
      min-height: 100vh;
    }
    .shell { max-width: 960px; margin: 0 auto; padding: 32px 20px 48px; }
    header { display: flex; flex-direction: column; gap: 12px; margin-bottom: 28px; }
    h1 { margin: 0; font-size: clamp(1.85rem, 3vw, 2.5rem); letter-spacing: -0.04em; font-weight: 600; }
    .tagline { margin: 0; font-size: 1rem; max-width: 640px; color: var(--tf-muted); }
    .hero { display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); gap: 28px; align-items: flex-start; }
    @media (max-width: 768px) { .hero { grid-template-columns: minmax(0, 1fr); } }
    .card {
      background: var(--tf-card);
      border-radius: var(--tf-radius);
      padding: 22px 20px 20px;
      border: 1px solid var(--tf-border);
      box-shadow: 0 20px 50px rgba(0,0,0,0.3);
    }
    .description { font-size: 0.98rem; line-height: 1.65; color: var(--tf-text); white-space: pre-wrap; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 18px; }
    .btn {
      display: inline-flex; align-items: center; justify-content: center;
      padding: 10px 18px; border-radius: var(--tf-radius-sm); text-decoration: none;
      font-size: 0.9rem; font-weight: 500; border: 1px solid transparent;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }
    .btn.primary {
      background: var(--tf-accent);
      color: #fff;
      box-shadow: 0 4px 20px rgba(var(--tf-accent-rgb), 0.35);
    }
    .btn.primary:hover { transform: translateY(-1px); box-shadow: 0 6px 24px rgba(var(--tf-accent-rgb), 0.45); }
    .btn.secondary {
      border-color: var(--tf-border);
      color: var(--tf-text);
      background: rgba(255,255,255,0.04);
    }
    .btn.secondary:hover { border-color: rgba(148, 163, 184, 0.4); background: rgba(255,255,255,0.06); }
    .features { margin-top: 24px; display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
    .feature {
      background: var(--tf-card);
      border-radius: var(--tf-radius-sm);
      padding: 16px;
      border: 1px solid var(--tf-border);
    }
    .feature h3 { margin: 0 0 6px; font-size: 0.95rem; font-weight: 600; }
    .feature p { margin: 0; font-size: 0.85rem; color: var(--tf-muted); line-height: 1.5; }
    footer { margin-top: 36px; font-size: 0.8rem; color: var(--tf-muted); text-align: center; }
  </style>
</head>
<body>
  <div class="shell">
    <header>
      <h1>${name}</h1>
      <p class="tagline">${tagline}</p>
    </header>
    <section class="hero">
      <div class="card">
        <p class="description">${description}</p>
        <div class="actions">
          ${primary}
          ${secondary}
        </div>
      </div>
      ${features || ''}
    </section>
    <footer>
      ${renderAttribution(options)}
    </footer>
  </div>
</body>
</html>`;
}

export function renderForSale(data: ForSaleData, options?: RenderOptions): string {
  const domain = htmlEscape(data.domain);
  const price = data.priceTon.toLocaleString('en-US', {
    maximumFractionDigits: 4,
  });
  const contactLines: string[] = [];
  if (data.contactTelegram) {
    contactLines.push(
      `<div class="contact-item">Telegram: <a href="https://t.me/${htmlEscape(
        data.contactTelegram.replace(/^@/, '')
      )}" rel="noopener noreferrer">@${htmlEscape(
        data.contactTelegram.replace(/^@/, '')
      )}</a></div>`
    );
  }
  if (data.contactEmail) {
    contactLines.push(
      `<div class="contact-item">Email: <a href="mailto:${htmlEscape(
        data.contactEmail
      )}">${htmlEscape(data.contactEmail)}</a></div>`
    );
  }
  const description = data.description ? `<p class="description">${htmlEscape(data.description)}</p>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${domain} · For Sale</title>
  <style>
    ${TF_BASE_STYLES}
    ${accentOverride(data.accentColor)}
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background:
        radial-gradient(ellipse 70% 50% at 50% 0%, rgba(251, 146, 60, 0.15), transparent 55%),
        var(--tf-bg);
      padding: 24px;
    }
    .card {
      width: 100%;
      max-width: 520px;
      background: var(--tf-card);
      border-radius: var(--tf-radius);
      padding: 26px 24px 22px;
      border: 1px solid var(--tf-border);
      box-shadow: 0 24px 56px rgba(0,0,0,0.35);
    }
    .label {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px;
      border-radius: 999px;
      font-size: 0.72rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      background: rgba(251, 146, 60, 0.15);
      border: 1px solid rgba(251, 146, 60, 0.45);
      color: #fbbf24;
      margin-bottom: 14px;
    }
    h1 { margin: 0 0 4px; font-size: 1.85rem; letter-spacing: -0.04em; font-weight: 600; }
    .domain { color: #fbbf24; }
    .price { margin-top: 12px; font-size: 1.25rem; font-weight: 600; color: #fecaca; }
    .price span { font-size: 0.9rem; font-weight: 500; color: var(--tf-muted); margin-left: 6px; }
    .description { margin-top: 14px; font-size: 0.95rem; line-height: 1.6; color: var(--tf-text); }
    .meta {
      margin-top: 18px;
      padding-top: 14px;
      border-top: 1px dashed var(--tf-border);
      font-size: 0.85rem;
      color: var(--tf-muted);
    }
    .contact-item { margin-top: 6px; }
    .meta a { color: #fcd34d; text-decoration: none; }
    .meta a:hover { text-decoration: underline; }
    .hint { margin-top: 14px; font-size: 0.8rem; color: var(--tf-muted); }
  </style>
</head>
<body>
  <article class="card">
    <div class="label">TON Domain · For sale</div>
    <h1><span class="domain">${domain}</span></h1>
    <div class="price">
      ${price} TON <span>(or best offer)</span>
    </div>
    ${description}
    <section class="meta">
      <div>Interested? Reach out:</div>
      ${contactLines.join('') || '<div class="contact-item">Contact details available via TonAssemble.</div>'}
      <div class="hint">
        Ownership is verified on-chain. Final sale is completed via a secure TON transfer.
      </div>
      ${renderAttribution(options)}
    </section>
  </article>
</body>
</html>`;
}

export function renderTemplate(id: TemplateId, rawData: unknown, options?: RenderOptions): string {
  switch (id) {
    case 'linktree': {
      const data = linktreeSchema.parse(rawData);
      return renderLinktree(data, options);
    }
    case 'project': {
      const data = projectSchema.parse(rawData);
      return renderProject(data, options);
    }
    case 'for-sale': {
      const data = forSaleSchema.parse(rawData);
      return renderForSale(data, options);
    }
    default:
      throw new Error(`Unknown template id: ${id}`);
  }
}

