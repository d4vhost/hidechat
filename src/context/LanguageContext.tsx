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
  const [language, setLanguage] = useState<Language>('en');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSetLanguage = (lang: Language) => {
    // Disabled
  };

  const toggleLanguage = () => {
    // Disabled
  };

  const t = (key: keyof typeof translations.en): string => {
    if (!mounted) {
      return translations['en'][key];
    }
    return translations['en'][key];
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
