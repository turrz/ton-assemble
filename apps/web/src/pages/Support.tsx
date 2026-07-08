import { useEffect, useState } from 'react';
import { getSupportConfig } from '../api';
import { useLang } from '../context/LangContext';

export default function Support() {
  const { t } = useLang();
  const [config, setConfig] = useState<Awaited<ReturnType<typeof getSupportConfig>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSupportConfig()
      .then(setConfig)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-sm text-tg-hint">{t('loading')}</p>;
  }

  if (error) return <p className="text-sm text-red-400">{error}</p>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[1.35rem] font-semibold tracking-tight text-tg-text">{t('supportTitle')}</h1>
        <p className="mt-1 text-sm text-tg-hint">{t('supportIntro')}</p>
      </div>

      {config?.donateTonAddress && (
        <section className="card-app">
          <h2 className="mb-2 text-sm font-medium text-tg-text">{t('donateTon')}</h2>
          {config.donateText && <p className="mb-3 text-sm text-tg-hint">{config.donateText}</p>}
          <p className="break-all font-mono text-sm text-tg-link">{config.donateTonAddress}</p>
        </section>
      )}

      <section className="card-app">
        <h2 className="mb-3 text-sm font-medium text-tg-text">{t('contact')}</h2>
        <ul className="space-y-2 text-sm text-tg-hint">
          {config?.contactTelegram && (
            <li>Telegram: <span className="text-tg-link">{config.contactTelegram}</span></li>
          )}
          {config?.contactX && (
            <li>X: <span className="text-tg-link">{config.contactX}</span></li>
          )}
          {config?.contactEmail && (
            <li>Email: <span className="text-tg-link">{config.contactEmail}</span></li>
          )}
        </ul>
        {config && !config.contactTelegram && !config.contactX && !config.contactEmail && (
          <p className="text-sm text-tg-hint">{t('noContactConfigured')}</p>
        )}
      </section>

      <p className="text-xs text-tg-hint">{t('madeWith')}</p>
    </div>
  );
}
