import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // Validate POP Protocol Device Auth
        let deviceId = localStorage.getItem('pop-device-id');
        if (!deviceId) {
          // No device ID means they haven't passed the POP Auth flow on this device
          setUser(null);
          setLoading(false);
          return;
        }

        try {
          const docRef = doc(db, "users", currentUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const devicesArray = docSnap.data().devices || [];
            const isAuthorized = devicesArray.some((device: any) => {
              if (typeof device === 'object' && device !== null) {
                return device.id === deviceId;
              }
              return device === deviceId;
            });

            if (isAuthorized) {
              setUser(currentUser);
            } else {
              setUser(null); // Device not authorized yet
            }
          } else {
            setUser(null);
          }
        } catch (error) {
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { user, loading };
}
