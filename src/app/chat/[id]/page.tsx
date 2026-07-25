"use client";

import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect, useState, use } from "react";
import ChatHeader from "@/components/ChatHeader";
import MessageList from "@/components/MessageList";
import MessageInput from "@/components/MessageInput";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { id: conversationId } = use(params);

  const [receiverId, setReceiverId] = useState("");
  const [contactName, setContactName] = useState("...");

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && conversationId) {
      const [uid1, uid2] = conversationId.split("_");
      const rId = uid1 === user.uid ? uid2 : uid1;
      setReceiverId(rId);

      // Fetch contact info
      getDoc(doc(db, "users", rId)).then((docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setContactName(data.username || data.phoneNumber);
        } else {
          setContactName("Unknown");
        }
      });
    }
  }, [user, conversationId]);

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

  if (loading || !user || !receiverId) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="text-gray-500 dark:text-gray-400 font-bold">
          Cargando...
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 retro-bg flex flex-col">
      <ChatHeader 
        isStealthMode={isStealthMode} 
        setIsStealthMode={handleSetStealthMode} 
        contactName={contactName}
        otherUid={receiverId}
        conversationId={conversationId}
      />
      <MessageList 
        onReply={setReplyTo} 
        isStealthMode={isStealthMode} 
        conversationId={conversationId}
        receiverId={receiverId}
        contactName={contactName}
      />
      <MessageInput 
        replyTo={replyTo} 
        onCancelReply={() => setReplyTo(null)} 
        isStealthMode={isStealthMode} 
        conversationId={conversationId}
        receiverId={receiverId}
      />
    </div>
  );
}
