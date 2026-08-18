"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useMessages } from "@/hooks/useMessages";
import { useTyping } from "@/hooks/useTyping";
import { Smile, X, Camera, Paperclip, Image as ImageIcon, File as FileIcon, Send } from "lucide-react";
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

// ---- Image/File Preview Modal (Telegram-style) ----
function PreviewModal({ previewData, previewType, previewFileName, caption, onCaptionChange, onSend, onCancel, sending }: {
  previewData: string;
  previewType: 'image' | 'file';
  previewFileName?: string;
  caption: string;
  onCaptionChange: (val: string) => void;
  onSend: () => void;
  onCancel: () => void;
  sending: boolean;
}) {
  const captionRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => captionRef.current?.focus(), 100);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
    if (e.key === "Escape") {
      onCancel();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onCancel}>
      <div 
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <span className="text-sm font-bold text-gray-700 dark:text-gray-200">
            {previewType === 'image' ? 'Send Photo' : 'Send File'}
          </span>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Preview */}
        <div className="p-4">
          {previewType === 'image' ? (
            <div className="relative w-full rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800" style={{ maxHeight: '50vh' }}>
              <img 
                src={previewData} 
                alt="Preview" 
                className="w-full h-auto object-contain"
                style={{ maxHeight: '50vh' }}
              />
            </div>
          ) : (
            <div className="flex items-center gap-3 bg-gray-100 dark:bg-gray-800 rounded-xl p-4">
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/50 rounded-xl flex items-center justify-center">
                <FileIcon className="w-6 h-6 text-orange-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-gray-800 dark:text-gray-200 truncate">{previewFileName || 'File'}</div>
              </div>
            </div>
          )}
        </div>

        {/* Caption Input + Send */}
        <div className="flex items-center gap-2 px-4 pb-4">
          <input
            ref={captionRef}
            type="text"
            value={caption}
            onChange={(e) => onCaptionChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add a caption..."
            className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full px-4 py-2.5 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500/50 border border-gray-200 dark:border-gray-700"
          />
          <button
            onClick={onSend}
            disabled={sending}
            className="w-10 h-10 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center text-white disabled:opacity-50 transition-colors shrink-0"
          >
            {sending ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MessageInput({ replyTo, onCancelReply, isStealthMode, conversationId, receiverId }: MessageInputProps) {
  const { t } = useLanguage();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Preview state
  const [previewData, setPreviewData] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<'image' | 'file'>('image');
  const [previewFileName, setPreviewFileName] = useState("");
  const [previewFileData, setPreviewFileData] = useState<{ base64: string; name: string; type: string; size: number } | null>(null);
  const [caption, setCaption] = useState("");
  
  const { sendMessage, sendImage, sendFile } = useMessages(conversationId, receiverId);
  const { setTyping } = useTyping(receiverId, conversationId);
  
  const pickerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const attachBtnRef = useRef<HTMLButtonElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Debounce typing status
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
      if (menuRef.current && !menuRef.current.contains(event.target as Node) && 
          attachBtnRef.current && !attachBtnRef.current.contains(event.target as Node)) {
        setShowAttachmentMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ---- Drag & Drop ----
  useEffect(() => {
    const zone = dropZoneRef.current;
    if (!zone) return;

    let dragCounter = 0;

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter++;
      if (e.dataTransfer?.types.includes('Files')) {
        setIsDragging(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
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
      dragCounter = 0;
      setIsDragging(false);

      const file = e.dataTransfer?.files?.[0];
      if (!file) return;

      if (file.type.startsWith('image/')) {
        try {
          const compressed = await compressImage(file);
          setPreviewData(compressed);
          setPreviewType('image');
          setPreviewFileName(file.name);
          setPreviewFileData(null);
          setCaption("");
        } catch (err) {
          console.error("Error processing dropped image:", err);
        }
      } else {
        try {
          const base64 = await fileToBase64(file);
          setPreviewData(base64);
          setPreviewType('file');
          setPreviewFileName(file.name);
          setPreviewFileData({ base64, name: file.name, type: file.type, size: file.size });
          setCaption("");
        } catch (err: any) {
          alert(err.message || "Error processing file");
        }
      }
    };

    zone.addEventListener('dragenter', handleDragEnter);
    zone.addEventListener('dragleave', handleDragLeave);
    zone.addEventListener('dragover', handleDragOver);
    zone.addEventListener('drop', handleDrop);

    return () => {
      zone.removeEventListener('dragenter', handleDragEnter);
      zone.removeEventListener('dragleave', handleDragLeave);
      zone.removeEventListener('dragover', handleDragOver);
      zone.removeEventListener('drop', handleDrop);
    };
  }, []);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!text.trim() || sending) return;

    const messageToSend = text;
    setText("");
    setTyping(false);
    setShowEmojiPicker(false);
    
    setSending(true);
    try {
      await sendMessage(messageToSend, replyTo);
      if (onCancelReply) onCancelReply();
    } catch (error: any) {
      console.error(t('errorSendingMessage'), error);
      alert(t('errorSending') + " " + error.message);
      setText(messageToSend);
    } finally {
      setSending(false);
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  };

  // Show preview instead of sending immediately
  const showImagePreview = async (file: File | Blob) => {
    try {
      const compressed = await compressImage(file);
      setPreviewData(compressed);
      setPreviewType('image');
      setPreviewFileName(file instanceof File ? file.name : 'screenshot.jpg');
      setPreviewFileData(null);
      setCaption("");
    } catch (error: any) {
      console.error("Error compressing image:", error);
      alert("Error processing image: " + error.message);
    }
  };

  const showFilePreview = async (file: File) => {
    try {
      const base64 = await fileToBase64(file);
      setPreviewData(base64);
      setPreviewType('file');
      setPreviewFileName(file.name);
      setPreviewFileData({ base64, name: file.name, type: file.type, size: file.size });
      setCaption("");
    } catch (error: any) {
      console.error("Error reading file:", error);
      alert(error.message || "Error processing file");
    }
  };

  const handlePreviewSend = async () => {
    if (!previewData || sending) return;
    setSending(true);
    try {
      if (previewType === 'image') {
        await sendImage(previewData, caption.trim() || undefined);
      } else if (previewFileData) {
        await sendFile(previewFileData.base64, previewFileData.name, previewFileData.type, previewFileData.size, caption.trim() || undefined);
      }
      setPreviewData(null);
      setPreviewFileData(null);
      setCaption("");
    } catch (error: any) {
      console.error("Error sending:", error);
      alert("Error sending: " + error.message);
    } finally {
      setSending(false);
    }
  };

  const handlePreviewCancel = () => {
    setPreviewData(null);
    setPreviewFileData(null);
    setCaption("");
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setShowAttachmentMenu(false);
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    await showImagePreview(file);
  };

  const handleDocumentSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setShowAttachmentMenu(false);
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    await showFilePreview(file);
  };

  // Handle Ctrl+V Paste for Images
  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        e.preventDefault();
        const blob = items[i].getAsFile();
        if (blob) {
          await showImagePreview(blob);
        }
        break;
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
    <div ref={dropZoneRef} className="retro-input-bar p-3 sm:p-4 shrink-0 relative flex flex-col">
      {/* Preview Modal */}
      {previewData && (
        <PreviewModal
          previewData={previewData}
          previewType={previewType}
          previewFileName={previewFileName}
          caption={caption}
          onCaptionChange={setCaption}
          onSend={handlePreviewSend}
          onCancel={handlePreviewCancel}
          sending={sending}
        />
      )}

      {/* Drag Overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-[90] bg-green-500/10 border-4 border-dashed border-green-500 flex items-center justify-center pointer-events-none">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl px-8 py-6 text-center">
            <Paperclip className="w-10 h-10 text-green-500 mx-auto mb-2" />
            <p className="text-lg font-bold text-gray-700 dark:text-gray-200">Drop here to send</p>
          </div>
        </div>
      )}

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

      {/* Attachment Menu - positioned right above the button */}
      {showAttachmentMenu && (
        <div ref={menuRef} className="absolute bottom-[calc(100%-4px)] left-3 z-50 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 py-1 w-44 fade-in">
          <button 
            type="button"
            className="w-full flex items-center px-3 py-2.5 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
            onClick={() => { setShowAttachmentMenu(false); cameraInputRef.current?.click(); }}
          >
            <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center mr-2.5 text-blue-600 dark:text-blue-400">
              <Camera className="w-3.5 h-3.5" />
            </div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Take Photo</span>
          </button>
          
          <button 
            type="button"
            className="w-full flex items-center px-3 py-2.5 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
            onClick={() => { setShowAttachmentMenu(false); fileInputRef.current?.click(); }}
          >
            <div className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center mr-2.5 text-purple-600 dark:text-purple-400">
              <ImageIcon className="w-3.5 h-3.5" />
            </div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Select Photo</span>
          </button>

          <button 
            type="button"
            className="w-full flex items-center px-3 py-2.5 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
            onClick={() => { setShowAttachmentMenu(false); documentInputRef.current?.click(); }}
          >
            <div className="w-7 h-7 rounded-full bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center mr-2.5 text-orange-600 dark:text-orange-400">
              <FileIcon className="w-3.5 h-3.5" />
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
          ref={attachBtnRef}
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
