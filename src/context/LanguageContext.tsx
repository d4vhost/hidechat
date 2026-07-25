"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { translations, Language } from '@/i18n/translations';

interface LanguageContextType {
  language: Language;
  toggleLanguage: () => void;
  setLanguage: (lang: Language) => void;
  t: (key: keyof typeof translations.es) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>('es');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const storedLang = localStorage.getItem('pop-language') as Language;
    if (storedLang && (storedLang === 'es' || storedLang === 'en')) {
      setLanguage(storedLang);
    }
  }, []);

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('pop-language', lang);
  };

  const toggleLanguage = () => {
    const newLang = language === 'es' ? 'en' : 'es';
    handleSetLanguage(newLang);
  };

  const t = (key: keyof typeof translations.es): string => {
    if (!mounted) {
      return translations['es'][key]; // default during SSR
    }
    return translations[language][key] || translations['es'][key];
  };

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, setLanguage: handleSetLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
