import { useParams, Link } from 'react-router-dom';
import { useLang } from '../context/LangContext';

export default function Preview() {
  const { siteId } = useParams<{ siteId: string }>();
  const { t } = useLang();
  const id = siteId ? parseInt(siteId, 10) : 0;
  const validId = Number.isInteger(id) && id > 0;
  const apiBase = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' ? window.location.origin : '');
  const previewSrc = validId ? `${apiBase}/preview/${id}` : '';

  if (!validId) {
    return (
      <div className="space-y-4">
        <h1 className="text-[1.35rem] font-semibold tracking-tight text-tg-text">{t('previewTitle')}</h1>
        <p className="text-sm text-tg-hint">{t('invalidSiteId')}</p>
        <Link to="/sites" className="btn-secondary inline-block text-center">
          {t('backToMySites')}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[1.35rem] font-semibold tracking-tight text-tg-text">{t('previewTitle')}</h1>
        <Link
          to={`/publish/${id}`}
          className="rounded-lg bg-tg-button px-3 py-1.5 text-sm font-medium text-tg-button-text"
        >
          {t('publish')}
        </Link>
      </div>
      {previewSrc ? (
        <iframe
          src={previewSrc}
          title={t('previewTitle')}
          className="h-[70vh] w-full rounded-xl border border-white/10 bg-white/5"
          sandbox="allow-scripts"
        />
      ) : (
        <p className="text-sm text-tg-hint">{t('noSiteSelected')}</p>
      )}
    </div>
  );
}
