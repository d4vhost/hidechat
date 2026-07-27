"use client";

import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Settings as SettingsIcon, LogOut, Moon, Sun, Eye, EyeOff, Edit, Edit3, Smartphone, XCircle, QrCode, Trash2 } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { auth, db } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { doc, getDoc, updateDoc, setDoc, onSnapshot, collection, query, where, getDocs } from "firebase/firestore";
import { useFriendRequests } from "@/hooks/useFriendRequests";
import { UserPlus, Check, X } from "lucide-react";
import { Scanner } from "@yudiel/react-qr-scanner";
import { hashString, generateRecoveryKey } from "@/lib/crypto";
import { useLanguage } from "@/context/LanguageContext";

export default function Inbox() {
  const { t, language } = useLanguage();
  const { user, loading } = useAuth();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [showSettings, setShowSettings] = useState(false);
  const [isStealthMode, setIsStealthMode] = useState(false);
  const [devices, setDevices] = useState<any[]>([]);
  const [initialDevicesCount, setInitialDevicesCount] = useState(-1);
  const [username, setUsername] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scanStatus, setScanStatus] = useState<"IDLE" | "SUCCESS" | "ERROR">("IDLE");
  const [deviceToRemove, setDeviceToRemove] = useState<any>(null);
  
  // Password Change States
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordChangeError, setPasswordChangeError] = useState("");
  const [newRecoveryKey, setNewRecoveryKey] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Friend Request States
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [addMethod, setAddMethod] = useState<'phone' | 'alias'>('phone');
  const [phoneDigits, setPhoneDigits] = useState<string[]>(Array(9).fill(''));
  const [addFriendAlias, setAddFriendAlias] = useState("");
  const [addFriendError, setAddFriendError] = useState("");
  const [addFriendSuccess, setAddFriendSuccess] = useState("");
  const [contacts, setContacts] = useState<any[]>([]);
  
  const { pendingRequests, sendRequest, acceptRequest, rejectRequest } = useFriendRequests();
  const currentDeviceId = typeof window !== 'undefined' ? localStorage.getItem('pop-device-id') : null;

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission();
      }
    }
    
    if (!loading && !user) {
      router.push("/login");
    }
    const savedStealth = localStorage.getItem('hidechat-stealth-mode');
    if (savedStealth === 'true') {
      setIsStealthMode(true);
    }

    if (user && showSettings) {
      // Fetch username (devices are handled by the real-time listener)
      getDoc(doc(db, "users", user.uid)).then((docSnap) => {
        if (docSnap.exists()) {
          setUsername(docSnap.data().username || "");
        }
      });
    }

    if (user) {
      const unsubscribe = onSnapshot(doc(db, "users", user.uid), async (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          
          // Handle devices & security alerts
          const currentDevices = data.devices || [];
          setDevices(currentDevices);
          
          setInitialDevicesCount((prev) => {
            if (prev === -1) {
              return currentDevices.length;
            } else if (currentDevices.length > prev) {
              // A new device was added!
              const newDev = currentDevices[currentDevices.length - 1];
              const isObj = typeof newDev === 'object' && newDev !== null;
              const devId = isObj ? newDev.id : newDev;
              const loc = isObj ? newDev.location : 'Unknown location';
              
              if (devId !== currentDeviceId) {
                const title = "Security Alert";
                const body = `A new device just signed in to your account from ${loc}.`;
                
                if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
                  new Notification(title, { body });
                } else {
                  alert(`${title}: ${body}`);
                }
              }
              return currentDevices.length;
            }
            return prev;
          });

          // Handle contacts
          const contactUids = data.contacts || [];
          
          const fetchedContacts = [];
          for (const cUid of contactUids) {
            const cDoc = await getDoc(doc(db, "users", cUid));
            if (cDoc.exists()) {
              fetchedContacts.push({ uid: cUid, ...cDoc.data() });
            }
          }
          setContacts(fetchedContacts);
        }
      });
      return () => unsubscribe();
    }
  }, [user, loading, router, showSettings]);

  const handleRemoveDevice = async (deviceOrId: any) => {
    if (!user) return;
    const isObject = typeof deviceOrId === 'object' && deviceOrId !== null;
    const targetId = isObject ? deviceOrId.id : deviceOrId;
    
    // We must filter using deep comparison or by ID if they are objects
    const newDevices = devices.filter(d => {
      const dId = (typeof d === 'object' && d !== null) ? d.id : d;
      return dId !== targetId;
    });
    
    await updateDoc(doc(db, "users", user.uid), {
      devices: newDevices
    });
    setDevices(newDevices);
    
    if (targetId === currentDeviceId) {
      handleLogout();
    }
  };

  const handleSetStealthMode = (value: boolean) => {
    setIsStealthMode(value);
    localStorage.setItem('popchat-stealth-mode', value.toString());
  };

  const handleSaveUsername = async () => {
    if (!user) return;
    setUsernameError("");
    
    if (username.trim().length > 0) {
      const q = query(
        collection(db, "users"),
        where("username", "==", username.trim())
      );
      const snapshot = await getDocs(q);
      
      const takenBySomeoneElse = snapshot.docs.some(d => d.id !== user.uid);
      
      if (takenBySomeoneElse) {
        setUsernameError(t('usernameTaken'));
        return;
      }
    }

    await updateDoc(doc(db, "users", user.uid), {
      username: username.trim()
    });
    setIsEditingUsername(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordChangeError("");
    
    if (newPassword !== confirmPassword) {
      setPasswordChangeError("New passwords do not match.");
      return;
    }
    
    if (newPassword.length < 6) {
      setPasswordChangeError("New password must be at least 6 characters.");
      return;
    }
  
    if (!user) return;
  
    try {
      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return;
      
      const data = docSnap.data();
      const currentHash = await hashString(currentPassword);
      
      if (data.passwordHash !== currentHash) {
        setPasswordChangeError("Incorrect current password.");
        return;
      }
      
      const newHash = await hashString(newPassword);
      const newKey = generateRecoveryKey();
      const newKeyHash = await hashString(newKey);
      
      await updateDoc(docRef, {
        passwordHash: newHash,
        recoveryKeyHash: newKeyHash
      });
      
      setNewRecoveryKey(newKey);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error(error);
      setPasswordChangeError("Failed to change password.");
    }
  };

  const handleScanQR = async (detectedCodes: any[]) => {
    if (detectedCodes.length > 0 && scanStatus === "IDLE") {
      const qrValue = detectedCodes[0].rawValue;
      if (qrValue) {
        setScanStatus("SUCCESS");
        try {
          const idToken = await user?.getIdToken();
          console.log("Sending QR Value:", qrValue, "with idToken");
          const res = await fetch('/api/auth/qr-sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ qrValue, idToken })
          });
          
          const responseData = await res.json();
          console.log("QR Sync API Response:", responseData);
          
          if (!res.ok) throw new Error(responseData.error || 'API Error');
          
          setTimeout(() => {
            setShowScanner(false);
            setScanStatus("IDLE");
          }, 2000);
        } catch (error) {
          console.error("Error syncing via QR API", error);
          setScanStatus("ERROR");
          setTimeout(() => setScanStatus("IDLE"), 2000);
        }
      }
    }
  };

  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddFriendError("");
    setAddFriendSuccess("");
    
    let targetPhone = "";
    if (addMethod === 'phone') {
      const fullNumber = phoneDigits.join("");
      if (fullNumber.length !== 9) {
        setAddFriendError("Please complete the 9-digit phone number.");
        return;
      }
      targetPhone = `+593${fullNumber}`;
    } else {
      targetPhone = addFriendAlias;
      if (!targetPhone) return;
    }
    
    try {
      await sendRequest(targetPhone, user?.phoneNumber || "", username || undefined);
      setAddFriendSuccess("Friend request sent!");
      setPhoneDigits(Array(9).fill(''));
      setAddFriendAlias("");
    } catch (err: any) {
      setAddFriendError(err.message);
    }
  };

  const handleLogout = async () => {
    if (user && currentDeviceId) {
      try {
        const newDevices = devices.filter(d => {
          const dId = (typeof d === 'object' && d !== null) ? d.id : d;
          return dId !== currentDeviceId;
        });
        await updateDoc(doc(db, "users", user.uid), { devices: newDevices });
      } catch (e) {
        console.error(e);
      }
    }
    await signOut(auth);
    router.push("/login");
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="text-gray-500 dark:text-gray-400 font-bold">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen retro-bg dark:!bg-[#1a1a1a] dark:!bg-none flex flex-col">
      <header className="retro-nav px-3 py-2 flex justify-between items-center sticky top-0 z-10 shadow-md">
        <button 
          onClick={() => setShowSettings(true)}
          className="retro-btn px-3 py-1 text-white font-bold text-sm shadow-sm active:opacity-70 transition-opacity flex items-center"
        >
          Edit
        </button>
        <h1 className="text-white font-bold text-lg text-shadow-sm">Messages</h1>
        <button 
          onClick={() => setShowAddFriend(true)}
          className="retro-btn p-1.5 text-white font-bold text-sm shadow-sm active:opacity-70 transition-opacity flex items-center justify-center"
        >
          <UserPlus className="w-5 h-5" />
        </button>
      </header>
      
      {pendingRequests.length > 0 && (
        <div className="p-3 bg-blue-50 dark:bg-[#1e2a3a] border-b border-blue-200 dark:border-[#2d4c75]">
          <h3 className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wider mb-2">{t('friendRequests')}</h3>
          <div className="space-y-2">
            {pendingRequests.map(req => (
              <div key={req.id} className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-sm border border-gray-200 dark:border-[#333] p-3 flex justify-between items-center">
                <div>
                  <div className="font-bold text-sm text-gray-800 dark:text-gray-200">{req.fromUsername || req.fromPhone}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Wants to add you</div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => acceptRequest(req.id, req.fromId)}
                    className="p-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full hover:bg-green-200 dark:hover:bg-green-900/50 active:bg-green-300"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => rejectRequest(req.id)}
                    className="p-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full hover:bg-red-200 dark:hover:bg-red-900/50 active:bg-red-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col contacts-bg dark:!bg-[#121212] shadow-inner">
        {contacts.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400 font-bold bg-white/90 dark:bg-[#1e1e1e]/90 backdrop-blur-sm border-b border-gray-200 dark:border-[#333] shadow-sm relative z-10">
            {t('noContacts')}
          </div>
        ) : (
          contacts.map((contact) => {
            const conversationId = [user.uid, contact.uid].sort().join("_");
            return (
              <Link 
                key={contact.uid}
                href={`/chat/${conversationId}`}
                className="flex items-center px-4 py-3 border-b border-gray-200 dark:border-[#333] bg-white dark:bg-[#1e1e1e] hover:bg-gray-100 dark:hover:bg-[#2a2a2a] active:bg-[#4b77ad] active:text-white transition-colors group"
              >
                <div className="flex-1 min-w-0 pr-2">
                  <div className="flex justify-between items-center mb-1">
                    <h2 className="font-bold text-[18px] text-black dark:text-white group-active:text-white truncate">
                      {contact.username || contact.phoneNumber}
                    </h2>
                    <ChevronRight className="w-5 h-5 text-gray-400 dark:text-gray-600 group-active:text-white opacity-80" />
                  </div>
                  <p className="text-[14px] text-gray-500 dark:text-gray-400 group-active:text-white truncate">
                    {t('tapToViewConversation')}
                  </p>
                </div>
              </Link>
            )
          })
        )}
      </div>

      {/* Add Friend Full Screen Panel */}
      {showAddFriend && (
        <div className="fixed inset-0 z-50 flex flex-col retro-bg dark:bg-[#121212]">
          <div className="retro-nav px-4 py-3 flex items-center justify-between shadow-md shrink-0">
            <h2 className="text-white font-bold text-lg text-shadow-sm">{t('addFriend')}</h2>
            <button onClick={() => {setShowAddFriend(false); setAddFriendError(""); setAddFriendSuccess(""); setAddFriendAlias("");}} className="retro-btn px-3 py-1 text-white text-sm font-bold">{t('close')}</button>
          </div>
          
          <div className="flex-1 overflow-hidden pb-2 sm:pb-6">
            <div className="w-full sm:max-w-md sm:mx-auto sm:mt-6 bg-white dark:bg-[#1e1e1e] sm:border sm:border-gray-300 dark:sm:border-[#333] sm:rounded-xl shadow-md overflow-hidden flex flex-col min-h-[calc(100vh-50px)] sm:min-h-0">
              {/* Toggle Switch */}
              <div className="p-3 bg-gray-100 dark:bg-[#2a2a2a] border-b border-gray-300 dark:border-[#333] flex justify-center shrink-0">
                <div className="retro-segmented-control w-full sm:max-w-sm">
                  <button 
                    onClick={() => setAddMethod('phone')}
                    className={`retro-segmented-btn ${addMethod === 'phone' ? 'retro-segmented-btn-active' : ''}`}
                  >
                    {t('phoneNumber')}
                  </button>
                  <button 
                    onClick={() => setAddMethod('alias')}
                    className={`retro-segmented-btn ${addMethod === 'alias' ? 'retro-segmented-btn-active' : ''}`}
                  >
                    {t('alias')}
                  </button>
                </div>
              </div>

              {/* Content Container */}
              <div className="p-4 sm:p-5 text-black dark:text-white shrink-0">
                {addMethod === 'phone' ? (
                  <div>
                    <p className="text-sm font-bold text-gray-600 dark:text-gray-400 mb-4 text-center">{t('enterPhoneToAdd')}</p>
                    <form onSubmit={handleAddFriend} className="space-y-4">
                      
                      <div className="flex flex-col gap-3 my-5 max-w-sm mx-auto">
                        <div className="flex items-center justify-center gap-1 sm:gap-2">
                          {/* 2 digits */}
                          <div className="flex gap-1 justify-center">
                            {[0, 1].map((i) => (
                              <input key={i} id={`phone-digit-${i}`} type="tel" maxLength={1}
                                value={phoneDigits[i]}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/\D/g, '').slice(-1);
                                  const newDigits = [...phoneDigits];
                                  newDigits[i] = val;
                                  setPhoneDigits(newDigits);
                                  if (val && i < 8) document.getElementById(`phone-digit-${i + 1}`)?.focus();
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Backspace' && !phoneDigits[i] && i > 0) document.getElementById(`phone-digit-${i - 1}`)?.focus();
                                }}
                                className="w-7 sm:w-10 h-10 sm:h-12 text-center text-lg sm:text-xl font-bold bg-gray-50 dark:bg-[#2a2a2a] border border-gray-400 dark:border-[#444] rounded-md retro-input-field focus:border-blue-500 focus:outline-none" />
                            ))}
                          </div>
                          <div className="text-gray-500 font-bold shrink-0">-</div>
                          
                          {/* 3 digits */}
                          <div className="flex gap-1 justify-center">
                            {[2, 3, 4].map((i) => (
                              <input key={i} id={`phone-digit-${i}`} type="tel" maxLength={1}
                                value={phoneDigits[i]}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/\D/g, '').slice(-1);
                                  const newDigits = [...phoneDigits];
                                  newDigits[i] = val;
                                  setPhoneDigits(newDigits);
                                  if (val && i < 8) document.getElementById(`phone-digit-${i + 1}`)?.focus();
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Backspace' && !phoneDigits[i] && i > 0) document.getElementById(`phone-digit-${i - 1}`)?.focus();
                                }}
                                className="w-7 sm:w-10 h-10 sm:h-12 text-center text-lg sm:text-xl font-bold bg-gray-50 dark:bg-[#2a2a2a] border border-gray-400 dark:border-[#444] rounded-md retro-input-field focus:border-blue-500 focus:outline-none" />
                            ))}
                          </div>
                          <div className="text-gray-500 font-bold shrink-0">-</div>
                          
                          {/* 4 digits */}
                          <div className="flex gap-1 justify-center">
                            {[5, 6, 7, 8].map((i) => (
                              <input key={i} id={`phone-digit-${i}`} type="tel" maxLength={1}
                                value={phoneDigits[i]}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/\D/g, '').slice(-1);
                                  const newDigits = [...phoneDigits];
                                  newDigits[i] = val;
                                  setPhoneDigits(newDigits);
                                  if (val && i < 8) document.getElementById(`phone-digit-${i + 1}`)?.focus();
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Backspace' && !phoneDigits[i] && i > 0) document.getElementById(`phone-digit-${i - 1}`)?.focus();
                                }}
                                className="w-7 sm:w-10 h-10 sm:h-12 text-center text-lg sm:text-xl font-bold bg-gray-50 dark:bg-[#2a2a2a] border border-gray-400 dark:border-[#444] rounded-md retro-input-field focus:border-blue-500 focus:outline-none" />
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      {addFriendError && <p className="text-red-500 text-xs font-bold text-center">{addFriendError}</p>}
                      {addFriendSuccess && <p className="text-green-500 text-xs font-bold text-center">{addFriendSuccess}</p>}
                      
                      <button type="submit" className="w-full retro-btn text-white font-bold py-3 sm:py-2 rounded-md shadow-sm active:opacity-70 flex justify-center items-center text-base">
                        {t('sendRequest')}
                      </button>
                    </form>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-bold text-gray-600 dark:text-gray-400 mb-4 text-center">{t('enterAliasToAdd')}</p>
                    <form onSubmit={handleAddFriend} className="space-y-4">
                      <input
                        type="text"
                        placeholder="Enter Alias (e.g. usuario_123)"
                        value={addFriendAlias}
                        onChange={(e) => setAddFriendAlias(e.target.value)}
                        className="w-full bg-gray-50 dark:bg-[#2a2a2a] border border-gray-300 dark:border-[#444] rounded-md px-3 py-3 font-bold outline-none focus:border-blue-500 retro-input-field dark:text-white"
                      />
                      
                      <button type="submit" className="w-full retro-btn text-white font-bold py-3 sm:py-2 rounded-md shadow-sm active:opacity-70 flex justify-center items-center text-base">
                        {t('sendRequest')}
                      </button>
                    </form>
                  </div>
                )}
              </div>

              {/* Informational Text (Merged into the same container) */}
              <div className="flex-1 bg-gray-50 dark:bg-[#252525] border-t border-gray-200 dark:border-[#333] p-5 sm:p-6 text-gray-800 dark:text-gray-300">
                <h3 className="text-base font-bold mb-4 text-center text-gray-900 dark:text-white border-b border-gray-300 dark:border-[#444] pb-2">Pop Chat (Private Open Protocol)</h3>
                
                {addMethod === 'phone' ? (
                  <div className="space-y-4">
                    <p className="text-sm font-medium text-justify leading-relaxed">
                      {t('addContactByPhone')}
                    </p>
                    <p className="text-sm font-medium text-justify leading-relaxed">
                      {t('addContactByPhone2')}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm font-medium text-justify leading-relaxed">
                      {t('addContactByAlias')}
                    </p>
                    <p className="text-sm font-medium text-justify leading-relaxed">
                      {t('addContactByAlias2')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal (Retro Style) */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
          <div className="bg-[#cbd5e1] dark:bg-[#1a1a1a] sm:border sm:border-[#86a7cc] dark:sm:border-[#333] w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-md sm:rounded-xl overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="retro-nav px-4 py-3 flex items-center justify-between shrink-0">
              <h2 className="text-white font-bold text-lg text-shadow-sm">{t('settings')}</h2>
              <button onClick={() => setShowSettings(false)} className="retro-btn px-3 py-1 text-white text-sm font-bold">{t('done')}</button>
            </div>
            
            <div className="flex-1 p-4 space-y-4 text-black dark:text-white overflow-y-auto pb-6">
              {/* Profile Section */}
              <div className="bg-white dark:bg-[#1e1e1e] rounded-lg border border-gray-300 dark:border-[#333] overflow-hidden p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('profile')}</span>
                  {!isEditingUsername ? (
                    <button onClick={() => setIsEditingUsername(true)} className="text-[#4b77ad] font-bold text-sm">{t('edit')}</button>
                  ) : (
                    <button onClick={handleSaveUsername} className="text-[#4b77ad] font-bold text-sm">{t('save')}</button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 dark:text-gray-400 font-bold text-sm w-20">{t('username')}</span>
                  {isEditingUsername ? (
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Your name"
                      className="flex-1 bg-gray-100 dark:bg-[#2a2a2a] border border-gray-300 dark:border-[#444] rounded px-2 py-1 text-sm font-bold outline-none dark:text-white"
                    />
                  ) : (
                    <span className="flex-1 text-black dark:text-white font-bold truncate">
                      {username || t('setAUsername')}
                    </span>
                  )}
                </div>
                {usernameError && (
                  <div className="mt-2 text-xs text-red-500 font-bold">
                    {usernameError}
                  </div>
                )}
              </div>

              <div className="bg-white dark:bg-[#1e1e1e] rounded-lg border border-gray-300 dark:border-[#333] overflow-hidden">
                <div
                  onClick={() => handleSetStealthMode(!isStealthMode)}
                  className="w-full flex items-center justify-between px-4 py-3 active:bg-gray-100 dark:active:bg-[#2a2a2a] cursor-pointer"
                >
                  <span className="flex items-center gap-2 font-bold">
                    {isStealthMode ? <Eye className="w-5 h-5"/> : <EyeOff className="w-5 h-5"/>} 
                    {t('stealthMode')}
                  </span>
                  <div className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-300 shadow-inner border ${isStealthMode ? 'bg-[#4b77ad] border-[#2d4c75]' : 'bg-gray-300 border-gray-400 dark:bg-gray-600 dark:border-gray-500'}`}>
                    <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform duration-300 ${isStealthMode ? 'translate-x-6' : ''}`} />
                  </div>
                </div>
              </div>

              {/* Security / Password Section */}
              <div className="bg-white dark:bg-[#1e1e1e] rounded-lg border border-gray-300 dark:border-[#333] overflow-hidden">
                <div className="bg-gray-100 dark:bg-[#2a2a2a] px-4 py-1 border-b border-gray-300 dark:border-[#444]">
                  <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('security')}</span>
                </div>
                <div className="p-4">
                  {!isChangingPassword && !newRecoveryKey ? (
                    <button 
                      onClick={() => setIsChangingPassword(true)}
                      className="text-[#4b77ad] font-bold text-sm w-full text-left active:opacity-50"
                    >
                      {t('changePassword')}
                    </button>
                  ) : newRecoveryKey ? (
                    <div className="text-center animate-in fade-in zoom-in duration-300">
                      <h4 className="font-bold text-green-600 mb-2">{t('passwordChanged')}</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 leading-tight">{t('newRecoveryKeyMsg')}</p>
                      <div className="bg-gray-100 dark:bg-[#2a2a2a] p-3 rounded-lg border border-gray-300 dark:border-[#444] mb-3 select-all">
                        <span className="font-mono text-lg text-black dark:text-white font-bold">{newRecoveryKey}</span>
                      </div>
                      <button 
                        onClick={() => {
                          setNewRecoveryKey("");
                          setIsChangingPassword(false);
                        }}
                        className="retro-btn px-4 py-2 w-full text-white font-bold text-sm"
                      >
                        {t('iHaveSavedIt')}
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleChangePassword} className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{t('toChangePassword')}</p>
                      {passwordChangeError && <p className="text-red-500 text-xs font-bold">{passwordChangeError}</p>}
                      <div className="relative">
                        <input 
                          type={showCurrentPassword ? "text" : "password"}
                          placeholder={t('currentPassword')}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className="w-full px-3 py-2 pr-10 bg-gray-100 dark:bg-[#2a2a2a] border border-gray-300 dark:border-[#444] rounded-lg text-sm focus:ring-2 focus:ring-[#4b77ad] outline-none"
                          required
                        />
                        <button 
                          type="button"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                          {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <div className="relative">
                        <input 
                          type={showNewPassword ? "text" : "password"}
                          placeholder={t('newPassword')}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full px-3 py-2 pr-10 bg-gray-100 dark:bg-[#2a2a2a] border border-gray-300 dark:border-[#444] rounded-lg text-sm focus:ring-2 focus:ring-[#4b77ad] outline-none"
                          required
                        />
                        <button 
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                          {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <div className="relative">
                        <input 
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder={t('confirmPassword')}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full px-3 py-2 pr-10 bg-gray-100 dark:bg-[#2a2a2a] border border-gray-300 dark:border-[#444] rounded-lg text-sm focus:ring-2 focus:ring-[#4b77ad] outline-none"
                          required
                        />
                        <button 
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                          {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <button 
                          type="button"
                          onClick={() => {
                            setIsChangingPassword(false);
                            setPasswordChangeError("");
                            setCurrentPassword("");
                            setNewPassword("");
                            setConfirmPassword("");
                            setShowCurrentPassword(false);
                            setShowNewPassword(false);
                            setShowConfirmPassword(false);
                          }}
                          className="flex-1 py-2 bg-gray-200 dark:bg-[#333] border border-gray-300 dark:border-[#555] text-gray-800 dark:text-white font-bold text-sm rounded-lg active:bg-gray-300 dark:active:bg-[#444]"
                        >
                          {t('cancel')}
                        </button>
                        <button 
                          type="submit"
                          className="flex-1 py-2 bg-[#4b77ad] text-white font-bold text-sm rounded-lg shadow-md active:bg-[#3a5c88]"
                        >
                          {t('update')}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>

              {/* Active Sessions */}
              <div className="bg-white dark:bg-[#1e1e1e] rounded-lg border border-gray-300 dark:border-[#333] overflow-hidden">
                <div className="bg-gray-100 dark:bg-[#2a2a2a] px-4 py-1 border-b border-gray-300 dark:border-[#444]">
                  <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('activeSessions')}</span>
                </div>
                {(() => {
                  const deduped = [];
                  const seen = new Set();
                  for (let i = devices.length - 1; i >= 0; i--) {
                    const d = devices[i];
                    const dId = (typeof d === 'object' && d !== null) ? d.id : d;
                    if (!seen.has(dId)) {
                      seen.add(dId);
                      deduped.unshift(d);
                    }
                  }
                  return deduped;
                })().map((device, idx) => {
                  const isObject = typeof device === 'object' && device !== null;
                  const devId = isObject ? device.id : device;
                  const devName = isObject ? device.name : "Linked Device";
                  const devLoc = isObject ? device.location : "";

                  return (
                  <div key={idx} className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-[#333]">
                    <div className="flex items-center gap-3">
                      <Smartphone className="w-5 h-5 text-gray-400" />
                      <div className="flex flex-col">
                        <span className="font-bold text-sm">
                          {devId === currentDeviceId ? t('thisDevice') : devName}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                          {isObject && devLoc ? devLoc : devId}
                        </span>
                      </div>
                    </div>
                    {devId !== currentDeviceId && (
                      <button 
                        onClick={() => setDeviceToRemove(device)}
                        className="p-1 active:opacity-50"
                      >
                        <Trash2 className="w-5 h-5 text-red-500" />
                      </button>
                    )}
                  </div>
                )})}
                
                <button
                  onClick={() => setShowScanner(true)}
                  className="w-full flex items-center justify-between px-4 py-3 active:bg-gray-100 dark:active:bg-[#2a2a2a]"
                >
                  <span className="flex items-center gap-2 font-bold"><QrCode className="w-5 h-5 text-[#4b77ad]"/> {t('syncNewDevice')}</span>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>

            {/* Fixed Bottom Sign Out Button */}
            <div className="p-4 bg-[#cbd5e1] dark:bg-[#1a1a1a] border-t border-[#86a7cc] dark:border-[#333] shrink-0">
               <button onClick={handleLogout} className="retro-btn w-full py-2 text-white font-bold text-lg flex items-center justify-center gap-2">
                 <LogOut className="w-5 h-5" /> {t('logOut')}
               </button>
            </div>
          </div>
        </div>
      )}
      {/* Scanner Modal (Retro Style) */}
      {showScanner && (
        <div className="fixed inset-0 z-50 flex flex-col retro-bg dark:bg-[#121212]">
          <div className="retro-nav px-4 py-3 flex items-center justify-between shadow-md shrink-0">
            <h2 className="text-white font-bold text-lg text-shadow-sm">{t('scanQrToSync')}</h2>
            <button onClick={() => { setShowScanner(false); setScanStatus("IDLE"); }} className="retro-btn px-3 py-1 text-white text-sm font-bold">{t('cancel')}</button>
          </div>
          
          <div className="flex-1 flex flex-col items-center justify-center p-4 bg-black">
            <div className="w-full max-w-sm overflow-hidden rounded-xl border-2 border-white shadow-2xl relative">
              <Scanner 
                onScan={handleScanQR}
                sound={false}
                components={{
                  finder: true,
                }}
              />
              {scanStatus === "SUCCESS" && (
                <div className="absolute inset-0 bg-[#4b77ad]/80 backdrop-blur-sm flex flex-col items-center justify-center z-10 animate-in fade-in duration-300">
                  <Check className="w-16 h-16 text-white mb-2" />
                  <p className="text-white font-bold text-xl drop-shadow-md">{t('deviceSynced')}</p>
                </div>
              )}
            </div>
            
            <p className="text-gray-300 font-bold text-sm text-center mt-6 max-w-xs">
              {t('pointCameraAtQr')}
            </p>
          </div>
        </div>
      )}

      {/* Remove Device Confirmation Modal */}
      {deviceToRemove && (
        <div className="fixed inset-0 z-50 flex flex-col retro-bg dark:bg-[#121212] animate-in slide-in-from-bottom-4 duration-300">
          {/* Top Nav */}
          <div className="retro-nav px-4 py-3 flex items-center justify-between shadow-md shrink-0">
            <h2 className="text-white font-bold text-lg text-shadow-sm">{t('removeSession')}</h2>
            <button 
              onClick={() => setDeviceToRemove(null)} 
              className="retro-btn px-3 py-1 text-white text-sm font-bold"
            >
              {t('cancel')}
            </button>
          </div>
          
          {/* Main Content Area */}
          <div className="flex-1 p-6 flex flex-col items-center justify-center text-center">
            <div className="w-24 h-24 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6 shadow-inner border-4 border-red-200 dark:border-red-800">
              <Trash2 className="w-12 h-12 text-red-600 dark:text-red-500" />
            </div>
            <h3 className="text-2xl font-bold text-[#1e293b] dark:text-gray-100 mb-4">{t('disconnectDevice')}</h3>
            <p className="text-[#334155] dark:text-gray-300 text-lg max-w-xs leading-relaxed">
              {t('removeDeviceDesc')}
            </p>
          </div>
          
          {/* Fixed Bottom Confirm Button */}
          <div className="p-4 bg-[#cbd5e1] dark:bg-[#1a1a1a] border-t border-[#86a7cc] dark:border-[#333] shrink-0">
            <button 
              onClick={() => {
                handleRemoveDevice(deviceToRemove);
                setDeviceToRemove(null);
              }} 
              className="retro-btn w-full py-3 text-white font-bold text-lg flex items-center justify-center gap-2"
            >
              <Trash2 className="w-5 h-5" /> {t('confirmRemoval')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
