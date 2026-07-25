"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMessages } from "@/hooks/useMessages";
import { useTyping } from "@/hooks/useTyping";
import { useChatColor } from "@/hooks/useChatColor";
import { Reply } from "lucide-react";

interface MessageListProps {
  onReply: (msg: any) => void;
  isStealthMode?: boolean;
}

const SwipeableMessage = ({ msg, isMine, color, dateObj, onReply, contactName, isStealthMode }: any) => {
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
      onReply({ id: msg.id, text: msg.text, senderName: isMine ? "Tú" : contactName });
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

export default function MessageList({ onReply, isStealthMode }: MessageListProps) {
  const { user } = useAuth();
  const { messages, markAsRead } = useMessages();
  const { isOtherTyping } = useTyping();
  const { color } = useChatColor();
  const bottomRef = useRef<HTMLDivElement>(null);

  const contactName = user?.uid === "HUrCHrXT4rhKTGWnQNyGufv15VJ2" ? "David" : "Majito";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    markAsRead();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, user]);

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain p-4 bg-transparent flex flex-col space-y-4">
      {messages.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center bg-white/50 backdrop-blur-md px-4 py-2 text-gray-700 font-bold text-xs border border-white/50 rounded-full shadow-sm">
            Los mensajes desaparecerán en 24h
          </div>
        </div>
      ) : (
        <>
          {messages.map((msg) => {
            const isMine = msg.senderId === user?.uid;
            const dateObj = msg.createdAt?.toDate ? msg.createdAt.toDate() : new Date();
            
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
