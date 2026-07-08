import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLang } from '../context/LangContext';
import Logo from './Logo';

export default function Layout({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const { t, lang, setLang } = useLang();
  const showNav = !loc.pathname.startsWith('/publish');

  return (
    <div className="min-h-screen bg-tg-bg font-sans text-tg-text min-w-0">
      {showNav && (
        <nav className="sticky top-0 z-10 border-b border-white/[0.06] bg-tg-bg/95 backdrop-blur-xl">
          <div className="w-full max-w-lg mx-auto px-4 py-2 min-w-0">
            <div className="flex items-center justify-between gap-2 py-1.5">
              <Link to="/" className="flex items-center min-w-0 shrink overflow-hidden" aria-label={t('appName')}>
                <Logo size={28} showText />
              </Link>
              <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                <div
                  className="flex rounded-xl border border-white/10 bg-white/5 p-0.5"
                  role="group"
                  aria-label="Language"
                >
                  <button
                    type="button"
                    onClick={() => setLang('en')}
                    className={`rounded-lg px-2 py-1 text-xs font-medium transition-all ${
                      lang === 'en' ? 'bg-gradient-to-r from-[#0088CC] to-[#00C6A0] text-white' : 'text-tg-hint hover:text-tg-text'
                    }`}
                    title="English"
                  >
                    EN
                  </button>
                  <button
                    type="button"
                    onClick={() => setLang('ru')}
                    className={`rounded-lg px-2 py-1 text-xs font-medium transition-all ${
                      lang === 'ru' ? 'bg-gradient-to-r from-[#0088CC] to-[#00C6A0] text-white' : 'text-tg-hint hover:text-tg-text'
                    }`}
                    title="Русский"
                  >
                    RU
                  </button>
                </div>
                <Link
                  to="/sites"
                  className={`rounded-xl px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${loc.pathname === '/sites' ? 'bg-white/10 text-tg-text' : 'text-tg-hint hover:bg-white/5 hover:text-tg-text'}`}
                >
                  {t('navMySites')}
                </Link>
                <Link
                  to="/support"
                  className={`rounded-xl px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${loc.pathname === '/support' ? 'bg-white/10 text-tg-text' : 'text-tg-hint hover:bg-white/5 hover:text-tg-text'}`}
                >
                  {t('navSupport')}
                </Link>
              </div>
            </div>
          </div>
        </nav>
      )}
      <main className="mx-auto w-full max-w-lg px-4 py-6 pb-12 min-w-0 box-border">{children}</main>
    </div>
  );
}
