import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSite, updateSite } from '../api';
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

export default function EditSite() {
  const { siteId } = useParams<{ siteId: string }>();
  const navigate = useNavigate();
  const { t } = useLang();
  const id = siteId ? parseInt(siteId, 10) : 0;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [template, setTemplate] = useState<TemplateId>('linktree');
  const [slug, setSlug] = useState('');
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
  const [accentColor, setAccentColor] = useState('#3b82f6');
  const [domainName, setDomainName] = useState('');

  useEffect(() => {
    if (!id || !Number.isInteger(id) || id <= 0) {
      setError(t('invalidSiteId'));
      setLoading(false);
      return;
    }
    getSite(id)
      .then((r) => {
        if (!r.ok || !r.site) {
          setError(t('siteNotFound'));
          return;
        }
        const s = r.site;
        if (s.status !== 'draft') {
          setError(t('onlyDraftsEditable'));
          return;
        }
        setTemplate(s.template as TemplateId);
        setSlug(s.slug || '');
        setDomainName(s.domainName || '');
        const data = JSON.parse(s.data_json) as Record<string, unknown>;
        setAccentColor((data.accentColor as string) || '#3b82f6');
        if (s.template === 'linktree') {
          setTitle((data.title as string) || '');
          setSubtitle((data.subtitle as string) || '');
          setAvatarUrl((data.avatarUrl as string) || '');
          const linkList = (data.links as Array<{ label: string; url: string }>) || [];
          setLinks(linkList.length ? linkList.map((l) => ({ label: l.label || '', url: l.url || '' })) : [{ ...initialLink }]);
        } else if (s.template === 'project') {
          setName((data.name as string) || '');
          setTagline((data.tagline as string) || '');
          setDescription((data.description as string) || '');
          setPrimaryLabel((data.primaryActionLabel as string) || '');
          setPrimaryUrl((data.primaryActionUrl as string) || '');
          setSecondaryLabel((data.secondaryActionLabel as string) || '');
          setSecondaryUrl((data.secondaryActionUrl as string) || '');
          const feat = (data.features as Array<{ title: string; body: string }>) || [];
          setFeatures(feat.length ? feat : [{ ...initialFeature }]);
        } else {
          setSaleDomain((data.domain as string) || '');
          setPriceTon(String(data.priceTon ?? ''));
          setContactTg((data.contactTelegram as string) || '');
          setContactEmail((data.contactEmail as string) || '');
          setSaleDesc((data.description as string) || '');
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const ensureUrl = (raw: string): string => {
    const s = raw.trim();
    if (!s) return s;
    if (/^https?:\/\//i.test(s)) return s;
    return `https://${s}`;
  };

  const buildData = (): unknown => {
    if (template === 'linktree') {
      const validLinks = links.filter((l) => l.label.trim() && l.url.trim());
      if (validLinks.length === 0) throw new Error('Add at least one link');
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
    if (isNaN(price) || price < 0) throw new Error('Invalid price');
    return {
      domain: saleDomain.trim().toLowerCase(),
      priceTon: price,
      accentColor: accentColor || undefined,
      contactTelegram: contactTg.trim() || undefined,
      contactEmail: contactEmail.trim() || undefined,
      description: saleDesc.trim() || undefined,
    };
  };

  const onSubmit = () => {
    setError(null);
    setSubmitting(true);
    let data: unknown;
    try {
      data = buildData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid form');
      setSubmitting(false);
      return;
    }
    updateSite(id, { template, data, slug: slug.trim() || null })
      .then(() => navigate(`/preview/${id}`))
      .catch((e) => setError(e.message))
      .finally(() => setSubmitting(false));
  };

  const addLink = () => setLinks((prev) => [...prev, { ...initialLink }]);
  const setLink = (i: number, field: keyof LinkItem, value: string) => {
    setLinks((prev) => prev.map((l, j) => (j === i ? { ...l, [field]: value } : l)));
  };
  const removeLink = (i: number) => setLinks((prev) => prev.filter((_, j) => j !== i));
  const addFeature = () => setFeatures((prev) => [...prev, { ...initialFeature }]);
  const setFeature = (i: number, field: keyof FeatureItem, value: string) => {
    setFeatures((prev) => prev.map((f, j) => (j === i ? { ...f, [field]: value } : f)));
  };
  const removeFeature = (i: number) => setFeatures((prev) => prev.filter((_, j) => j !== i));

  const ACCENT_PRESETS = [
    { name: 'Blue', hex: '#3b82f6' },
    { name: 'Cyan', hex: '#06b6d4' },
    { name: 'Green', hex: '#22c55e' },
    { name: 'Orange', hex: '#f97316' },
    { name: 'Purple', hex: '#a855f7' },
    { name: 'Rose', hex: '#f43f5e' },
  ];

  if (loading) return <p className="text-sm text-tg-hint">Loading…</p>;
  if (error && !submitting) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-red-400">{error}</p>
        <button type="button" onClick={() => navigate('/sites')} className="btn-secondary">
          {t('backToMySites')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[1.35rem] font-semibold tracking-tight text-tg-text">{t('editDraft')}</h1>
        <p className="mt-1 text-sm text-tg-hint">{domainName}</p>
      </div>

      <div className="card-app">
        <label className="mb-1 block text-sm font-medium text-tg-hint">{t('newUrlSlug')}</label>
        <input
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value.replace(/[^a-z0-9-]/gi, '').toLowerCase().slice(0, 64))}
          placeholder="my-page"
          className="input-app"
        />
      </div>

      <div className="card-app">
        <label className="mb-2 block text-sm font-medium text-tg-hint">{t('themeColor')}</label>
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
        <input
          type="text"
          value={accentColor}
          onChange={(e) => {
            const v = e.target.value.trim();
            if (v === '' || /^#[0-9a-fA-F]{6}$/.test(v)) setAccentColor(v || '#3b82f6');
          }}
          className="input-app mt-2 max-w-[120px] font-mono text-sm"
        />
      </div>

      {template === 'linktree' && (
        <div className="card-app space-y-3">
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="input-app" />
          <input type="text" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Subtitle" className="input-app" />
          <input type="url" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="Avatar URL" className="input-app" />
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm text-tg-hint">Links</span>
              <button type="button" onClick={addLink} className="text-sm text-tg-link">+ Add</button>
            </div>
            {links.map((l, i) => (
              <div key={i} className="mb-2 flex gap-2">
                <input type="text" value={l.label} onChange={(e) => setLink(i, 'label', e.target.value)} placeholder="Label" className="flex-1 rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-sm text-tg-text" />
                <input type="url" value={l.url} onChange={(e) => setLink(i, 'url', e.target.value)} placeholder="URL" className="flex-1 rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-sm text-tg-text" />
                <button type="button" onClick={() => removeLink(i)} className="text-tg-hint hover:text-red-400">×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {template === 'project' && (
        <div className="card-app space-y-3">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Project name" className="input-app" />
          <input type="text" value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Tagline" className="input-app" />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" className="input-app min-h-[80px]" />
          <input type="text" value={primaryLabel} onChange={(e) => setPrimaryLabel(e.target.value)} placeholder="Primary button label" className="input-app" />
          <input type="url" value={primaryUrl} onChange={(e) => setPrimaryUrl(e.target.value)} placeholder="Primary button URL" className="input-app" />
          <input type="text" value={secondaryLabel} onChange={(e) => setSecondaryLabel(e.target.value)} placeholder="Secondary button label" className="input-app" />
          <input type="url" value={secondaryUrl} onChange={(e) => setSecondaryUrl(e.target.value)} placeholder="Secondary button URL" className="input-app" />
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm text-tg-hint">Features</span>
              <button type="button" onClick={addFeature} className="text-sm text-tg-link">+ Add</button>
            </div>
            {features.map((f, i) => (
              <div key={i} className="mb-2 flex gap-2">
                <input type="text" value={f.title} onChange={(e) => setFeature(i, 'title', e.target.value)} placeholder="Title" className="flex-1 rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-sm text-tg-text" />
                <input type="text" value={f.body} onChange={(e) => setFeature(i, 'body', e.target.value)} placeholder="Body" className="flex-1 rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-sm text-tg-text" />
                <button type="button" onClick={() => removeFeature(i)} className="text-tg-hint hover:text-red-400">×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {template === 'for-sale' && (
        <div className="card-app space-y-3">
          <input type="text" value={saleDomain} onChange={(e) => setSaleDomain(e.target.value)} placeholder="Domain" className="input-app" />
          <input type="text" value={priceTon} onChange={(e) => setPriceTon(e.target.value)} placeholder="Price in TON" className="input-app" />
          <input type="text" value={contactTg} onChange={(e) => setContactTg(e.target.value)} placeholder="Telegram" className="input-app" />
          <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="Email" className="input-app" />
          <textarea value={saleDesc} onChange={(e) => setSaleDesc(e.target.value)} placeholder="Description" className="input-app min-h-[60px]" />
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => navigate('/sites')} className="btn-secondary flex-1">
          {t('cancel')}
        </button>
        <button type="button" onClick={onSubmit} disabled={submitting} className="btn-primary flex-1">
          {submitting ? t('saving') : t('save')}
        </button>
      </div>
    </div>
  );
}
