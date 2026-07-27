# 💬 POP Chat — Private & Secure Messaging Platform

<div align="center">

![POP Chat](https://img.shields.io/badge/POP%20Chat-Private%20Messaging-6C63FF?style=for-the-badge&logo=chat&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-16.2-000000?style=for-the-badge&logo=next.js&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-Firestore-FF6F00?style=for-the-badge&logo=firebase&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)

**A privacy-first, real-time messaging platform with end-to-end encryption, stealth mode, and 24-hour auto-destruction.**

</div>

---

## 📖 What is POP Chat?

POP Chat is a **secure, private messaging system** designed from the ground up with user privacy at its core. Unlike conventional messaging apps, POP Chat gives you full control over your data, with built-in features like **Stealth Mode**, **24-hour auto-destruction**, and **device-sync via QR code** — all without compromising on the user experience.

> ⚠️ **Built for privacy.** Messages self-destruct, chats can be locally wiped, and your identity is protected behind phone-based authentication + a secret password + a unique recovery key.

---

## ✨ Key Features

### 🔐 Security & Privacy
- **Phone-based Authentication** — Login with phone number + OTP via Firebase SMS
- **Password-protected access** — Salted SHA-256 password hash stored in a private Firestore subcollection
- **Recovery Key system** — Cryptographically-generated recovery key (`POP-XXXX-XXXX`) for account recovery
- **Device authorization** — Every new device must be explicitly authorized via QR code scan
- **Soft-delete messages** — Deleting a conversation removes it only for *you*, not the other person
- **Private subcollection** — Password and recovery hashes are stored in `/users/{uid}/private/credentials`, inaccessible to other users
- **Firestore security rules** — Granular rules ensuring users can only access their own data

### 💬 Messaging
- **Real-time chat** — Messages delivered instantly via Firestore `onSnapshot` listeners
- **Typing indicators** — See when the other person is typing
- **Read receipts** — Know when your message has been seen
- **Reply to messages** — Thread-style replies with visual context
- **Emoji picker** — Full emoji support built-in
- **Message expiration** — All messages have a 24-hour TTL and auto-destruct from the server

### 🕵️ Stealth Mode
- **Blur all messages** — Activate Stealth Mode to blur all chat content
- **Hover to reveal** — Mouse over individual messages to read them
- **Blurred username** — Contact names are also blurred for screen-privacy
- **Input field blur** — The text input adapts to keep your typing private
- **Persistent preference** — Stealth Mode setting is saved locally per device

### 🗑️ Clear Chat
- **Local privacy wipe** — Clear a conversation from your view without affecting the other person
- **Full-screen confirmation modal** — Detailed info about what the action does before confirming
- **24-hour auto-destruction** — All messages are auto-deleted server-side after 24 hours regardless

### 📱 Multi-Device Support
- **QR Code device sync** — Scan a QR from an authorized device to add a new one
- **Device management** — View and revoke devices from your profile settings
- **QR session cleanup** — Session tokens are deleted after use, preventing reuse

### 👥 Social & Contact System
- **Friend request system** — Send requests by phone number or @username alias
- **Contact management** — Accept or reject incoming requests
- **User presence** — See who's online in real-time

### 🌐 Internationalization
- **Multi-language support** — Full i18n system with English and Spanish
- **Language switcher** — Toggle language from the settings panel

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16.2 (App Router) |
| **Language** | TypeScript 5 |
| **Auth** | Firebase Authentication (Phone/SMS + Custom Token) |
| **Database** | Firebase Firestore |
| **Styling** | Tailwind CSS 4 |
| **Icons** | Lucide React |
| **QR Code** | react-qr-code + @yudiel/react-qr-scanner |
| **Emoji** | emoji-picker-react |
| **Crypto** | Web Crypto API (`crypto.subtle`, `crypto.getRandomValues`) |
| **Hosting** | Vercel / Firebase Hosting compatible |

---

## 🗂️ Project Structure

```
hidechat/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Main inbox / home screen
│   │   ├── layout.tsx            # Root layout + providers
│   │   ├── login/
│   │   │   └── page.tsx          # Auth flow (register, login, OTP, QR)
│   │   ├── chat/
│   │   │   └── [id]/
│   │   │       └── page.tsx      # Individual chat page
│   │   └── api/
│   │       └── auth/
│   │           └── qr-sync/
│   │               └── route.ts  # Server: generates custom tokens for QR auth
│   ├── components/
│   │   ├── ChatHeader.tsx        # Chat top bar, stealth mode, clear chat modal
│   │   ├── MessageList.tsx       # Scrollable message feed
│   │   ├── MessageInput.tsx      # Typing area with emoji + reply
│   │   └── MessageBubble.tsx     # Individual message component
│   ├── hooks/
│   │   ├── useAuth.ts            # Firebase auth state + device verification
│   │   ├── useMessages.ts        # Real-time message listener + soft delete
│   │   ├── useFriendRequests.ts  # Send / accept / reject friend requests
│   │   └── useChatColor.ts       # Per-user chat color preference
│   ├── context/
│   │   ├── AuthContext.tsx       # Global auth state provider
│   │   └── LanguageContext.tsx   # i18n language provider
│   ├── lib/
│   │   ├── firebase.ts           # Firebase app + Firestore + Auth init
│   │   └── crypto.ts             # hashString (salted SHA-256), generateRecoveryKey
│   ├── types/
│   │   └── message.ts            # Message interface (incl. deletedBy, replyTo, etc.)
│   └── i18n/
│       └── translations.ts       # All UI strings in EN + ES
├── firestore.rules               # Firestore security rules
├── next.config.ts                # Security headers + Next.js config
└── package.json
```

---

## 🔒 Security Architecture

### Authentication Flow
```
1. User enters phone number
2. Firebase sends OTP via SMS
3. User confirms OTP
4. User enters password (verified against salted hash in /private/credentials)
5. If new device → must provide recovery key
6. Device info is appended to authorized devices list
```

### QR Device Sync Flow
```
1. Primary device generates a random QR session ID
2. Primary device scans its own ID token and calls /api/auth/qr-sync
3. Firestore qr_sessions/{id} is created with a custom Firebase token
4. Secondary device listens to qr_sessions/{id}
5. On token received → signInWithCustomToken → delete session document
```

### Data Privacy Rules
- `passwordHash` and `recoveryKeyHash` stored in `/users/{uid}/private/credentials` (owner-only read/write)
- Message `read/write` restricted to `senderId` and `receiverId` only
- Contacts array can only be modified by the owner or to add themselves
- Messages cannot have their text, sender, or timestamps modified after creation

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- A Firebase project with **Phone Auth** and **Firestore** enabled
- A `.env.local` file with your Firebase credentials

### Installation

```bash
# Clone the repo
git clone https://github.com/d4vhost/hidechat.git
cd hidechat

# Install dependencies
npm install

# Create .env.local
cp .env.example .env.local
# Fill in your Firebase config values

# Run development server
npm run dev
```

### Environment Variables

```env
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
FIREBASE_ADMIN_PROJECT_ID=...
FIREBASE_ADMIN_CLIENT_EMAIL=...
FIREBASE_ADMIN_PRIVATE_KEY=...
```

### Deploy Firestore Rules

```bash
firebase deploy --only firestore:rules
```

---

## 🛡️ Security Patches Applied (v1.1.0)

- ✅ Password & recovery key hashes moved to private Firestore subcollection
- ✅ Salted SHA-256 hashing (salt = user UID)
- ✅ `crypto.getRandomValues()` for recovery key generation (replaces `Math.random()`)
- ✅ `crypto.randomUUID()` for device ID generation
- ✅ Firestore rules: contacts array restricted — users can only add themselves
- ✅ Firestore rules: message update restricted to conversation participants only
- ✅ QR session documents deleted after successful device sync
- ✅ All `console.log` statements removed from production code
- ✅ Security HTTP headers added (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`)
- ✅ Backward-compatible migration for existing users on next login

---

## 📄 License

Private repository — All rights reserved © 2026 d4vhost

---

<div align="center">
Built with ❤️ and privacy in mind.
</div>
