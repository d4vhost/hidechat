"use client";

import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Settings as SettingsIcon, LogOut, Moon, Sun, Eye, EyeOff, Edit, Edit3, Smartphone, XCircle } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { auth, db } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";

export default function Inbox() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [showSettings, setShowSettings] = useState(false);
  const [isStealthMode, setIsStealthMode] = useState(false);
  const [devices, setDevices] = useState<string[]>([]);
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
      // Fetch devices
      getDoc(doc(db, "users", user.uid)).then((docSnap) => {
        if (docSnap.exists()) {
          setDevices(docSnap.data().devices || []);
        }
      });
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
    localStorage.setItem('hidechat-stealth-mode', value.toString());
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="text-gray-500 dark:text-gray-400">Cargando...</div>
      </div>
    );
  }

  const contactName = user.uid === "HUrCHrXT4rhKTGWnQNyGufv15VJ2" ? "David" : "Majito";

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
        <button className="retro-btn p-1.5 text-white font-bold text-sm shadow-sm active:opacity-70 transition-opacity flex items-center justify-center">
          <Edit3 className="w-5 h-5" />
        </button>
      </header>

      <div className="flex flex-col mt-4 border-y border-gray-400 bg-white">
        <Link 
          href={`/chat/private_chat_1`}
          className="flex items-center px-4 py-3 hover:bg-gray-200 active:bg-blue-500 active:text-white transition-colors group"
        >
          <div className="flex-1 min-w-0 pr-2">
            <div className="flex justify-between items-center mb-1">
              <h2 className="font-bold text-[18px] text-black group-active:text-white truncate">{contactName}</h2>
              <div className="flex items-center gap-1">
                <span className="text-[14px] text-blue-600 font-semibold group-active:text-white shrink-0">
                  12:00 PM
                </span>
                <ChevronRight className="w-5 h-5 text-gray-400 group-active:text-white opacity-80" />
              </div>
            </div>
            <p className="text-[15px] text-gray-500 group-active:text-white truncate">
              Tap to view secret conversation...
            </p>
          </div>
        </Link>
      </div>

      {/* Settings Modal (Retro Style) */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-[#cbd5e1] border border-[#86a7cc] w-11/12 max-w-sm rounded-xl overflow-hidden shadow-2xl relative">
            <div className="retro-nav px-4 py-3 flex items-center justify-between">
              <h2 className="text-white font-bold text-lg text-shadow-sm">Settings</h2>
              <button onClick={() => setShowSettings(false)} className="retro-btn px-3 py-1 text-white text-sm font-bold">Done</button>
            </div>
            
            <div className="p-4 space-y-4 text-black">
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
