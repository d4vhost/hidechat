import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "./useAuth";

export function useTyping(otherUid?: string) {
  const { user } = useAuth();
  const [isOtherTyping, setIsOtherTyping] = useState(false);

  useEffect(() => {
    if (!user) return;

    if (!otherUid) return;
    const otherTypingRef = doc(db, "typing", otherUid);

    const unsubscribe = onSnapshot(otherTypingRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setIsOtherTyping(data.typing || false);
      }
    });

    return () => unsubscribe();
  }, [user, otherUid]);

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
