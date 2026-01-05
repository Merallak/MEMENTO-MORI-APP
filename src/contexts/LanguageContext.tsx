import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import { translations, Language } from "@/lib/translations";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (path: string, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined
);

function getByPath(obj: unknown, path: string): unknown {
  const keys = path.split(".");
  let current: any = obj;

  for (const key of keys) {
    if (current == null || typeof current !== "object" || !(key in current)) {
      return undefined;
    }
    current = current[key];
  }

  return current;
}

function interpolate(
  template: string,
  params?: Record<string, string | number>
): string {
  if (!params) return template;

  let result = template;

  for (const [key, value] of Object.entries(params)) {
    // Soporta ambos formatos: {{key}} y {key}
    result = result
      .replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), String(value))
      .replace(new RegExp(`\\{${key}\\}`, "g"), String(value));
  }

  return result;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Default inicial (SSR friendly), pero se actualizará inmediatamente en el cliente
  const [language, setLanguage] = useState<Language>("es");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedLang = localStorage.getItem("app-language") as Language;

    if (savedLang && (savedLang === "en" || savedLang === "es")) {
      // 1. Prioridad: Preferencia guardada por el usuario
      setLanguage(savedLang);
    } else {
      // 2. Fallback: Detección automática del navegador
      const browserLang =
        typeof navigator !== "undefined" ? navigator.language : "en";

      if (browserLang.toLowerCase().startsWith("es")) {
        setLanguage("es");
      } else {
        setLanguage("en");
      }
    }
  }, []);

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang);
    if (typeof window !== "undefined") {
      localStorage.setItem("app-language", lang);
    }
  };

  const t = useCallback(
    (path: string, params?: Record<string, string | number>): string => {
      // 1) Busca en el idioma actual
      const fromCurrent = getByPath(translations[language], path);

      // 2) Fallback a inglés si falta la clave en el idioma actual
      const value = fromCurrent ?? getByPath(translations.en, path);

      if (typeof value !== "string") {
        // Fallback seguro para no romper la UI
        if (process.env.NODE_ENV !== "production") {
          // eslint-disable-next-line no-console
          console.warn(
            `[i18n] Missing translation key: "${path}" (lang=${language})`
          );
        }
        return path;
      }

      return interpolate(value, params);
    },
    [language]
  );

  // Mantener `mounted` sin eliminarlo, pero marcarlo como "usado" para evitar warnings de lint
  void mounted;

  return (
    <LanguageContext.Provider
      value={{ language, setLanguage: handleSetLanguage, t }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}