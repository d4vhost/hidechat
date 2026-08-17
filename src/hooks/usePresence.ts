import { useEffect, useState, useRef } from "react";
import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "./useAuth";

// How many seconds before we consider a user "stale" (offline)
const HEARTBEAT_INTERVAL_MS = 15000; // 15 seconds
const STALE_THRESHOLD_MS = 30000;    // 30 seconds without heartbeat = offline

export function usePresence(otherUid?: string) {
  const { user } = useAuth();
  const [otherUserOnline, setOtherUserOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState<Date | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const staleCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSeenRef = useRef<Date | null>(null);

  useEffect(() => {
    if (!user || !otherUid) return;

    const myPresenceRef = doc(db, "presence", user.uid);
    const otherPresenceRef = doc(db, "presence", otherUid);

    // Set me as online immediately
    const goOnline = () => {
      setDoc(myPresenceRef, {
        userId: user.uid,
        online: true,
        lastSeen: serverTimestamp()
      }).catch(() => {});
    };

    // Set me as offline
    const goOffline = () => {
      // Use a plain Date instead of serverTimestamp for beforeunload reliability
      setDoc(myPresenceRef, {
        userId: user.uid,
        online: false,
        lastSeen: new Date()
      }).catch(() => {});
    };

    goOnline();

    // Heartbeat: refresh lastSeen periodically so staleness can be detected
    heartbeatRef.current = setInterval(() => {
      if (document.visibilityState === 'visible') {
        setDoc(myPresenceRef, {
          userId: user.uid,
          online: true,
          lastSeen: serverTimestamp()
        }).catch(() => {});
      }
    }, HEARTBEAT_INTERVAL_MS);

    // Listen to other user's presence
    const unsubscribe = onSnapshot(otherPresenceRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const seen = data.lastSeen?.toDate?.() || (data.lastSeen instanceof Date ? data.lastSeen : null);
        lastSeenRef.current = seen;
        
        if (data.online && seen) {
          // Check if the lastSeen is too old (stale)
          const ageMs = Date.now() - seen.getTime();
          if (ageMs > STALE_THRESHOLD_MS) {
            setOtherUserOnline(false);
          } else {
            setOtherUserOnline(true);
          }
        } else {
          setOtherUserOnline(false);
        }
        
        if (seen) {
          setLastSeen(seen);
        }
      } else {
        setOtherUserOnline(false);
      }
    });

    // Periodically check if the other user's presence is stale
    staleCheckRef.current = setInterval(() => {
      if (lastSeenRef.current) {
        const ageMs = Date.now() - lastSeenRef.current.getTime();
        if (ageMs > STALE_THRESHOLD_MS) {
          setOtherUserOnline(false);
        }
      }
    }, 10000);

    // Handle tab close or unload
    const handleUnload = () => {
      goOffline();
    };

    // Handle mobile PWA going to background/foreground
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        goOnline();
      } else {
        goOffline();
      }
    };

    window.addEventListener("beforeunload", handleUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (staleCheckRef.current) clearInterval(staleCheckRef.current);
      goOffline();
      unsubscribe();
    };
  }, [user, otherUid]);

  return { otherUserOnline, lastSeen };
}
