import React, { createContext, useState, useContext, useCallback, useEffect } from 'react';
import { pt, en } from './locales';

const resources = {
  pt,
  en,
};

type Language = keyof typeof resources;
type I18nContextType = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, options?: { [key: string]: string | number }) => string;
};

const I18nContext = createContext<I18nContextType | null>(null);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const savedLang = localStorage.getItem('language');
      if (savedLang && Object.keys(resources).includes(savedLang)) {
        return savedLang as Language;
      }
    } catch (e) {
      console.error("Could not access localStorage", e);
    }
    return 'pt'; // Default language
  });

  useEffect(() => {
    try {
        localStorage.setItem('language', language);
    } catch (e) {
        console.error("Could not access localStorage", e);
    }
  }, [language]);

  const setLanguage = (lang: Language) => {
    if (resources[lang]) {
      setLanguageState(lang);
    }
  };

  const t = useCallback((key: string, options?: { [key: string]: string | number }) => {
    let translation = (resources[language] as any)[key] || key;
    if (options) {
      Object.keys(options).forEach(optKey => {
        const regex = new RegExp(`{{${optKey}}}`, 'g');
        translation = translation.replace(regex, String(options[optKey]));
      });
    }
    return translation;
  }, [language]);

  const value = { language, setLanguage, t };

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = (): I18nContextType => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};