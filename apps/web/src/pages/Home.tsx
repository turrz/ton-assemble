import { useTonConnectUI, TonConnectButton, useTonAddress } from '@tonconnect/ui-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { linkWallet } from '../api';
import { useLang } from '../context/LangContext';

export default function Home() {
  const [tonConnectUI] = useTonConnectUI();
  const address = useTonAddress();
  const navigate = useNavigate();
  const { t } = useLang();
  const [walletLinkError, setWalletLinkError] = useState<string | null>(null);

  useEffect(() => {
    if (!tonConnectUI?.connected || !address) {
      setWalletLinkError(null);
      return;
    }
    const wallet = tonConnectUI.wallet;
    const account = wallet?.account;
    if (account?.chain === '-239' || account?.chain === 'mainnet') {
      linkWallet(account.address, account.chain)
        .then(() => setWalletLinkError(null))
        .catch(() => setWalletLinkError(t('walletLinkFailed')));
    }
  }, [tonConnectUI?.connected, address, tonConnectUI?.wallet, t]);

  const shortAddress = address ? `${address.slice(0, 8)}…${address.slice(-6)}` : '';

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[1.35rem] font-semibold tracking-tight text-tg-text">{t('welcomeTitle')}</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-tg-hint">
          {t('welcomeIntro')}
        </p>
      </div>

      <section className="card-app">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-br from-[#0088CC]/90 to-[#00C6A0]/90 text-xs font-bold text-white shadow-sm">1</span>
          <h2 className="text-sm font-medium text-tg-text">{t('connectWallet')}</h2>
        </div>
        {tonConnectUI?.connected && address ? (
          <p className="mb-3 text-sm text-tg-hint">
            {t('connectedPrefix')} {shortAddress}
          </p>
        ) : (
          <p className="mb-3 text-sm text-tg-hint">{t('connectWalletHint')}</p>
        )}
        {walletLinkError && (
          <p className="mb-3 text-sm text-red-400">{walletLinkError}</p>
        )}
        <TonConnectButton />
      </section>

      <section className="card-app">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-br from-[#0088CC]/90 to-[#00C6A0]/90 text-xs font-bold text-white shadow-sm">2</span>
          <h2 className="text-sm font-medium text-tg-text">{t('addDomain')} &amp; {t('verify')}</h2>
        </div>
        <p className="mb-4 text-sm text-tg-hint">{t('welcomeSubtitle')}</p>
        <button type="button" onClick={() => navigate('/domains')} className="btn-primary">
          {t('domains')}
        </button>
      </section>

      <section className="card-app">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-br from-[#0088CC]/90 to-[#00C6A0]/90 text-xs font-bold text-white shadow-sm">3</span>
          <h2 className="text-sm font-medium text-tg-text">{t('createSite')}</h2>
        </div>
        <p className="mb-4 text-sm text-tg-hint">{t('step2Hint')}</p>
        <button type="button" onClick={() => navigate('/create')} className="btn-secondary">
          {t('createSite')}
        </button>
      </section>

      <section className="card-app">
        <h2 className="mb-3 text-sm font-medium text-tg-text">{t('mySites')}</h2>
        <button type="button" onClick={() => navigate('/sites')} className="btn-secondary">
          {t('mySites')}
        </button>
      </section>
    </div>
  );
}
