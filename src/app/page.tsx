"use client";

import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Settings as SettingsIcon, LogOut, Moon, Sun, Eye, EyeOff, Edit, Edit3, Smartphone, XCircle } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { auth, db } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { doc, getDoc, updateDoc, onSnapshot } from "firebase/firestore";
import { useFriendRequests } from "@/hooks/useFriendRequests";
import { UserPlus, Check, X } from "lucide-react";

export default function Inbox() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [showSettings, setShowSettings] = useState(false);
  const [isStealthMode, setIsStealthMode] = useState(false);
  const [devices, setDevices] = useState<string[]>([]);
  const [username, setUsername] = useState("");
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  
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
    if (!loading && !user) {
      router.push("/login");
    }
    const savedStealth = localStorage.getItem('hidechat-stealth-mode');
    if (savedStealth === 'true') {
      setIsStealthMode(true);
    }

    if (user && showSettings) {
      // Fetch user data
      getDoc(doc(db, "users", user.uid)).then((docSnap) => {
        if (docSnap.exists()) {
          setDevices(docSnap.data().devices || []);
          setUsername(docSnap.data().username || "");
        }
      });
    }

    if (user) {
      const unsubscribe = onSnapshot(doc(db, "users", user.uid), async (docSnap) => {
        if (docSnap.exists()) {
          const contactUids = docSnap.data().contacts || [];
          
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

  const handleRemoveDevice = async (deviceId: string) => {
    if (!user) return;
    const newDevices = devices.filter(d => d !== deviceId);
    await updateDoc(doc(db, "users", user.uid), {
      devices: newDevices
    });
    setDevices(newDevices);
    if (deviceId === currentDeviceId) {
      handleLogout();
    }
  };

  const handleSetStealthMode = (value: boolean) => {
    setIsStealthMode(value);
    localStorage.setItem('popchat-stealth-mode', value.toString());
  };

  const handleSaveUsername = async () => {
    if (!user) return;
    await updateDoc(doc(db, "users", user.uid), {
      username: username
    });
    setIsEditingUsername(false);
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
      await sendRequest(targetPhone, user?.phoneNumber || "");
      setAddFriendSuccess("Friend request sent!");
      setPhoneDigits(Array(9).fill(''));
      setAddFriendAlias("");
    } catch (err: any) {
      setAddFriendError(err.message);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="text-gray-500 dark:text-gray-400 font-bold">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen retro-bg">
      <header className="retro-nav px-3 py-2 flex justify-between items-center sticky top-0 z-10 shadow-md">
        <button 
          onClick={() => setShowSettings(true)}
          className="retro-btn px-3 py-1 text-white font-bold text-sm shadow-sm active:opacity-70 transition-opacity flex items-center"
        >
          Edit
        </button>
        <h1 className="text-xl font-bold text-white drop-shadow-md text-shadow-sm">Messages</h1>
        <button 
          onClick={() => setShowAddFriend(true)}
          className="retro-btn p-1.5 text-white font-bold text-sm shadow-sm active:opacity-70 transition-opacity flex items-center justify-center"
        >
          <UserPlus className="w-5 h-5" />
        </button>
      </header>
      
      {pendingRequests.length > 0 && (
        <div className="p-3 bg-blue-50 border-b border-blue-200">
          <h3 className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-2">Friend Requests</h3>
          <div className="space-y-2">
            {pendingRequests.map(req => (
              <div key={req.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 flex justify-between items-center">
                <div>
                  <div className="font-bold text-sm text-gray-800">{req.fromPhone}</div>
                  <div className="text-xs text-gray-500">Wants to add you</div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => acceptRequest(req.id, req.fromId)}
                    className="p-2 bg-green-100 text-green-700 rounded-full hover:bg-green-200 active:bg-green-300"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => rejectRequest(req.id)}
                    className="p-2 bg-red-100 text-red-700 rounded-full hover:bg-red-200 active:bg-red-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col border-b border-gray-400 bg-white">
        {contacts.length === 0 ? (
          <div className="p-8 text-center text-gray-500 font-bold">
            No contacts yet. Tap the + icon to add a friend.
          </div>
        ) : (
          contacts.map((contact) => {
            const conversationId = [user.uid, contact.uid].sort().join("_");
            return (
              <Link 
                key={contact.uid}
                href={`/chat/${conversationId}`}
                className="flex items-center px-4 py-3 border-b border-gray-200 hover:bg-gray-200 active:bg-blue-500 active:text-white transition-colors group"
              >
                <div className="flex-1 min-w-0 pr-2">
                  <div className="flex justify-between items-center mb-1">
                    <h2 className="font-bold text-[18px] text-black group-active:text-white truncate">
                      {contact.username || contact.phoneNumber}
                    </h2>
                    <ChevronRight className="w-5 h-5 text-gray-400 group-active:text-white opacity-80" />
                  </div>
                  <p className="text-[14px] text-gray-500 group-active:text-white truncate">
                    Tap to view conversation...
                  </p>
                </div>
              </Link>
            )
          })
        )}
      </div>

      {/* Add Friend Full Screen Panel */}
      {showAddFriend && (
        <div className="fixed inset-0 z-50 flex flex-col retro-bg">
          <div className="retro-nav px-4 py-3 flex items-center justify-between shadow-md shrink-0">
            <h2 className="text-white font-bold text-lg text-shadow-sm">Add Friend</h2>
            <button onClick={() => {setShowAddFriend(false); setAddFriendError(""); setAddFriendSuccess(""); setAddFriendAlias("");}} className="retro-btn px-3 py-1 text-white text-sm font-bold">Close</button>
          </div>
          
          <div className="flex-1 overflow-y-auto pb-6">
            <div className="w-full sm:max-w-md sm:mx-auto sm:mt-6 bg-white sm:border sm:border-gray-300 sm:rounded-xl shadow-md overflow-hidden flex flex-col min-h-[calc(100vh-50px)] sm:min-h-0">
              {/* Toggle Switch */}
              <div className="p-3 bg-gray-100 border-b border-gray-300 flex justify-center shrink-0">
                <div className="retro-segmented-control w-full sm:max-w-sm">
                  <button 
                    onClick={() => setAddMethod('phone')}
                    className={`retro-segmented-btn ${addMethod === 'phone' ? 'retro-segmented-btn-active' : ''}`}
                  >
                    By Phone
                  </button>
                  <button 
                    onClick={() => setAddMethod('alias')}
                    className={`retro-segmented-btn ${addMethod === 'alias' ? 'retro-segmented-btn-active' : ''}`}
                  >
                    By Alias
                  </button>
                </div>
              </div>

              {/* Content Container */}
              <div className="p-4 sm:p-5 text-black shrink-0">
                {addMethod === 'phone' ? (
                  <div>
                    <p className="text-sm font-bold text-gray-600 mb-4 text-center">Enter a phone number to send a friend request.</p>
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
                                className="w-7 sm:w-10 h-10 sm:h-12 text-center text-lg sm:text-xl font-bold bg-gray-50 border border-gray-400 rounded-md retro-input-field focus:border-blue-500 focus:outline-none" />
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
                                className="w-7 sm:w-10 h-10 sm:h-12 text-center text-lg sm:text-xl font-bold bg-gray-50 border border-gray-400 rounded-md retro-input-field focus:border-blue-500 focus:outline-none" />
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
                                className="w-7 sm:w-10 h-10 sm:h-12 text-center text-lg sm:text-xl font-bold bg-gray-50 border border-gray-400 rounded-md retro-input-field focus:border-blue-500 focus:outline-none" />
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      {addFriendError && <p className="text-red-500 text-xs font-bold text-center">{addFriendError}</p>}
                      {addFriendSuccess && <p className="text-green-500 text-xs font-bold text-center">{addFriendSuccess}</p>}
                      
                      <button type="submit" className="w-full retro-btn text-white font-bold py-3 sm:py-2 rounded-md shadow-sm active:opacity-70 flex justify-center items-center text-base">
                        Send Request
                      </button>
                    </form>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-bold text-gray-600 mb-4 text-center">Add a friend using their unique Pop Chat alias.</p>
                    <form onSubmit={(e) => { e.preventDefault(); alert("Alias functionality coming soon!"); }} className="space-y-4">
                      <input
                        type="text"
                        placeholder="Enter Alias (e.g. majito_123)"
                        value={addFriendAlias}
                        onChange={(e) => setAddFriendAlias(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-300 rounded-md px-3 py-3 font-bold outline-none focus:border-blue-500 retro-input-field"
                      />
                      
                      <button type="submit" className="w-full retro-btn text-white font-bold py-3 sm:py-2 rounded-md shadow-sm active:opacity-70 flex justify-center items-center text-base">
                        Search & Add
                      </button>
                    </form>
                  </div>
                )}
              </div>

              {/* Informational Text (Merged into the same container) */}
              <div className="flex-1 bg-gray-50 border-t border-gray-200 p-5 sm:p-6 text-gray-800">
                <h3 className="text-base font-bold mb-4 text-center text-gray-900 border-b border-gray-300 pb-2">Pop Chat (Private Open Protocol)</h3>
                
                {addMethod === 'phone' ? (
                  <div className="space-y-4">
                    <p className="text-sm font-medium text-justify leading-relaxed">
                      Adding a contact by <span className="font-bold">phone number</span> ensures you connect directly with individuals already in your address book or those whose trusted contact details you currently possess. By linking through a phone number, Pop Chat utilizes a highly secure peer-to-peer encryption protocol to strictly authenticate and initiate the connection.
                    </p>
                    <p className="text-sm font-medium text-justify leading-relaxed">
                      The friend request is sent instantly and safely wrapped in our private open protocol architecture. The recipient will be notified seamlessly in their Inbox, preventing any kind of unauthorized spam or phishing attempts from unknown sources.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm font-medium text-justify leading-relaxed">
                      Adding a contact by <span className="font-bold">Alias</span> allows you to safely connect with new friends without ever having to share your personal phone number or your real-world identity. This approach guarantees 100% privacy and anonymity from the start.
                    </p>
                    <p className="text-sm font-medium text-justify leading-relaxed">
                      Engage with users globally using just a unique username. Pop Chat's open protocol securely routes the alias request directly to the intended recipient's device, ensuring that metadata is stripped away and protected against unknown sources.
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-[#cbd5e1] border border-[#86a7cc] w-11/12 max-w-sm rounded-xl overflow-hidden shadow-2xl relative">
            <div className="retro-nav px-4 py-3 flex items-center justify-between">
              <h2 className="text-white font-bold text-lg text-shadow-sm">Settings</h2>
              <button onClick={() => setShowSettings(false)} className="retro-btn px-3 py-1 text-white text-sm font-bold">Done</button>
            </div>
            
            <div className="p-4 space-y-4 text-black overflow-y-auto max-h-[80vh]">
              {/* Profile Section */}
              <div className="bg-white rounded-lg border border-gray-300 overflow-hidden p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Profile</span>
                  {!isEditingUsername ? (
                    <button onClick={() => setIsEditingUsername(true)} className="text-blue-600 font-bold text-sm">Edit</button>
                  ) : (
                    <button onClick={handleSaveUsername} className="text-green-600 font-bold text-sm">Save</button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 font-bold text-sm w-20">Username</span>
                  {isEditingUsername ? (
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Your name"
                      className="flex-1 bg-gray-100 border border-gray-300 rounded px-2 py-1 text-sm font-bold outline-none"
                    />
                  ) : (
                    <span className="flex-1 text-black font-bold truncate">
                      {username || "Set a username"}
                    </span>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-300 overflow-hidden">
                <button
                  onClick={() => toggleTheme()}
                  className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-200 active:bg-gray-100"
                >
                  <span className="flex items-center gap-2 font-bold"><Sun className="w-5 h-5"/> Theme Mode</span>
                  <span className="text-gray-500">{theme === 'light' ? 'Light' : 'Dark'}</span>
                </button>

                <button
                  onClick={() => handleSetStealthMode(!isStealthMode)}
                  className="w-full flex items-center justify-between px-4 py-3 active:bg-gray-100"
                >
                  <span className="flex items-center gap-2 font-bold">
                    {isStealthMode ? <Eye className="w-5 h-5"/> : <EyeOff className="w-5 h-5"/>} 
                    Stealth Mode
                  </span>
                  <span className={isStealthMode ? "text-blue-600 font-bold" : "text-gray-500"}>
                    {isStealthMode ? 'ON' : 'OFF'}
                  </span>
                </button>
              </div>

              {/* Active Sessions */}
              <div className="bg-white rounded-lg border border-gray-300 overflow-hidden">
                <div className="bg-gray-100 px-4 py-1 border-b border-gray-300">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Active Sessions</span>
                </div>
                {devices.map((device, idx) => (
                  <div key={idx} className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                      <Smartphone className="w-5 h-5 text-gray-400" />
                      <div className="flex flex-col">
                        <span className="font-bold text-sm">
                          {device === currentDeviceId ? "This Device" : "Linked Device"}
                        </span>
                        <span className="text-xs text-gray-500 font-mono">{device}</span>
                      </div>
                    </div>
                    {device !== currentDeviceId && (
                      <button 
                        onClick={() => handleRemoveDevice(device)}
                        className="p-1 active:opacity-50"
                      >
                        <XCircle className="w-5 h-5 text-red-500" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-lg border border-gray-300 overflow-hidden">
                 <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-between px-4 py-3 active:bg-gray-100 text-red-600 font-bold"
                >
                  <span className="flex items-center gap-2"><LogOut className="w-5 h-5"/> Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
