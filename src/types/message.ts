import { Timestamp } from "firebase/firestore";

export interface Message {
  id?: string;
  conversationId: string;
  senderId: string;
  receiverId: string;
  text: string;
  createdAt: Timestamp | Date | any; // allow any for simplicity right now
  expiresAt: Timestamp | Date | any;
  deliveredAt: Timestamp | Date | any | null;
  readAt: Timestamp | Date | any | null;
  status: "sent" | "delivered" | "read";
  replyTo?: {
    id: string;
    text: string;
    senderName: string;
  };
}

export interface UserPresence {
  userId: string;
  online: boolean;
  lastSeen: Timestamp | Date | any;
}
