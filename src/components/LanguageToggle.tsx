"use client";

import { useLanguage } from "@/context/LanguageContext";
import { Globe } from "lucide-react";

export default function LanguageToggle() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="fixed top-4 right-4 z-[9999] flex items-center shadow-lg bg-white dark:bg-[#1a1a1a] rounded-lg border border-gray-300 dark:border-[#333] overflow-hidden">
      <div className="px-2 py-1.5 flex items-center justify-center bg-gray-100 dark:bg-[#2a2a2a] border-r border-gray-300 dark:border-[#444]">
        <Globe className="w-4 h-4 text-gray-500 dark:text-gray-400" />
      </div>
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
