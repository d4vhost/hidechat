"use client";

import { useAuth } from "@/hooks/useAuth";
import { usePresence } from "@/hooks/usePresence";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { User, LogOut, Settings, Menu, X, EyeOff, Eye, ChevronLeft, Moon, Sun, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useTheme } from "@/context/ThemeContext";
import { useMessages } from "@/hooks/useMessages";
import { useLanguage } from "@/context/LanguageContext";

interface ChatHeaderProps {
  isStealthMode?: boolean;
  setIsStealthMode?: (val: boolean) => void;
  contactName: string;
  otherUid: string;
  conversationId: string;
}

export default function ChatHeader({ isStealthMode, contactName, otherUid, conversationId }: ChatHeaderProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { otherUserOnline } = usePresence(otherUid);
  const { clearAllMessages } = useMessages(conversationId, otherUid);
  const [showClearModal, setShowClearModal] = useState(false);
  

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out", error);
    }
  };

  const handleClear = async () => {
    await clearAllMessages();
    setShowClearModal(false);
  };

  return (
    <div className="retro-nav px-3 py-2 flex items-center justify-between z-20 shrink-0 shadow-md">
      
      {/* Left: Back Button */}
      <Link href="/" className="retro-btn px-3 py-1 flex items-center justify-center text-white font-bold text-sm shadow-sm active:opacity-70 transition-opacity">
        <ChevronLeft className="w-5 h-5 -ml-1" />
        <span>{t('messages')}</span>
      </Link>

      {/* Center: Contact Info */}
      <div className="flex flex-col items-center flex-1 mx-2 overflow-hidden">
        <p className={`text-white font-bold text-lg leading-tight truncate drop-shadow-md text-shadow-sm transition-all duration-300 ${isStealthMode ? 'blur-[5px] hover:blur-none active:blur-none' : ''}`}>
          {contactName}
        </p>
        <span className={`text-[11px] leading-none font-bold ${otherUserOnline ? 'text-[#a4e565]' : 'text-gray-300'}`}>
          {otherUserOnline ? t('online') : t('offline')}
        </span>
      </div>

      {/* Right: Clear button */}
      <button
        onClick={() => setShowClearModal(true)}
        className="retro-btn px-3 py-1 text-white font-bold text-sm active:opacity-70 flex items-center gap-1"
      >
        <Trash2 className="w-4 h-4" />
        <span className="hidden sm:inline">{t('clear')}</span>
      </button>

      {/* Clear Confirmation Modal */}
      {showClearModal && (
        <div className="fixed inset-0 z-[100] bg-gray-100 dark:bg-[#121212] flex flex-col">
          {/* Header */}
          <div className="retro-nav px-4 py-3 flex items-center justify-between shrink-0 shadow-md">
            <h2 className="text-white font-bold text-lg drop-shadow-md text-shadow-sm">{t('clearConfirmTitle')}</h2>
            <button
              onClick={() => setShowClearModal(false)}
              className="retro-btn px-3 py-1 text-white font-bold text-sm shadow-sm active:opacity-70"
            >
              {t('cancel')}
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center text-center mt-4">
            <div className="w-20 h-20 bg-blue-100 dark:bg-[#1e1e1e] border border-blue-200 dark:border-[#333] rounded-full flex items-center justify-center mb-6 shadow-inner">
              <Trash2 className="w-10 h-10 text-[#4b77ad]" />
            </div>
            
            <p className="text-gray-800 dark:text-gray-200 text-xl font-bold mb-4">
              {t('clearConfirmTitle2')}
            </p>
            
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-8 leading-relaxed px-2">
              {t('clearConfirmDesc')}
            </p>

            <div className="w-full max-w-sm mb-6 text-left">
              <h3 className="font-bold text-gray-800 dark:text-white mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#4b77ad]"></span>
                {t('localPrivacy')}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-4">
                {t('localPrivacyDesc')}
              </p>
              
              <h3 className="font-bold text-gray-800 dark:text-white mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                {t('autoDestruct')}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                {t('autoDestructDesc')}
              </p>
            </div>
          </div>

          {/* Fixed Bottom Button */}
          <div className="p-4 bg-gray-100 dark:bg-[#121212] border-t border-gray-300 dark:border-[#333] shrink-0 pb-8">
            <button
              onClick={handleClear}
              className="retro-btn w-full py-4 flex justify-center items-center rounded-xl font-bold text-white text-lg shadow-md"
            >
              {t('clearConfirmBtn')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
