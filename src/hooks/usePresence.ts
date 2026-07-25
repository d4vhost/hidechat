import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
// Wait, onDisconnect is from Realtime Database, but the user said:
// "Si Firestore no es suficiente para detectar correctamente la desconexión, se puede evaluar Firebase Realtime Database únicamente para la presencia."
// I will use Firestore for now and update online status when component unmounts or window closes using beforeunload.

import { db } from "@/lib/firebase";
import { useAuth } from "./useAuth";

export function usePresence() {
  const { user } = useAuth();
  const [otherUserOnline, setOtherUserOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState<Date | null>(null);

  useEffect(() => {
    if (!user) return;

    const myPresenceRef = doc(db, "presence", user.uid);
    const otherUid = user.uid === "HUrCHrXT4rhKTGWnQNyGufv15VJ2" 
      ? "yGaR1wXf5BShtDWLB7dQ21P9CF83" 
      : "HUrCHrXT4rhKTGWnQNyGufv15VJ2";
    const otherPresenceRef = doc(db, "presence", otherUid);

    // Set me as online
    setDoc(myPresenceRef, {
      userId: user.uid,
      online: true,
      lastSeen: serverTimestamp()
    });

    // Listen to other user's presence
    const unsubscribe = onSnapshot(otherPresenceRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setOtherUserOnline(data.online);
        if (data.lastSeen) {
          setLastSeen(data.lastSeen.toDate());
        }
      }
    });

    // Handle tab close or unload
    const handleUnload = () => {
      setDoc(myPresenceRef, {
        userId: user.uid,
        online: false,
        lastSeen: serverTimestamp()
      });
    };

    // Handle mobile PWA going to background/foreground
    const handleVisibilityChange = () => {
      setDoc(myPresenceRef, {
        userId: user.uid,
        online: document.visibilityState === 'visible',
        lastSeen: serverTimestamp()
      });
    };

    window.addEventListener("beforeunload", handleUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      handleUnload();
      unsubscribe();
    };
  }, [user]);

  return { otherUserOnline, lastSeen };
}
