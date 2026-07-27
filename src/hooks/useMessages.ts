import { useState, useEffect } from "react";
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp, 
  orderBy, 
  where,
  getDocs,
  writeBatch,
  or
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Message } from "@/types/message";
import { useAuth } from "./useAuth";

export function useMessages(conversationId?: string, receiverId?: string) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    if (!user) return;

    // We get all messages that haven't expired yet
    const messagesRef = collection(db, "messages");
    const q = query(
      messagesRef,
      or(
        where("senderId", "==", user.uid),
        where("receiverId", "==", user.uid)
      )
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const now = new Date();
      const msgs: Message[] = [];
      const batch = writeBatch(db);
      let hasBatchOps = false;

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        
        // Filter locally by conversationId to avoid composite index requirements
        if (data.conversationId !== conversationId) return;

        const expiresAt = data.expiresAt?.toDate ? data.expiresAt.toDate() : (data.expiresAt instanceof Date ? data.expiresAt : null);
        
        // 1. Check if expired (24h self-destruct)
        if (expiresAt && expiresAt < now) {
          batch.delete(docSnap.ref);
          hasBatchOps = true;
          return; // Do not add to UI
        }

        msgs.push({ id: docSnap.id, ...data } as Message);

        // 2. Mark as delivered if I am the receiver and it was just "sent"
        if (data.receiverId === user.uid && data.status === "sent") {
          batch.update(docSnap.ref, {
            status: "delivered",
            deliveredAt: serverTimestamp()
          });
          hasBatchOps = true;
        }
      });

      if (hasBatchOps) {
        batch.commit().catch(console.error);
      }

      // Ordenar localmente por fecha de creación (evita el error del índice en Firebase)
      msgs.sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || Date.now();
        const timeB = b.createdAt?.toMillis?.() || Date.now();
        return timeA - timeB;
      });

      setMessages(msgs);
    }, (error) => {
      console.error("Error cargando mensajes desde Firestore:", error);
    });

    return () => unsubscribe();
  }, [user, conversationId]);

  const sendMessage = async (text: string, replyTo?: Message['replyTo']) => {
    if (!user || !text.trim() || !conversationId || !receiverId) return;

    // 24 hours from now
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const messageData: any = {
      conversationId: conversationId,
      senderId: user.uid,
      receiverId,
      text: text.trim(),
      createdAt: serverTimestamp(),
      expiresAt: expiresAt,
      deliveredAt: null,
      readAt: null,
      status: "sent"
    };

    if (replyTo) {
      messageData.replyTo = replyTo;
    }

    await addDoc(collection(db, "messages"), messageData);
  };

  const markAsRead = async () => {
    if (!user) return;
    
    // Find messages sent to me that are not "read"
    const unreadMessages = messages.filter(
      (m) => m.receiverId === user.uid && m.status !== "read"
    );

    if (unreadMessages.length > 0) {
      const batch = writeBatch(db);
      unreadMessages.forEach((m) => {
        const ref = doc(db, "messages", m.id!);
        batch.update(ref, {
          status: "read",
          readAt: serverTimestamp()
        });
      });
      await batch.commit();
    }
  };

  const clearAllMessages = async () => {
    if (!user) return;
    try {
      const messagesRef = collection(db, "messages");
      const q = query(
        messagesRef,
        or(
          where("senderId", "==", user.uid),
          where("receiverId", "==", user.uid)
        )
      );
      const snapshot = await getDocs(q);
      
      const batch = writeBatch(db);
      snapshot.forEach((docSnap) => {
        if (docSnap.data().conversationId === conversationId) {
          batch.delete(docSnap.ref);
        }
      });
      await batch.commit();
    } catch (error) {
      console.error("Error clearing messages:", error);
    }
  };

  return { messages, sendMessage, markAsRead, clearAllMessages };
}
