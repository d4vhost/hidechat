import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, getDocs, getDoc, doc, setDoc, deleteDoc, updateDoc, arrayUnion, serverTimestamp } from "firebase/firestore";
import { useAuth } from "./useAuth";
import { useLanguage } from "@/context/LanguageContext";

export interface FriendRequest {
  id: string;
  fromId: string;
  toId: string;
  fromPhone: string;
  fromUsername?: string;
  sentVia?: 'phone' | 'alias';
  status: string;
  createdAt: any;
}

export function useFriendRequests() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setPendingRequests([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "friend_requests"),
      where("toId", "==", user.uid),
      where("status", "==", "pending")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const requests = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as FriendRequest[];
      setPendingRequests(requests);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const sendRequest = async (targetIdentifier: string, currentUserPhone: string, currentUsername?: string) => {
    if (!user) throw new Error("Not authenticated");
    
    const isPhone = /^\+?[0-9\s]+$/.test(targetIdentifier);
    let q;
    const usersRef = collection(db, "users");

    if (isPhone) {
      const normalizedPhone = targetIdentifier.replace(/\s+/g, '');
      q = query(usersRef, where("phoneNumber", "==", normalizedPhone));
    } else {
      q = query(usersRef, where("username", "==", targetIdentifier.trim()));
    }
    
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      throw new Error(t('userNotFound'));
    }
    
    const targetUserDoc = snapshot.docs[0];
    const targetUserId = targetUserDoc.id;
    
    if (targetUserId === user.uid) {
      throw new Error(t('cantAddSelf'));
    }
    
    // Check friendship in BOTH directions
    const targetUserData = targetUserDoc.data();
    const targetHasMe = targetUserData.contacts && targetUserData.contacts.includes(user.uid);
    
    const myDoc = await getDoc(doc(db, "users", user.uid));
    const myData = myDoc.data();
    const iHaveTarget = myData?.contacts && myData.contacts.includes(targetUserId);
    
    if (targetHasMe && iHaveTarget) {
      // Both sides have each other - truly already friends
      throw new Error(t('alreadyFriends'));
    }
    
    if (targetHasMe || iHaveTarget) {
      // One-sided friendship (caused by re-registration wiping contacts)
      // Auto-repair: add the missing side
      if (!iHaveTarget) {
        await updateDoc(doc(db, "users", user.uid), {
          contacts: arrayUnion(targetUserId)
        });
      }
      if (!targetHasMe) {
        await updateDoc(doc(db, "users", targetUserId), {
          contacts: arrayUnion(user.uid)
        });
      }
      throw new Error(t('alreadyFriends'));
    }

    const reqQ = query(
      collection(db, "friend_requests"),
      where("fromId", "==", user.uid),
      where("toId", "==", targetUserId)
    );
    const reqSnapshot = await getDocs(reqQ);
    if (!reqSnapshot.empty) {
      return; // Silently ignore duplicate requests
    }
    
    const requestId = `${user.uid}_${targetUserId}`;
    await setDoc(doc(db, "friend_requests", requestId), {
      fromId: user.uid,
      fromPhone: currentUserPhone,
      fromUsername: currentUsername || "",
      sentVia: isPhone ? 'phone' : 'alias',
      toId: targetUserId,
      status: "pending",
      createdAt: serverTimestamp()
    });
  };

  const acceptRequest = async (requestId: string, fromId: string) => {
    if (!user) return;
    
    // 1. Update current user's contacts
    await updateDoc(doc(db, "users", user.uid), {
      contacts: arrayUnion(fromId)
    });
    
    // 2. Update sender's contacts
    await updateDoc(doc(db, "users", fromId), {
      contacts: arrayUnion(user.uid)
    });
    
    // 3. Delete the request
    await deleteDoc(doc(db, "friend_requests", requestId));
  };

  const rejectRequest = async (requestId: string) => {
    await deleteDoc(doc(db, "friend_requests", requestId));
  };

  return {
    pendingRequests,
    loading,
    sendRequest,
    acceptRequest,
    rejectRequest
  };
}
