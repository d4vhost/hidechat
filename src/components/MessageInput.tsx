"use client";

import { useState, useEffect, useRef } from "react";
import { useMessages } from "@/hooks/useMessages";
import { useTyping } from "@/hooks/useTyping";
import { Smile, X, Camera, Paperclip, Image as ImageIcon, File as FileIcon } from "lucide-react";
import EmojiPicker, { Theme, EmojiClickData } from "emoji-picker-react";
import { useLanguage } from "@/context/LanguageContext";
import { compressImage, fileToBase64, formatFileSize } from "@/lib/imageUtils";

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
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  
  const { sendMessage, sendImage, sendFile } = useMessages(conversationId, receiverId);
  const { setTyping } = useTyping(receiverId, conversationId);
  
  const pickerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Debounce typing status - only write to Firestore when state changes
  useEffect(() => {
    if (text.trim().length > 0) {
      if (!isTypingRef.current) {
        isTypingRef.current = true;
        setTyping(true);
      }
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

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowAttachmentMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 0);
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setShowAttachmentMenu(false);
    const file = e.target.files?.[0];
    if (!file || sending) return;

    e.target.value = ""; // reset input

    setSending(true);
    try {
      const compressed = await compressImage(file);
      await sendImage(compressed);
    } catch (error: any) {
      console.error("Error sending image:", error);
      alert("Error sending image: " + error.message);
    } finally {
      setSending(false);
    }
  };

  const handleDocumentSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setShowAttachmentMenu(false);
    const file = e.target.files?.[0];
    if (!file || sending) return;

    e.target.value = ""; // reset input

    setSending(true);
    try {
      const base64 = await fileToBase64(file);
      await sendFile(base64, file.name, file.type, file.size);
    } catch (error: any) {
      console.error("Error sending document:", error);
      alert("Error sending document: " + error.message);
    } finally {
      setSending(false);
    }
  };

  // Handle Ctrl+V Paste for Images
  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        e.preventDefault(); // Prevent pasting text if it's an image
        const blob = items[i].getAsFile();
        if (blob) {
          setSending(true);
          try {
            const compressed = await compressImage(blob);
            await sendImage(compressed);
          } catch (error: any) {
            console.error("Error pasting image:", error);
            alert("Error sending pasted image: " + error.message);
          } finally {
            setSending(false);
          }
        }
        break; // Only process the first image found
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
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
      
      {/* Emoji Picker */}
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

      {/* Attachment Menu */}
      {showAttachmentMenu && (
        <div ref={menuRef} className="absolute bottom-full mb-2 left-4 z-50 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 py-2 w-48 fade-in">
          <button 
            type="button"
            className="w-full flex items-center px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
            onClick={() => cameraInputRef.current?.click()}
          >
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center mr-3 text-blue-600 dark:text-blue-400">
              <Camera className="w-4 h-4" />
            </div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Take Photo</span>
          </button>
          
          <button 
            type="button"
            className="w-full flex items-center px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center mr-3 text-purple-600 dark:text-purple-400">
              <ImageIcon className="w-4 h-4" />
            </div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Select Photo</span>
          </button>

          <button 
            type="button"
            className="w-full flex items-center px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
            onClick={() => documentInputRef.current?.click()}
          >
            <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center mr-3 text-orange-600 dark:text-orange-400">
              <FileIcon className="w-4 h-4" />
            </div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Attach File</span>
          </button>
        </div>
      )}

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageSelect}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleImageSelect}
        className="hidden"
      />
      <input
        ref={documentInputRef}
        type="file"
        onChange={handleDocumentSelect}
        className="hidden"
      />

      <form onSubmit={handleSend} className="max-w-4xl w-full mx-auto flex items-end space-x-2">
        <button
          type="button"
          onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
          disabled={sending}
          className="p-2 bg-white rounded-full shadow-sm text-gray-500 hover:text-gray-700 disabled:opacity-50 h-[36px] flex items-center justify-center shrink-0 mb-[2px]"
        >
          <Paperclip className="w-5 h-5" />
        </button>

        <div className="flex-1 retro-input-field bg-white rounded-3xl flex items-center pr-2 border border-gray-300">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={t('typeAMessage')}
            className={`flex-1 bg-transparent px-4 py-2 focus:outline-none text-[16px] resize-none max-h-32 min-h-[36px] rounded-full ${
              isStealthMode ? 'text-gray-400' : 'text-black'
            }`}
            rows={1}
          />
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-2 text-gray-400 hover:text-gray-600"
          >
            <Smile className="w-5 h-5" />
          </button>
        </div>
        
        <button
          type="submit"
          disabled={!text.trim() || sending}
          className="retro-send-btn px-4 rounded-full font-bold text-sm disabled:opacity-50 h-[36px] flex items-center justify-center shrink-0 min-w-[60px] mb-[2px]"
        >
          {sending ? "..." : t('send')}
        </button>
      </form>
    </div>
  );
}
