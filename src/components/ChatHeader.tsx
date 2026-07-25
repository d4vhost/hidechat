"use client";

import { useAuth } from "@/hooks/useAuth";
import { usePresence } from "@/hooks/usePresence";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { User, LogOut, Settings, Menu, X, EyeOff, Eye, ChevronLeft, Moon, Sun } from "lucide-react";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useTheme } from "@/context/ThemeContext";
import { useMessages } from "@/hooks/useMessages";

interface ChatHeaderProps {
  isStealthMode?: boolean;
  setIsStealthMode?: (val: boolean) => void;
  contactName: string;
  otherUid: string;
  conversationId: string;
}

export default function ChatHeader({ isStealthMode, contactName, otherUid, conversationId }: ChatHeaderProps) {
  const { user } = useAuth();
  const { otherUserOnline } = usePresence(otherUid);
  const { clearAllMessages } = useMessages(conversationId, otherUid);
  

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out", error);
    }
  };

  const handleClear = async () => {
    if (window.confirm("¿Seguro que quieres borrar toda la conversación? Esto es irreversible para ambos.")) {
      await clearAllMessages();
    }
  };

  return (
    <div className="retro-nav px-3 py-2 flex items-center justify-between z-20 shrink-0 shadow-md">
      
      {/* Left: Back Button */}
      <Link href="/" className="retro-btn px-3 py-1 flex items-center justify-center text-white font-bold text-sm shadow-sm active:opacity-70 transition-opacity">
        <ChevronLeft className="w-5 h-5 -ml-1" />
        <span>Messages</span>
      </Link>

      {/* Center: Contact Info */}
      <div className="flex flex-col items-center flex-1 mx-2 overflow-hidden">
        <p className="text-white font-bold text-lg leading-tight truncate drop-shadow-md text-shadow-sm">{contactName}</p>
        <span className={`text-[11px] leading-none font-bold ${otherUserOnline ? 'text-[#a4e565]' : 'text-gray-300'}`}>
          {otherUserOnline ? 'Online' : 'Offline'}
        </span>
      </div>

      {/* Right: Clear button */}
      <button
        onClick={handleClear}
        className="retro-btn px-3 py-1 text-white font-bold text-sm shadow-sm active:opacity-70 transition-opacity"
      >
        Clear
      </button>
    </div>
  );
}
