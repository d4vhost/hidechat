"use client";

import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ChatHeader from "@/components/ChatHeader";
import MessageList from "@/components/MessageList";
import MessageInput from "@/components/MessageInput";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  const [replyTo, setReplyTo] = useState<any>(null);
  const [isStealthMode, setIsStealthMode] = useState(false);

  useEffect(() => {
    const savedStealth = localStorage.getItem('hidechat-stealth-mode');
    if (savedStealth === 'true') {
      setIsStealthMode(true);
    }
  }, []);

  const handleSetStealthMode = (value: boolean) => {
    setIsStealthMode(value);
    localStorage.setItem('hidechat-stealth-mode', value.toString());
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="text-gray-500 dark:text-gray-400">
          Cargando...
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 retro-bg flex flex-col">
      <ChatHeader isStealthMode={isStealthMode} setIsStealthMode={handleSetStealthMode} />
      <MessageList onReply={setReplyTo} isStealthMode={isStealthMode} />
      <MessageInput replyTo={replyTo} onCancelReply={() => setReplyTo(null)} isStealthMode={isStealthMode} />
    </div>
  );
}
