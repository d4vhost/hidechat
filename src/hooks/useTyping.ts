import { useEffect, useState, useRef, useCallback } from "react";
import { doc, onSnapshot, setDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "./useAuth";

export function useTyping(otherUid?: string, conversationId?: string) {
  const { user } = useAuth();
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const staleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTypingTimestamp = useRef<Date | null>(null);

  useEffect(() => {
    if (!user || !otherUid) return;

    const otherTypingRef = doc(db, "typing", otherUid);

    const unsubscribe = onSnapshot(otherTypingRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        // Only show typing if it's for THIS conversation
        if (data.conversationId === conversationId && data.typing) {
          const updatedAt = data.updatedAt?.toDate?.() || null;
          lastTypingTimestamp.current = updatedAt;

          // Check staleness: if updatedAt is more than 5 seconds old, ignore
          if (updatedAt) {
            const ageMs = Date.now() - updatedAt.getTime();
            if (ageMs > 5000) {
              setIsOtherTyping(false);
              return;
            }
          }
          setIsOtherTyping(true);
        } else {
          setIsOtherTyping(false);
          lastTypingTimestamp.current = null;
        }
      } else {
        setIsOtherTyping(false);
      }
    });

    // Periodically check if the typing indicator is stale (every 3 seconds)
    staleTimerRef.current = setInterval(() => {
      if (lastTypingTimestamp.current) {
        const ageMs = Date.now() - lastTypingTimestamp.current.getTime();
        if (ageMs > 5000) {
          setIsOtherTyping(false);
        }
      }
    }, 3000);

    return () => {
      unsubscribe();
      if (staleTimerRef.current) {
        clearInterval(staleTimerRef.current);
      }
    };
  }, [user, otherUid, conversationId]);

  const setTyping = useCallback(async (typing: boolean) => {
    if (!user) return;
    const myTypingRef = doc(db, "typing", user.uid);
    await setDoc(myTypingRef, {
      userId: user.uid,
      typing,
      conversationId: conversationId || "",
      updatedAt: serverTimestamp()
    });
  }, [user, conversationId]);

  // Clear typing on unmount (when user leaves the chat)
  useEffect(() => {
    return () => {
      if (user) {
        const myTypingRef = doc(db, "typing", user.uid);
        setDoc(myTypingRef, {
          userId: user.uid,
          typing: false,
          conversationId: "",
          updatedAt: serverTimestamp()
        }).catch(() => {});
      }
    };
  }, [user]);

  return { isOtherTyping, setTyping };
}
