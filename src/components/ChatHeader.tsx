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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1e1e1e] border border-[#333] p-6 rounded-2xl shadow-2xl max-w-sm w-full text-center">
            <h2 className="text-xl font-bold text-white mb-2">{t('clearConfirmTitle')}</h2>
            <p className="text-gray-300 text-sm mb-6 whitespace-pre-wrap">
              {t('clearConfirmDesc')}
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleClear}
                className="retro-btn w-full py-3 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 border-red-800"
              >
                {t('clearConfirmBtn')}
              </button>
              <button
                onClick={() => setShowClearModal(false)}
                className="retro-btn-gray w-full py-3 rounded-xl font-bold text-white"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
