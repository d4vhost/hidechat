"use client";

import { useState, useEffect, useRef } from "react";
import { useMessages } from "@/hooks/useMessages";
import { useTyping } from "@/hooks/useTyping";
import { Smile, X } from "lucide-react";
import EmojiPicker, { Theme, EmojiClickData } from "emoji-picker-react";
import { useLanguage } from "@/context/LanguageContext";

interface MessageInputProps {
  replyTo?: any;
  onCancelReply?: () => void;
  isStealthMode?: boolean;
  conversationId: string;
  receiverId: string;
}

export default function MessageInput({ replyTo, onCancelReply, isStealthMode, conversationId, receiverId }: MessageInputProps) {
  const { t } = useLanguage();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const { sendMessage } = useMessages(conversationId, receiverId);
  const { setTyping } = useTyping(receiverId, conversationId);
  const pickerRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  // Debounce typing status - only write to Firestore when state changes
  useEffect(() => {
    if (text.trim().length > 0) {
      // Only set typing=true if not already typing (avoid repeated writes)
      if (!isTypingRef.current) {
        isTypingRef.current = true;
        setTyping(true);
      }
      // Reset the auto-clear timeout
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        isTypingRef.current = false;
        setTyping(false);
      }, 2500);
    } else {
      if (isTypingRef.current) {
        isTypingRef.current = false;
        setTyping(false);
      }
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    }
  }, [text, setTyping]);

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || sending) return;

    const messageToSend = text;
    setText(""); // Optimistic clear to allow fast typing
    setTyping(false);
    setShowEmojiPicker(false);
    
    setSending(true);
    try {
      await sendMessage(messageToSend, replyTo);
      if (onCancelReply) onCancelReply();
    } catch (error: any) {
      console.error(t('errorSendingMessage'), error);
      alert(t('errorSending') + " " + error.message);
      setText(messageToSend); // Restore text on error
    } finally {
      setSending(false);
      // Ensure focus is kept after sending (especially on desktop)
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 0);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setText((prevText) => prevText + emojiData.emoji);
  };

  return (
    <div className="retro-input-bar p-3 sm:p-4 shrink-0 relative flex flex-col">
      {/* Reply Preview Box */}
      {replyTo && (
        <div className="max-w-4xl w-full mx-auto mb-2 bg-white/80 border border-[#999] border-l-4 border-l-[#4a9d06] rounded-r-lg p-2 relative shadow-md flex items-start">
          <div className="flex-1 overflow-hidden">
            <div className="text-xs font-bold text-[#4a9d06] mb-1">
              {t('replyingTo')} {replyTo.senderName}
            </div>
            <div className="text-xs text-gray-800 truncate">
              {replyTo.text}
            </div>
          </div>
          <button 
            onClick={onCancelReply}
            className="ml-2 text-gray-600 p-1 bg-white/50 rounded-full border border-gray-400 shadow-sm active:bg-gray-300"
            type="button"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {showEmojiPicker && (
        <div ref={pickerRef} className="absolute bottom-full right-4 mb-2 z-50 shadow-2xl">
          <EmojiPicker 
            theme={Theme.LIGHT} 
            onEmojiClick={onEmojiClick}
            autoFocusSearch={false}
            searchDisabled
          />
        </div>
      )}
      <form onSubmit={handleSend} className="max-w-4xl w-full mx-auto flex items-end space-x-2">
        <div className="flex-1 retro-input-field bg-white rounded-full flex items-center pr-2">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            className={`flex-1 bg-transparent px-4 py-2 focus:outline-none text-[16px] resize-none max-h-32 min-h-[36px] rounded-full ${
              isStealthMode ? 'text-gray-400' : 'text-black'
            }`}
            rows={1}
          />
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            <Smile className="w-5 h-5" />
          </button>
        </div>
        <button
          type="submit"
          disabled={!text.trim() || sending}
          className="retro-send-btn px-4 rounded-full font-bold text-sm disabled:opacity-50 h-[36px] flex items-center justify-center shrink-0 min-w-[60px]"
        >
          {sending ? "..." : t('send')}
        </button>
      </form>
    </div>
  );
}
