"use client";

import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, use } from "react";
import ChatHeader from "@/components/ChatHeader";
import MessageList from "@/components/MessageList";
import MessageInput from "@/components/MessageInput";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useLanguage } from "@/context/LanguageContext";
import { compressImage, fileToBase64 } from "@/lib/imageUtils";
import { Paperclip } from "lucide-react";

export default function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { t } = useLanguage();
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
  const [isDragging, setIsDragging] = useState(false);

  // Drag-and-drop state to pass to MessageInput
  const [droppedFile, setDroppedFile] = useState<{ data: string; type: 'image' | 'file'; name: string; rawFile?: File } | null>(null);

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

  // ---- Full-page Drag & Drop ----
  const dragCounterRef = useRef(0);

  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current++;
      if (e.dataTransfer?.types.includes('Files')) {
        setIsDragging(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current--;
      if (dragCounterRef.current <= 0) {
        dragCounterRef.current = 0;
        setIsDragging(false);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;
      setIsDragging(false);

      const file = e.dataTransfer?.files?.[0];
      if (!file) return;

      if (file.type.startsWith('image/')) {
        try {
          const compressed = await compressImage(file);
          setDroppedFile({ data: compressed, type: 'image', name: file.name });
        } catch (err) {
          console.error("Error processing dropped image:", err);
        }
      } else {
        try {
          const base64 = await fileToBase64(file);
          setDroppedFile({ data: base64, type: 'file', name: file.name, rawFile: file });
        } catch (err: any) {
          alert(err.message || "Error processing file");
        }
      }
    };

    document.addEventListener('dragenter', handleDragEnter);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('drop', handleDrop);

    return () => {
      document.removeEventListener('dragenter', handleDragEnter);
      document.removeEventListener('dragleave', handleDragLeave);
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('drop', handleDrop);
    };
  }, []);

  if (loading || !user || !receiverId) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="text-gray-500 dark:text-gray-400 font-bold">
          {t('loading')}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 retro-bg flex flex-col">
      {/* Drag overlay - full screen */}
      {isDragging && (
        <div className="fixed inset-0 z-[90] bg-black/30 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="bg-white/90 dark:bg-gray-800/90 rounded-2xl shadow-2xl px-8 py-6 text-center border border-gray-300 dark:border-gray-600">
            <Paperclip className="w-8 h-8 text-gray-500 mx-auto mb-2" />
            <p className="text-sm font-bold text-gray-600 dark:text-gray-300">Drop here to send</p>
          </div>
        </div>
      )}

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
        droppedFile={droppedFile}
        onDroppedFileHandled={() => setDroppedFile(null)}
      />
    </div>
  );
}
