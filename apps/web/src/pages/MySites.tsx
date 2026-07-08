import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getDomains, previewUrl } from '../api';
import { useLang } from '../context/LangContext';

function siteStatusLabel(status: string, t: (key: string) => string): string {
  switch (status) {
    case 'published':
      return t('statusPublished');
    case 'failed':
      return t('statusFailed');
    case 'waiting_dns_tx':
      return t('statusWaitingDnsTx');
    case 'uploading':
      return t('statusUploading');
    default:
      return t('statusDraft');
  }
}

function siteStatusClass(status: string): string {
  if (status === 'published') return 'bg-emerald-500/20 text-emerald-400';
  if (status === 'failed') return 'bg-red-500/20 text-red-400';
  if (status === 'uploading') return 'bg-sky-500/20 text-sky-400';
  return 'bg-tg-hint/20 text-tg-hint';
}

export default function MySites() {
  const { t } = useLang();
  const [domains, setDomains] = useState<Awaited<ReturnType<typeof getDomains>>['domains']>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDomains()
      .then((r) => r.ok && setDomains(r.domains))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (loading) return <p className="text-sm text-tg-hint">{t('loading')}</p>;

  const allSites = domains.flatMap((d) =>
    d.sites.map((s) => ({ ...s, domainName: d.domain, verified: d.verified }))
  );

  const publicBase = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' ? window.location.origin : '');

  if (allSites.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-[1.35rem] font-semibold tracking-tight text-tg-text">{t('mySitesTitle')}</h1>
        <p className="text-sm text-tg-hint">{t('noSitesYet')}</p>
        <Link to="/create" className="btn-primary inline-block text-center">
          {t('goToCreate')}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[1.35rem] font-semibold tracking-tight text-tg-text">{t('mySitesTitle')}</h1>
        <p className="mt-1 text-sm text-tg-hint">{t('mySitesIntro')}</p>
      </div>
      <div className="space-y-2">
        {allSites.map((s) => (
          <div key={s.id} className="card-app flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-tg-text">{s.domainName}</span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${siteStatusClass(s.status)}`}>
                {siteStatusLabel(s.status, t)}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={previewUrl(s.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl border border-white/[0.12] px-3 py-2 text-sm font-medium text-tg-link hover:bg-white/5"
              >
                {t('preview')}
              </a>
              {s.status === 'draft' && (
                <Link
                  to={`/edit/${s.id}`}
                  className="rounded-xl border border-white/20 px-3 py-2 text-sm font-medium text-tg-text"
                >
                  {t('edit')}
                </Link>
              )}
              {(s.status === 'draft' || s.status === 'waiting_dns_tx' || s.status === 'failed') && (
                <Link
                  to={`/publish/${s.id}`}
                  className="rounded-xl bg-tg-button px-3 py-2 text-sm font-medium text-tg-button-text"
                >
                  {s.status === 'waiting_dns_tx' ? t('signTransaction') : t('publish')}
                </Link>
              )}
            </div>
            {s.slug && (
              <p className="text-xs text-tg-hint">
                {t('slugPreviewLabel')}: {publicBase}/{s.slug}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
