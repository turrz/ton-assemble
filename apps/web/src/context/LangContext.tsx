import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { getStoredLang, setStoredLang, t, type Lang } from '../i18n';

interface LangContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const LangContext = createContext<LangContextValue | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getStoredLang);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    setStoredLang(l);
  }, []);
  const value: LangContextValue = {
    lang,
    setLang,
    t: (key: string) => t(lang, key),
  };
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): LangContextValue {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be used within LangProvider');
  return ctx;
}
