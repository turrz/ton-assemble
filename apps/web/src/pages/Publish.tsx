import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTonConnectUI, useTonAddress } from '@tonconnect/ui-react';
import { publishSite, confirmPublish, getAccountLastTxHash } from '../api';
import { useLang } from '../context/LangContext';

type Step = 'idle' | 'uploading' | 'sign' | 'sending' | 'confirming' | 'done' | 'error';

export default function Publish() {
  const { siteId } = useParams<{ siteId: string }>();
  const navigate = useNavigate();
  const { t } = useLang();
  const [tonConnectUI] = useTonConnectUI();
  const address = useTonAddress();
  const [step, setStep] = useState<Step>('idle');
  const [error, setError] = useState<string | null>(null);
  const [tx, setTx] = useState<{
    validUntil: number;
    messages: Array<{ address: string; amount: string; payload?: string }>;
  } | null>(null);
  const [previewUrlState, setPreviewUrlState] = useState<string>('');
  const [publishedDomain, setPublishedDomain] = useState<string>('');
  const [adnlLinkUrl, setAdnlLinkUrl] = useState<string>('');

  const id = siteId ? parseInt(siteId, 10) : 0;
  const fromAddress = address ?? '';
  const connected = !!tonConnectUI?.connected;
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!id || step !== 'idle') return;
    setError(null);
    setStep('uploading');
    publishSite(id)
      .then((res) => {
        setTx(res.tx);
        setPreviewUrlState(res.previewUrl);
        setPublishedDomain(res.domain ?? '');
        setAdnlLinkUrl(res.adnlLinkUrl ?? '');
        setStep('sign');
      })
      .catch((e) => {
        setError(e?.message || t('publishFailed'));
        setStep('error');
      });
  }, [id, retryKey]);

  const onSign = async () => {
    if (!tx || !connected || !fromAddress) return;
    setError(null);
    setStep('sending');
    try {
      await tonConnectUI?.sendTransaction({
        validUntil: tx.validUntil,
        messages: tx.messages.map((m) => ({
          address: m.address,
          amount: m.amount,
          payload: m.payload,
        })),
      });
      setStep('confirming');
      const pollStart = Date.now();
      let lastHash: string | null = null;
      while (Date.now() - pollStart < 120_000) {
        await new Promise((r) => setTimeout(r, 5000));
        const hash = await getAccountLastTxHash(fromAddress);
        if (hash && hash !== lastHash) {
          lastHash = hash;
          await confirmPublish(id, hash, fromAddress);
          setStep('done');
          return;
        }
      }
      setError(t('txNotConfirmed'));
      setStep('error');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('txFailed'));
      setStep('error');
    }
  };

  if (!id) {
    return (
      <div className="text-center text-tg-hint">
        <p>{t('invalidSite')}</p>
      </div>
    );
  }

  if (step === 'uploading') {
    return (
      <div className="space-y-4 text-center py-4">
        <h1 className="text-[1.35rem] font-semibold tracking-tight text-tg-text">{t('publishing')}</h1>
        <p className="text-sm text-tg-hint">{t('preparing')}</p>
      </div>
    );
  }

  if (step === 'sign') {
    const qrSignUrl =
      adnlLinkUrl ||
      (tx?.messages?.[0]?.address && tx?.messages?.[0]?.payload
        ? `ton://transfer/${tx.messages[0].address}?amount=${tx.messages[0].amount}&bin=${encodeURIComponent(tx.messages[0].payload)}`
        : '');
    const qrImageUrl =
      qrSignUrl &&
      `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrSignUrl)}&format=svg`;
    return (
      <div className="space-y-4">
        <h1 className="text-[1.35rem] font-semibold tracking-tight text-tg-text">{t('linkDomainTitle')}</h1>
        <p className="text-sm text-tg-hint">
          {adnlLinkUrl ? t('linkDomainQrHint') : t('linkDomainSignHint')}
        </p>
        {qrImageUrl && (
          <div className="flex flex-col items-center gap-2">
            <div className="rounded-xl bg-white p-3 shadow-lg">
              <img src={qrImageUrl} width={220} height={220} alt="QR: sign to link domain" className="rounded-lg" />
            </div>
            <p className="text-xs text-tg-hint">{t('scanQrHint')}</p>
          </div>
        )}
        {!connected && (
          <p className="text-sm text-amber-400">{t('connectWalletToSign')}</p>
        )}
        <button
          type="button"
          onClick={onSign}
          disabled={!connected}
          className="btn-primary disabled:opacity-50"
        >
          {t('signInWallet')}
        </button>
      </div>
    );
  }

  if (step === 'sending' || step === 'confirming') {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-xl font-semibold text-tg-text">{t('publishing')}</h1>
        <p className="text-sm text-tg-hint">
          {step === 'sending' ? t('waitingSignature') : t('waitingConfirmation')}
        </p>
      </div>
    );
  }

  if (step === 'done') {
    const tonSiteUrl = publishedDomain ? `tonsite://${publishedDomain}` : previewUrlState;
    const qrUrl =
      tonSiteUrl &&
      `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(tonSiteUrl)}&format=svg`;
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-[1.35rem] font-semibold tracking-tight text-emerald-400">{t('published')}</h1>
        <p className="text-sm text-tg-hint">{t('siteLiveHint')}</p>
        {qrUrl && (
          <div className="flex flex-col items-center gap-2">
            <a
              href={tonSiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-xl bg-white p-3 shadow-lg"
              aria-label="Open site"
            >
              <img src={qrUrl} width={220} height={220} alt="QR code: open site" className="rounded-lg" />
            </a>
            <a
              href={tonSiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-tg-link"
            >
              {t('tapToOpenSite')}
            </a>
          </div>
        )}
        <p className="text-xs text-tg-hint">
          {adnlLinkUrl ? t('siteServedViaProxy') : t('contentMayTakeTime')}
        </p>
        <button
          type="button"
          onClick={() => navigate('/sites')}
          className="block w-full rounded-xl border border-white/20 py-2.5 font-medium text-tg-text"
        >
          {t('mySites')}
        </button>
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div className="space-y-4">
        <h1 className="text-[1.35rem] font-semibold tracking-tight text-red-400">{t('error')}</h1>
        <p className="text-sm text-tg-hint">{error}</p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              setError(null);
              setStep('idle');
              setRetryKey((k) => k + 1);
            }}
            className="w-full rounded-xl bg-tg-button py-2.5 font-medium text-tg-button-text"
          >
            {t('tryAgain')}
          </button>
          <button
            type="button"
            onClick={() => navigate(`/preview/${id}`)}
            className="w-full rounded-xl border border-white/20 py-2.5 font-medium text-tg-text"
          >
            {t('backToPreview')}
          </button>
        </div>
      </div>
    );
  }

  return null;
}
