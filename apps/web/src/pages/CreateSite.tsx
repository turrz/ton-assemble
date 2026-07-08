import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getDomains, createSite, is4nDomain } from '../api';
import { useLang } from '../context/LangContext';

type TemplateId = 'linktree' | 'project' | 'for-sale';

interface LinkItem {
  label: string;
  url: string;
}

interface FeatureItem {
  title: string;
  body: string;
}

const initialLink: LinkItem = { label: '', url: '' };
const initialFeature: FeatureItem = { title: '', body: '' };

const ACCENT_PRESETS = [
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Cyan', hex: '#06b6d4' },
  { name: 'Green', hex: '#22c55e' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Purple', hex: '#a855f7' },
  { name: 'Rose', hex: '#f43f5e' },
];

export default function CreateSite() {
  const navigate = useNavigate();
  const { t } = useLang();
  const [domains, setDomains] = useState<Awaited<ReturnType<typeof getDomains>>['domains']>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [domainId, setDomainId] = useState<string>('');
  const [template, setTemplate] = useState<TemplateId>('linktree');
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [links, setLinks] = useState<LinkItem[]>([{ ...initialLink }]);

  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [primaryLabel, setPrimaryLabel] = useState('');
  const [primaryUrl, setPrimaryUrl] = useState('');
  const [secondaryLabel, setSecondaryLabel] = useState('');
  const [secondaryUrl, setSecondaryUrl] = useState('');
  const [features, setFeatures] = useState<FeatureItem[]>([{ ...initialFeature }]);

  const [saleDomain, setSaleDomain] = useState('');
  const [priceTon, setPriceTon] = useState('');
  const [contactTg, setContactTg] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [saleDesc, setSaleDesc] = useState('');

  const [slug, setSlug] = useState('');
  const [accessKey, setAccessKey] = useState('');
  const [accentColor, setAccentColor] = useState('#3b82f6');

  useEffect(() => {
    getDomains()
      .then((r) => r.ok && setDomains(r.domains))
      .catch(() => setLoadError(t('loadDomainsFailed')))
      .finally(() => setLoading(false));
  }, [t]);

  const verifiedDomains = domains.filter((d) => d.verified);
  const selectedDomain = domains.find((d) => String(d.id) === domainId)?.domain ?? '';
  const effectiveDomain = (template === 'for-sale' ? saleDomain.trim() || selectedDomain : selectedDomain).trim().toLowerCase();

  useEffect(() => {
    if (template === 'for-sale' && selectedDomain) setSaleDomain(selectedDomain);
  }, [template, selectedDomain]);

  const addLink = () => setLinks((prev) => [...prev, { ...initialLink }]);
  const setLink = (i: number, field: keyof LinkItem, value: string) => {
    setLinks((prev) => prev.map((l, j) => (j === i ? { ...l, [field]: value } : l)));
  };
  const removeLink = (i: number) => setLinks((prev) => (prev.length <= 1 ? prev : prev.filter((_, j) => j !== i)));

  const addFeature = () => setFeatures((prev) => [...prev, { ...initialFeature }]);
  const setFeature = (i: number, field: keyof FeatureItem, value: string) => {
    setFeatures((prev) => prev.map((f, j) => (j === i ? { ...f, [field]: value } : f)));
  };
  const removeFeature = (i: number) => setFeatures((prev) => prev.filter((_, j) => j !== i));

  const ensureUrl = (raw: string): string => {
    const s = raw.trim();
    if (!s) return s;
    if (/^https?:\/\//i.test(s)) return s;
    return `https://${s}`;
  };

  const buildData = (): unknown => {
    if (template === 'linktree') {
      const validLinks = links.filter((l) => l.label.trim() && l.url.trim());
      if (validLinks.length === 0) throw new Error(t('addAtLeastOneLink'));
      return {
        title: title.trim() || 'My Links',
        subtitle: subtitle.trim() || undefined,
        avatarUrl: avatarUrl.trim() ? ensureUrl(avatarUrl) : undefined,
        accentColor: accentColor || undefined,
        links: validLinks.map((l) => ({ label: l.label.trim(), url: ensureUrl(l.url) })),
      };
    }
    if (template === 'project') {
      const validFeatures = features.filter((f) => f.title.trim() && f.body.trim());
      return {
        name: name.trim() || 'Project',
        tagline: tagline.trim() || '—',
        description: description.trim() || '',
        accentColor: accentColor || undefined,
        primaryActionLabel: primaryLabel.trim() || undefined,
        primaryActionUrl: primaryUrl.trim() ? ensureUrl(primaryUrl) : undefined,
        secondaryActionLabel: secondaryLabel.trim() || undefined,
        secondaryActionUrl: secondaryUrl.trim() ? ensureUrl(secondaryUrl) : undefined,
        features: validFeatures.length ? validFeatures.map((f) => ({ title: f.title.trim(), body: f.body.trim() })) : undefined,
      };
    }
    const price = parseFloat(priceTon);
    if (isNaN(price) || price < 0) throw new Error(t('invalidPrice'));
    return {
      domain: effectiveDomain,
      priceTon: price,
      accentColor: accentColor || undefined,
      contactTelegram: contactTg.trim() || undefined,
      contactEmail: contactEmail.trim() || undefined,
      description: saleDesc.trim() || undefined,
    };
  };

  const onSubmit = () => {
    if (!effectiveDomain) {
      setFormError(template === 'for-sale' ? t('enterDomainRequired') : t('selectDomainRequired'));
      return;
    }
    if (!is4nDomain(effectiveDomain) && !accessKey.trim()) {
      setFormError(t('non4nNeedKey'));
      return;
    }
    setFormError(null);
    setSubmitting(true);
    let data: unknown;
    try {
      data = buildData();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : t('invalidForm'));
      setSubmitting(false);
      return;
    }
    createSite({
      domain: effectiveDomain,
      template,
      data,
      slug: slug.trim() || undefined,
      accessKey: !is4nDomain(effectiveDomain) ? accessKey.trim() || undefined : undefined,
    })
      .then((r) => {
        if (r.ok) navigate(`/preview/${r.siteId}`);
      })
      .catch((e) => setFormError(e.message))
      .finally(() => setSubmitting(false));
  };

  const publicBase = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' ? window.location.origin : '');

  if (loading) return <p className="text-sm text-tg-hint">{t('loading')}</p>;

  if (loadError) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-red-400">{loadError}</p>
        <Link to="/" className="btn-secondary inline-block text-center">{t('home')}</Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[1.35rem] font-semibold tracking-tight text-tg-text">{t('createSiteTitle')}</h1>
        <p className="mt-1 text-sm text-tg-hint">{t('step2Hint')}</p>
      </div>

      {verifiedDomains.length === 0 && template !== 'for-sale' ? (
        <div className="card-app space-y-3">
          <p className="text-sm text-tg-hint">{t('noVerifiedDomains')}</p>
          <Link to="/domains" className="btn-primary inline-block text-center">{t('goToDomains')}</Link>
        </div>
      ) : (
        <div className="card-app">
          <label className="mb-1 block text-sm font-medium text-tg-hint">{t('domains')}</label>
          {template === 'for-sale' ? (
            <input
              type="text"
              value={saleDomain}
              onChange={(e) => setSaleDomain(e.target.value)}
              placeholder={t('domainExamplePlaceholder')}
              className="input-app"
            />
          ) : (
            <select
              value={domainId}
              onChange={(e) => setDomainId(e.target.value)}
              className="input-app"
            >
              <option value="">{t('selectDomain')}</option>
              {verifiedDomains.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.domain}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      <div className="card-app">
        <label className="mb-1 block text-sm font-medium text-tg-hint">{t('previewUrlSlug')}</label>
        <p className="mb-2 text-xs text-tg-hint">{t('slugExample')} → {publicBase}/{t('slugPlaceholder')}</p>
        <input
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value.replace(/[^a-z0-9-]/gi, '').toLowerCase().slice(0, 64))}
          placeholder={t('slugPlaceholder')}
          className="input-app"
        />
      </div>

      {effectiveDomain && !is4nDomain(effectiveDomain) && (
        <div className="card-app">
          <label className="mb-1 block text-sm font-medium text-tg-hint">{t('accessKeyLabel')}</label>
          <input
            type="text"
            value={accessKey}
            onChange={(e) => setAccessKey(e.target.value)}
            placeholder={t('accessKeyPlaceholder')}
            className="input-app"
          />
        </div>
      )}

      <div className="card-app">
        <label className="mb-2 block text-sm font-medium text-tg-hint">{t('selectTemplate')}</label>
        <div className="flex flex-wrap gap-2">
          {(['linktree', 'project', 'for-sale'] as const).map((tmpl) => (
            <button
              key={tmpl}
              type="button"
              onClick={() => setTemplate(tmpl)}
              className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${template === tmpl ? 'bg-tg-button text-tg-button-text' : 'border border-white/[0.12] text-tg-text hover:bg-white/5'}`}
            >
              {tmpl === 'linktree' ? t('linktree') : tmpl === 'project' ? t('project') : t('forSale')}
            </button>
          ))}
        </div>
      </div>

      <div className="card-app">
        <label className="mb-2 block text-sm font-medium text-tg-hint">{t('themeColor')}</label>
        <p className="mb-3 text-xs text-tg-hint">{t('themeColorHint')}</p>
        <div className="flex flex-wrap gap-2">
          {ACCENT_PRESETS.map(({ name, hex }) => (
            <button
              key={hex}
              type="button"
              onClick={() => setAccentColor(hex)}
              className={`flex h-9 w-9 items-center justify-center rounded-xl border-2 transition-all ${
                accentColor === hex ? 'border-tg-button scale-110' : 'border-white/20 hover:border-white/40'
              }`}
              style={{ backgroundColor: hex }}
              title={name}
            />
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <input
            type="text"
            value={accentColor}
            onChange={(e) => {
              const v = e.target.value.trim();
              if (v === '' || /^#[0-9a-fA-F]{6}$/.test(v)) setAccentColor(v || '#3b82f6');
            }}
            placeholder="#3b82f6"
            className="input-app max-w-[120px] font-mono text-sm"
          />
          <span className="text-xs text-tg-hint">{t('hexLabel')}</span>
        </div>
      </div>

      {template === 'linktree' && (
        <div className="card-app space-y-3">
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('title')} className="input-app" />
          <input type="text" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder={t('subtitleOptional')} className="input-app" />
          <input
            type="url"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder={t('avatarUrlPlaceholder')}
            className="input-app"
          />
          <p className="text-xs text-tg-hint">{t('avatarUrlHint')}</p>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm text-tg-hint">{t('links')}</span>
              <button type="button" onClick={addLink} className="text-sm text-tg-link">
                + {t('add')}
              </button>
            </div>
            {links.map((l, i) => (
              <div key={i} className="mb-2 flex gap-2">
                <input
                  type="text"
                  value={l.label}
                  onChange={(e) => setLink(i, 'label', e.target.value)}
                  placeholder={t('linkLabel')}
                  className="input-app flex-1 min-w-0"
                />
                <input
                  type="url"
                  value={l.url}
                  onChange={(e) => setLink(i, 'url', e.target.value)}
                  placeholder={t('linkUrlPlaceholder')}
                  className="input-app flex-1 min-w-0"
                />
                <button
                  type="button"
                  onClick={() => removeLink(i)}
                  disabled={links.length <= 1}
                  className="text-tg-hint hover:text-red-400 disabled:opacity-30"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {template === 'project' && (
        <div className="card-app space-y-3">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('projectName')} className="input-app" />
          <input type="text" value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder={t('tagline')} className="input-app" />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('description')}
            rows={3}
            className="input-app min-h-[80px]"
          />
          <input type="text" value={primaryLabel} onChange={(e) => setPrimaryLabel(e.target.value)} placeholder={t('primaryButtonLabelOptional')} className="input-app" />
          <input type="url" value={primaryUrl} onChange={(e) => setPrimaryUrl(e.target.value)} placeholder={t('primaryButtonUrl')} className="input-app" />
          <input type="text" value={secondaryLabel} onChange={(e) => setSecondaryLabel(e.target.value)} placeholder={t('secondaryButtonLabelOptional')} className="input-app" />
          <input type="url" value={secondaryUrl} onChange={(e) => setSecondaryUrl(e.target.value)} placeholder={t('secondaryButtonUrl')} className="input-app" />
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm text-tg-hint">{t('featuresOptional')}</span>
              <button type="button" onClick={addFeature} className="text-sm text-tg-link">
                + {t('add')}
              </button>
            </div>
            {features.map((f, i) => (
              <div key={i} className="mb-2 space-y-1">
                <input
                  type="text"
                  value={f.title}
                  onChange={(e) => setFeature(i, 'title', e.target.value)}
                  placeholder={t('featureTitle')}
                  className="input-app"
                />
                <textarea
                  value={f.body}
                  onChange={(e) => setFeature(i, 'body', e.target.value)}
                  placeholder={t('featureBody')}
                  rows={2}
                  className="input-app min-h-[60px]"
                />
                <button type="button" onClick={() => removeFeature(i)} className="text-sm text-tg-hint hover:text-red-400">
                  {t('remove')}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {template === 'for-sale' && (
        <div className="card-app space-y-3">
          <input
            type="number"
            min={0}
            step={0.1}
            value={priceTon}
            onChange={(e) => setPriceTon(e.target.value)}
            placeholder={t('priceTon')}
            className="input-app"
          />
          <input
            type="text"
            value={contactTg}
            onChange={(e) => setContactTg(e.target.value)}
            placeholder={t('contactTelegramOptional')}
            className="input-app"
          />
          <input
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder={t('contactEmailOptional')}
            className="input-app"
          />
          <textarea
            value={saleDesc}
            onChange={(e) => setSaleDesc(e.target.value)}
            placeholder={t('descriptionOptional')}
            rows={2}
            className="input-app min-h-[60px]"
          />
        </div>
      )}

      {formError && <p className="text-sm text-red-400">{formError}</p>}

      <button
        type="button"
        onClick={onSubmit}
        disabled={submitting || (verifiedDomains.length === 0 && template !== 'for-sale')}
        className="btn-primary disabled:opacity-50"
      >
        {submitting ? t('creating') : t('createAndPreview')}
      </button>
    </div>
  );
}
