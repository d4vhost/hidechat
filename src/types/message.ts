import { Timestamp } from "firebase/firestore";

export interface Message {
  id?: string;
  conversationId: string;
  senderId: string;
  receiverId: string;
  text: string;
  createdAt: Timestamp | Date | any;
  expiresAt: Timestamp | Date | any;
  deliveredAt: Timestamp | Date | any | null;
  readAt: Timestamp | Date | any | null;
  status: "sent" | "delivered" | "read";
  replyTo?: {
    id: string;
    text: string;
    senderName: string;
  };
  deletedBy?: string[];
  // View-once image fields
  type?: 'text' | 'image' | 'file';
  imageData?: string;       // Base64 compressed image data
  imageViewed?: boolean;    // true after receiver opens the image
  // File attachment fields
  fileData?: string;        // Base64 file data
  fileName?: string;        // Original file name
  fileType?: string;        // MIME type
  fileSize?: number;        // Size in bytes
}

export interface UserPresence {
  userId: string;
  online: boolean;
  lastSeen: Timestamp | Date | any;
}
