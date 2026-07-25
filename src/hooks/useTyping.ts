import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "./useAuth";

export function useTyping() {
  const { user } = useAuth();
  const [isOtherTyping, setIsOtherTyping] = useState(false);

  useEffect(() => {
    if (!user) return;

    const otherUid = user.uid === "HUrCHrXT4rhKTGWnQNyGufv15VJ2" 
      ? "yGaR1wXf5BShtDWLB7dQ21P9CF83" 
      : "HUrCHrXT4rhKTGWnQNyGufv15VJ2";
    
    const otherTypingRef = doc(db, "typing", otherUid);

    const unsubscribe = onSnapshot(otherTypingRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setIsOtherTyping(data.typing || false);
      }
    });

    return () => unsubscribe();
  }, [user]);

  const setTyping = async (typing: boolean) => {
    if (!user) return;
    const myTypingRef = doc(db, "typing", user.uid);
    await setDoc(myTypingRef, {
      userId: user.uid,
      typing,
      updatedAt: serverTimestamp()
    });
  };

  return { isOtherTyping, setTyping };
}
