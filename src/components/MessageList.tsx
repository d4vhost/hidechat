"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMessages } from "@/hooks/useMessages";
import { useTyping } from "@/hooks/useTyping";
import { useChatColor } from "@/hooks/useChatColor";
import { Reply, Camera, Eye } from "lucide-react";
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

// ---- Image Bubble Component ----
function ImageBubble({ msg, isMine, dateObj, userId, viewImage }: { 
  msg: any; 
  isMine: boolean; 
  dateObj: Date;
  userId: string;
  viewImage: (id: string) => Promise<void>;
}) {
  const [showViewer, setShowViewer] = useState(false);
  const hasImage = msg.imageData && msg.imageData.length > 0;
  const isViewed = msg.imageViewed === true;
  const canView = !isMine && hasImage && !isViewed;

  const handleOpen = () => {
    if (canView) {
      setShowViewer(true);
    }
  };

  const handleClose = async () => {
    setShowViewer(false);
    // Destroy the image after viewing
    if (msg.id) {
      try {
        await viewImage(msg.id);
      } catch (e) {
        console.error("Error destroying image:", e);
      }
    }
  };

  return (
    <>
      {showViewer && hasImage && (
        <ImageViewerModal imageData={msg.imageData} onClose={handleClose} />
      )}
      <div 
        className={`px-4 py-3 ${
          isMine 
            ? 'retro-bubble-green rounded-2xl rounded-br-sm' 
            : 'retro-bubble-gray rounded-2xl rounded-bl-sm'
        } ${canView ? 'cursor-pointer active:opacity-80' : ''}`}
        onClick={handleOpen}
      >
        {/* Image content */}
        {isViewed || !hasImage ? (
          // Image was already viewed or destroyed
          <div className="flex items-center gap-2 py-1">
            <Eye className={`w-4 h-4 ${isMine ? 'text-white/70' : 'text-gray-500'}`} />
            <span className={`text-sm italic ${isMine ? 'text-white/80' : 'text-gray-600'}`}>
              📷 Photo opened
            </span>
          </div>
        ) : isMine ? (
          // Sender sees a placeholder (can't open their own image)
          <div className="flex items-center gap-2 py-1">
            <Camera className="w-4 h-4 text-white/70" />
            <span className="text-sm text-white/80">📷 Photo</span>
          </div>
        ) : (
          // Receiver can tap to view
          <div className="flex flex-col items-center gap-2 py-2">
            <div className="w-16 h-16 bg-black/20 rounded-xl flex items-center justify-center border border-black/10">
              <Camera className="w-8 h-8 text-gray-600" />
            </div>
            <span className="text-xs font-bold text-gray-700">Tap to view</span>
          </div>
        )}

        {/* Timestamp and status */}
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
    </>
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
    setTranslateX(0); // bounce back
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
        className={`max-w-[85%] sm:max-w-[75%] transition-transform duration-200 ease-out z-10 touch-pan-y`}
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
          {/* Reply Quote Block */}
          {msg.replyTo && (
            <div className={`mb-2 p-2 rounded-lg text-xs border-l-4 ${isMine ? 'bg-black/20 border-white/50' : 'bg-black/5 dark:bg-black/30 border-gray-400 dark:border-gray-500'}`}>
              <div className={`font-bold mb-0.5 ${isMine ? 'text-white' : 'text-gray-800 dark:text-gray-300'}`}>{msg.replyTo.senderName}</div>
              <div className="opacity-80 line-clamp-2">{msg.replyTo.text}</div>
            </div>
          )}

          <div className="text-[15px] leading-relaxed break-words whitespace-pre-wrap">
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
    <div className="flex-1 overflow-y-auto overscroll-contain p-4 bg-transparent flex flex-col space-y-4">
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
            const isImageMsg = msg.type === 'image';
            
            return (
              <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[85%] sm:max-w-[75%]">
                  {isImageMsg ? (
                    <ImageBubble 
                      msg={msg}
                      isMine={isMine}
                      dateObj={dateObj}
                      userId={user?.uid || ""}
                      viewImage={viewImage}
                    />
                  ) : (
                    <SwipeableMessage 
                      msg={msg} 
                      isMine={isMine} 
                      color={color} 
                      dateObj={dateObj} 
                      onReply={onReply}
                      contactName={contactName}
                      isStealthMode={isStealthMode}
                    />
                  )}
                </div>
              </div>
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
