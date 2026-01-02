import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { translations, Language } from '@/lib/translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (path: string, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Default inicial (SSR friendly), pero se actualizará inmediatamente en el cliente
  const [language, setLanguage] = useState<Language>('es'); 
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedLang = localStorage.getItem('app-language') as Language;
    
    if (savedLang && (savedLang === 'en' || savedLang === 'es')) {
      // 1. Prioridad: Preferencia guardada por el usuario
      setLanguage(savedLang);
    } else {
      // 2. Fallback: Detección automática del navegador
      const browserLang = typeof navigator !== 'undefined' ? navigator.language : 'en';
      
      if (browserLang.toLowerCase().startsWith('es')) {
        setLanguage('es');
      } else {
        setLanguage('en');
      }
    }
  }, []);

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('app-language', lang);
    }
  };

  const t = (path: string, params?: Record<string, string | number>): string => {
    const keys = path.split('.');
    let current: any = translations[language];

    for (const key of keys) {
      if (current[key] === undefined) {
        // Fallback silencioso para claves faltantes (evita romper la UI)
        return path;
      }
      current = current[key];
    }

    let result = current as string;

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value));
      });
    }

    return result;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage, t }}>
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