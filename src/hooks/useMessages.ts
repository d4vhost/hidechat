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
  or,
  arrayUnion,
  deleteField
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

        // Skip messages that were soft-deleted by the current user
        if (data.deletedBy && data.deletedBy.includes(user.uid)) return;

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
      status: "sent",
      type: "text"
    };

    if (replyTo) {
      messageData.replyTo = replyTo;
    }

    await addDoc(collection(db, "messages"), messageData);
  };

  const sendImage = async (imageBase64: string, caption?: string) => {
    if (!user || !conversationId || !receiverId) return;

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await addDoc(collection(db, "messages"), {
      conversationId: conversationId,
      senderId: user.uid,
      receiverId,
      text: caption || "Photo",
      createdAt: serverTimestamp(),
      expiresAt: expiresAt,
      deliveredAt: null,
      readAt: null,
      status: "sent",
      type: "image",
      imageData: imageBase64,
      imageViewed: false
    });
  };

  const viewImage = async (messageId: string) => {
    if (!user || !messageId) return;
    const msgRef = doc(db, "messages", messageId);
    await updateDoc(msgRef, {
      imageData: "",
      imageViewed: true,
      text: "Photo opened",
      status: "read",
      readAt: serverTimestamp()
    });
  };

  const sendFile = async (fileBase64: string, fileName: string, fileType: string, fileSize: number, caption?: string) => {
    if (!user || !conversationId || !receiverId) return;

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await addDoc(collection(db, "messages"), {
      conversationId: conversationId,
      senderId: user.uid,
      receiverId,
      text: caption || fileName,
      createdAt: serverTimestamp(),
      expiresAt: expiresAt,
      deliveredAt: null,
      readAt: null,
      status: "sent",
      type: "file",
      fileData: fileBase64,
      fileName,
      fileType,
      fileSize
    });
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
        const data = docSnap.data();
        if (data.conversationId === conversationId) {
          const deletedBy = data.deletedBy || [];
          if (deletedBy.length > 0 && !deletedBy.includes(user.uid)) {
            // The other person already deleted it. Now I am deleting it. So we can actually delete the document!
            batch.delete(docSnap.ref);
          } else if (!deletedBy.includes(user.uid)) {
            // Only I am deleting it (soft delete)
            batch.update(docSnap.ref, {
              deletedBy: arrayUnion(user.uid)
            });
          }
        }
      });
      await batch.commit();
    } catch (error) {
      console.error("Error clearing messages:", error);
    }
  };

  return { messages, sendMessage, sendImage, sendFile, viewImage, markAsRead, clearAllMessages };
}
