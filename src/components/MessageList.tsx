"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMessages } from "@/hooks/useMessages";
import { useTyping } from "@/hooks/useTyping";
import { useChatColor } from "@/hooks/useChatColor";
import { Reply, Camera, Eye, File as FileIcon, ChevronDown } from "lucide-react";
import { formatFileSize } from "@/lib/imageUtils";
import { useLanguage } from "@/context/LanguageContext";

interface MessageListProps {
  onReply: (msg: any) => void;
  isStealthMode?: boolean;
  conversationId: string;
  receiverId: string;
  contactName: string;
}

// ---- Image Viewer Modal (View-Once) ----
function ImageViewerModal({ imageData, onClose }: { imageData: string; onClose: () => void }) {
  return (
    <div 
      className="fixed inset-0 z-[200] bg-black flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10">
        <span className="text-white/70 text-sm font-bold">View Once — Tap anywhere to close</span>
        <button 
          onClick={onClose}
          className="text-white bg-white/20 rounded-full px-4 py-1 font-bold text-sm backdrop-blur-sm"
        >
          Close
        </button>
      </div>
      <img 
        src={imageData} 
        alt="View once" 
        className="max-w-full max-h-full object-contain p-4"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

// ---- Menu Component for Messages ----
function MessageMenu({ onReply, isMine }: { onReply: () => void, isMine: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <>
      <button 
        onClick={(e) => { e.stopPropagation(); setShow(!show); }}
        className={`absolute top-1 right-2 p-0.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 z-20 ${isMine ? 'hidden' : ''}`}
      >
        <ChevronDown className="w-4 h-4" />
      </button>
      
      {show && (
        <>
          <div className="fixed inset-0 z-30" onClick={(e) => { e.stopPropagation(); setShow(false); }} />
          <div className="absolute top-7 right-0 bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700 rounded-lg py-1 z-40 min-w-[120px] fade-in">
            <button 
              onClick={(e) => { e.stopPropagation(); setShow(false); onReply(); }}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <Reply className="w-4 h-4" />
              Reply
            </button>
          </div>
        </>
      )}
    </>
  );
}

// ---- Image Bubble Component ----
function ImageBubble({ msg, isMine, dateObj, userId, viewImage, isStealthMode, onReply, contactName }: { 
  msg: any; 
  isMine: boolean; 
  dateObj: Date;
  userId: string;
  viewImage: (id: string) => Promise<void>;
  isStealthMode?: boolean;
  onReply: (msg: any) => void;
  contactName: string;
}) {
  const [showViewer, setShowViewer] = useState(false);
  const hasImage = msg.imageData && msg.imageData.length > 0;
  const isViewed = msg.imageViewed === true;
  const canView = hasImage && (!isViewed || isMine);

  const handleOpen = () => {
    if (canView) {
      setShowViewer(true);
    }
  };

  const handleClose = async () => {
    setShowViewer(false);
    if (msg.id && !isMine && !isViewed) {
      try {
        await viewImage(msg.id);
      } catch (e) {
        console.error("Error destroying image:", e);
      }
    }
  };

  const captionText = msg.text && msg.text !== 'Photo' && msg.text !== '📷 Photo' ? msg.text : null;

  return (
    <div className={`flex items-center relative ${isMine ? 'justify-end' : 'justify-start'}`}>
      
      {showViewer && hasImage && (
        <ImageViewerModal imageData={msg.imageData} onClose={handleClose} />
      )}
      <div 
        className={`max-w-[85%] sm:max-w-[75%] overflow-visible z-10 transition-all duration-300 relative group/bubble ${isStealthMode ? 'blur-[5px] hover:blur-none active:blur-none' : ''} ${
          isMine 
            ? 'rounded-2xl rounded-br-sm' 
            : 'rounded-2xl rounded-bl-sm'
        } ${canView ? 'cursor-pointer active:opacity-80' : ''}`}
        onClick={handleOpen}
      >
        <MessageMenu onReply={() => onReply({ id: msg.id, text: captionText || '📷 Photo', senderName: contactName })} isMine={isMine} />

        {/* Image content */}
        <div className="overflow-hidden rounded-2xl">
          {isViewed && !isMine ? (
            <div className={`flex items-center gap-2 px-4 py-3 ${
              isMine ? 'retro-bubble-green' : 'retro-bubble-gray'
            }`}>
              <Eye className="w-4 h-4 text-gray-500" />
              <span className="text-sm italic text-gray-600">
                Photo opened
              </span>
            </div>
          ) : (
            <div className="relative">
              {hasImage ? (
                <>
                  <img 
                    src={msg.imageData} 
                    alt="Photo" 
                    className={`w-full max-w-[280px] sm:max-w-[320px] h-auto object-cover ${
                      !isMine && !isViewed ? 'blur-lg scale-105' : ''
                    }`}
                    style={{ minHeight: '120px', maxHeight: '360px' }}
                  />
                  {!isMine && !isViewed && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30">
                      <div className="bg-black/50 rounded-full p-3 mb-2 backdrop-blur-sm">
                        <Eye className="w-6 h-6 text-white" />
                      </div>
                      <span className="text-white font-bold text-sm drop-shadow-lg">Tap to view</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="w-48 h-32 flex items-center justify-center text-gray-400 bg-gray-100">
                  <Camera className="w-8 h-8 opacity-50" />
                </div>
              )}
              {/* Caption overlay at bottom */}
              {captionText && (
                <div className={`px-3 py-2 text-sm ${
                  isMine 
                    ? 'bg-[#4a9d06] text-white' 
                    : 'bg-white/90 text-gray-800'
                }`}>
                  {captionText}
                </div>
              )}
            </div>
          )}

          {/* Timestamp and status */}
          <div className={`flex justify-end items-center px-3 py-1.5 space-x-1 ${
            isMine ? 'bg-[#4a9d06]' : 'bg-gray-200'
          }`}>
            <span className={`text-[10px] ${isMine ? 'text-white/70' : 'text-gray-500'}`}>
              {dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </span>
            {isMine && (
              <span className="text-[10px] flex items-center h-3">
                {msg.status === "sent" && "✓"}
                {msg.status === "delivered" && "✓✓"}
                {msg.status === "read" && <span className="text-white font-bold">✓✓</span>}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Swipeable Text Message ----
const SwipeableMessage = ({ msg, isMine, color, dateObj, onReply, contactName, isStealthMode }: any) => {
  const { t } = useLanguage();
  const [translateX, setTranslateX] = useState(0);
  const startX = useRef(0);
  
  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const diff = e.touches[0].clientX - startX.current;
    if (diff > 0 && diff < 60) {
      setTranslateX(diff);
    } else if (diff < 0 && diff > -60) {
      setTranslateX(diff);
    }
  };

  const handleTouchEnd = () => {
    if (Math.abs(translateX) > 40) {
      onReply({ id: msg.id, text: msg.text, senderName: isMine ? t('you') : contactName });
    }
    setTranslateX(0);
  };

  return (
    <div className={`flex items-center relative ${isMine ? 'justify-end' : 'justify-start'}`}>
      
      {/* Reply Icon Background (shows when pulling) */}
      <div 
        className={`absolute opacity-0 transition-opacity ${Math.abs(translateX) > 20 ? 'opacity-100' : ''} ${isMine ? 'left-4' : 'right-4'}`}
      >
        <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center">
          <Reply className="w-4 h-4 text-gray-300" />
        </div>
      </div>

      {/* Message Bubble Container */}
      <div 
        className={`max-w-[85%] sm:max-w-[75%] transition-transform duration-200 ease-out z-10 touch-pan-y relative group/bubble`}
        style={{ transform: `translateX(${translateX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div 
          className={`px-4 py-2 transition-all duration-300 ${isStealthMode ? 'blur-[5px] hover:blur-none active:blur-none' : ''} ${
            isMine 
              ? `retro-bubble-green rounded-2xl rounded-br-sm` 
              : `retro-bubble-gray rounded-2xl rounded-bl-sm`
          }`}
        >
          <MessageMenu onReply={() => onReply({ id: msg.id, text: msg.text, senderName: contactName })} isMine={isMine} />

          {/* Reply Quote Block */}
          {msg.replyTo && (
            <div className={`mb-2 p-2 rounded-lg text-xs border-l-4 ${isMine ? 'bg-black/20 border-white/50' : 'bg-black/5 dark:bg-black/30 border-gray-400 dark:border-gray-500'}`}>
              <div className={`font-bold mb-0.5 ${isMine ? 'text-white' : 'text-gray-800 dark:text-gray-300'}`}>{msg.replyTo.senderName}</div>
              <div className="opacity-80 line-clamp-2">{msg.replyTo.text}</div>
            </div>
          )}

          <div className="text-[15px] leading-relaxed break-words whitespace-pre-wrap pr-4">
            {msg.text}
          </div>
          <div className="flex justify-end items-center mt-1 space-x-1">
            <span className={`text-[10px] ${isMine ? 'text-white/70' : 'text-gray-500'}`}>
              {dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </span>
            {isMine && (
              <span className="text-[10px] flex items-center h-3">
                {msg.status === "sent" && "✓"}
                {msg.status === "delivered" && "✓✓"}
                {msg.status === "read" && <span className="text-white font-bold">✓✓</span>}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ---- File Bubble Component ----
function FileBubble({ msg, isMine, dateObj, isStealthMode, onReply, contactName }: { 
  msg: any; 
  isMine: boolean; 
  dateObj: Date;
  isStealthMode?: boolean;
  onReply: (msg: any) => void;
  contactName: string;
}) {
  const handleDownload = () => {
    if (!msg.fileData || !msg.fileName) return;
    const a = document.createElement("a");
    a.href = msg.fileData;
    a.download = msg.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const captionText = msg.text && !msg.text.startsWith('📎') ? msg.text : null;

  return (
    <div className={`flex items-center relative ${isMine ? 'justify-end' : 'justify-start'}`}>
      
      <div 
        className={`max-w-[85%] sm:max-w-[75%] px-4 py-3 z-10 cursor-pointer active:opacity-80 transition-all duration-300 relative group/bubble ${isStealthMode ? 'blur-[5px] hover:blur-none active:blur-none' : ''} ${
          isMine 
            ? 'retro-bubble-green rounded-2xl rounded-br-sm' 
            : 'retro-bubble-gray rounded-2xl rounded-bl-sm'
        }`}
        onClick={handleDownload}
      >
        <MessageMenu onReply={() => onReply({ id: msg.id, text: captionText || `📎 ${msg.fileName || 'File'}`, senderName: contactName })} isMine={isMine} />

        <div className="flex items-center gap-3 pr-4">
          <div className="w-10 h-10 bg-black/10 rounded-lg flex items-center justify-center shrink-0">
            <FileIcon className={`w-5 h-5 ${isMine ? 'text-white/80' : 'text-gray-600'}`} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className={`text-sm font-bold truncate ${isMine ? 'text-white' : 'text-gray-800'}`}>
              {msg.fileName || "File"}
            </span>
            <span className={`text-xs ${isMine ? 'text-white/70' : 'text-gray-500'}`}>
              {msg.fileSize ? formatFileSize(msg.fileSize) : "Unknown size"}
            </span>
          </div>
        </div>

        {captionText && (
          <div className={`mt-2 text-sm ${isMine ? 'text-white/90' : 'text-gray-700'}`}>
            {captionText}
          </div>
        )}

        <div className="flex justify-end items-center mt-2 space-x-1">
          <span className={`text-[10px] ${isMine ? 'text-white/70' : 'text-gray-500'}`}>
            {dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
          </span>
          {isMine && (
            <span className="text-[10px] flex items-center h-3">
              {msg.status === "sent" && "✓"}
              {msg.status === "delivered" && "✓✓"}
              {msg.status === "read" && <span className="text-white font-bold">✓✓</span>}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MessageList({ onReply, isStealthMode, conversationId, receiverId, contactName }: MessageListProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { messages, markAsRead, viewImage } = useMessages(conversationId, receiverId);
  const { isOtherTyping } = useTyping(receiverId, conversationId);
  const { color } = useChatColor();
  const bottomRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    markAsRead();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, user]);

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain p-4 bg-transparent flex flex-col space-y-3">
      {/* Typing Indicator */}
      {isOtherTyping && (
        <div className="flex justify-start mb-2 px-2 fade-in relative z-10">
          <div className="bg-white/80 dark:bg-[#1a1a1a]/80 backdrop-blur-md px-3 py-1.5 rounded-full shadow-sm text-xs text-gray-500 font-bold border border-gray-200 dark:border-[#333]">
            {contactName} {t('isTyping')}
          </div>
        </div>
      )}
      {messages.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center bg-white/50 backdrop-blur-md px-4 py-2 text-gray-700 font-bold text-xs border border-white/50 rounded-full shadow-sm">
            {t('messagesWillDisappear')}
          </div>
        </div>
      ) : (
        <>
          {messages.map((msg) => {
            const isMine = msg.senderId === user?.uid;
            const dateObj = msg.createdAt?.toDate ? msg.createdAt.toDate() : new Date();
            
            if (msg.type === 'image') {
              return (
                <ImageBubble 
                  key={msg.id}
                  msg={msg}
                  isMine={isMine}
                  dateObj={dateObj}
                  userId={user?.uid || ""}
                  viewImage={viewImage}
                  isStealthMode={isStealthMode}
                  onReply={onReply}
                  contactName={contactName}
                />
              );
            }

            if (msg.type === 'file') {
              return (
                <FileBubble 
                  key={msg.id}
                  msg={msg}
                  isMine={isMine}
                  dateObj={dateObj}
                  isStealthMode={isStealthMode}
                  onReply={onReply}
                  contactName={contactName}
                />
              );
            }
            
            return (
              <SwipeableMessage 
                key={msg.id}
                msg={msg} 
                isMine={isMine} 
                color={color} 
                dateObj={dateObj} 
                onReply={onReply}
                contactName={contactName}
                isStealthMode={isStealthMode}
              />
            );
          })}
          {isOtherTyping && (
            <div className="flex justify-start">
              <div className="retro-bubble-gray px-4 py-2 rounded-2xl rounded-bl-sm">
                <div className="flex space-x-1 h-4 items-center">
                  <div className="w-1.5 h-1.5 bg-gray-600 rounded-full animate-bounce" style={{animationDelay: "0.4s"}}></div>
                  <div className="w-1.5 h-1.5 bg-gray-600 rounded-full animate-bounce" style={{animationDelay: "0.5s"}}></div>
                  <div className="w-1.5 h-1.5 bg-gray-600 rounded-full animate-bounce" style={{animationDelay: "0.6s"}}></div>
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} className="h-1 shrink-0" />
        </>
      )}
    </div>
  );
}
