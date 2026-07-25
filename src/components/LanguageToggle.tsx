"use client";

import { useLanguage } from "@/context/LanguageContext";

export default function LanguageToggle() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="flex items-center bg-white dark:bg-[#1a1a1a] rounded-lg border border-gray-300 dark:border-[#333] overflow-hidden shadow-sm">
      <button
        onClick={() => setLanguage('es')}
        className={`px-3 py-1.5 text-xs font-bold transition-colors ${
          language === 'es' 
            ? 'bg-[#4b77ad] text-white' 
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#252525]'
        }`}
      >
        ESP
      </button>
      <button
        onClick={() => setLanguage('en')}
        className={`px-3 py-1.5 text-xs font-bold transition-colors ${
          language === 'en' 
            ? 'bg-[#4b77ad] text-white' 
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#252525]'
        }`}
      >
        ENG
      </button>
    </div>
  );
}
