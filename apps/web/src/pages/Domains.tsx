import { useEffect, useState } from 'react';
import { getDomains, verifyDomain } from '../api';
import { useLang } from '../context/LangContext';

export default function Domains() {
  const { t } = useLang();
  const [domains, setDomains] = useState<Awaited<ReturnType<typeof getDomains>>['domains']>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [accessKey, setAccessKey] = useState('');
  const [showAccessKey, setShowAccessKey] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    getDomains()
      .then((r) => {
        if (r.ok) setDomains(r.domains);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const onVerify = (useKey?: string) => {
    const domain = input.trim().toLowerCase();
    if (!domain) return;
    if (!domain.endsWith('.ton')) {
      setVerifyError(t('domainMustEndTon'));
      return;
    }
    setVerifying(true);
    setVerifyError(null);
    verifyDomain(domain, (useKey ?? accessKey) || undefined)
      .then((r) => {
        if (r.ok) {
          setInput('');
          setAccessKey('');
          setShowAccessKey(false);
          setVerifyError(null);
          load();
        } else {
          setVerifyError(t('domainOwnerMismatch'));
        }
      })
      .catch((e: Error & { requiresAccessKey?: boolean }) => {
        setVerifyError(e.message || t('verificationFailed'));
        if (e.requiresAccessKey) setShowAccessKey(true);
      })
      .finally(() => setVerifying(false));
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[1.35rem] font-semibold tracking-tight text-tg-text">{t('domainsTitle')}</h1>
        <p className="mt-1 text-sm text-tg-hint">{t('domainsIntro')}</p>
      </div>

      <div className="card-app">
        <h2 className="mb-2 text-sm font-medium text-tg-text">{t('addDomainLabel')}</h2>
        <p className="mb-3 text-sm text-tg-hint">{t('ownershipOnChain')}</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('domainPlaceholder')}
            className="input-app flex-1"
          />
          <button
            type="button"
            onClick={() => onVerify()}
            disabled={verifying}
            className="rounded-xl bg-tg-button px-4 py-2.5 font-medium text-tg-button-text disabled:opacity-50"
          >
            {verifying ? '…' : t('verify')}
          </button>
        </div>
        {showAccessKey && (
          <div className="mt-3">
            <p className="mb-1 text-xs text-tg-hint">{t('non4nNeedKey')}</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={accessKey}
                onChange={(e) => setAccessKey(e.target.value)}
                placeholder={t('accessKeyInputPlaceholder')}
                className="input-app flex-1"
              />
              <button
                type="button"
                onClick={() => onVerify(accessKey)}
                disabled={verifying}
                className="rounded-xl bg-tg-button px-4 py-2.5 font-medium text-tg-button-text disabled:opacity-50"
              >
                {t('verifyWithKey')}
              </button>
            </div>
          </div>
        )}
        {verifyError && <p className="mt-2 text-sm text-red-400">{verifyError}</p>}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {loading ? (
        <p className="text-sm text-tg-hint">{t('loading')}</p>
      ) : domains.length === 0 ? (
        <p className="text-sm text-tg-hint">{t('noDomainsYet')}</p>
      ) : (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-tg-text">{t('yourDomains')}</h2>
          {domains.map((d) => (
            <div key={d.id} className="card-app flex items-center justify-between py-3">
              <span className="font-medium text-tg-text">{d.domain}</span>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${d.verified ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}
              >
                {d.verified ? t('verified') : t('notVerified')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
