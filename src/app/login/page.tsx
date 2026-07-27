"use client";

import { useState, useEffect, useRef } from "react";
import { RecaptchaVerifier, signInWithPhoneNumber, signInWithCustomToken, ConfirmationResult } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, setDoc, updateDoc, arrayUnion, onSnapshot } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Key, AlertTriangle, QrCode, Eye, EyeOff } from "lucide-react";
import QRCode from "react-qr-code";
import { hashString, generateRecoveryKey, evaluatePasswordStrength } from "@/lib/crypto";
import { useLanguage } from "@/context/LanguageContext";

declare global {
  interface Window {
    recaptchaVerifier: any;
  }
}

type AuthMode = "LOGIN" | "REGISTER";
type AuthStep = "MAIN" | "OTP" | "PASSWORD_SETUP" | "SHOW_NEW_KEY" | "RECOVERY_KEY";

export default function LoginPage() {
  const { t } = useLanguage();
  const [authMode, setAuthMode] = useState<AuthMode>("LOGIN");
  const [step, setStep] = useState<AuthStep>("MAIN");
  
  // Common
  const [countryCode, setCountryCode] = useState("+593");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  
  // Login Specific
  const [loginPassword, setLoginPassword] = useState("");
  const [tokenParts, setTokenParts] = useState<string[]>(Array(11).fill(""));
  const tokenRefs = useRef<(HTMLInputElement | null)[]>([]);
  
  // Register Specific
  const [registerPassword, setRegisterPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState("");
  const [newRecoveryKey, setNewRecoveryKey] = useState("");
  
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<any>(null);
  
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [qrValue, setQrValue] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (window.recaptchaVerifier) {
        try { window.recaptchaVerifier.clear(); } catch (e) {}
        window.recaptchaVerifier = null;
      }
      try {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          'size': 'invisible'
        });
      } catch (error) {
        console.error("Recaptcha init error:", error);
      }
    }
    return () => {
      if (typeof window !== "undefined" && window.recaptchaVerifier) {
        try { window.recaptchaVerifier.clear(); } catch (e) {}
        window.recaptchaVerifier = null;
      }
    };
  }, []);

  // Listen for QR Sync
  useEffect(() => {
    if (!showQR || !qrValue) return;
    
    const unsubscribe = onSnapshot(doc(db, "qr_sessions", qrValue), async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        console.log("QR Session update received:", data);
        if (data.authorized && data.token) {
          console.log("Token received, attempting login...");
          setShowQR(false);
          try {
            // Log in natively with the custom token
            await signInWithCustomToken(auth, data.token);
            console.log("Login successful!");
            
            const deviceInfo = await getDeviceInfo();
            
            // Wait for DB to update devices list
            await updateDoc(doc(db, "users", data.authorizingUid), {
              devices: arrayUnion(deviceInfo)
            });
            console.log("Device registered, redirecting...");
            // Redirect to Inbox
            router.push("/");
          } catch (error) {
            console.error("QR Auth Error:", error);
            setError("Failed to sync device.");
          }
        }
      } else {
        console.log("QR Session document does not exist yet.");
      }
    }, (error) => {
      console.error("Firestore Listener Error:", error);
    });

    return () => unsubscribe();
  }, [showQR, qrValue, router]);

  const getDeviceId = () => {
    let deviceId = localStorage.getItem('pop-device-id');
    if (!deviceId) {
      deviceId = 'DEV-' + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('pop-device-id', deviceId);
    }
    return deviceId;
  };

  const getDeviceInfo = async () => {
    const deviceId = getDeviceId();
    let location = "Unknown Location";
    try {
      const res = await fetch("https://ipapi.co/json/");
      const locData = await res.json();
      if (locData.city && locData.country_name) {
        location = `${locData.city}, ${locData.country_name}`;
      }
    } catch (e) {}

    let deviceName = "Unknown Device";
    if (navigator.userAgent) {
      const ua = navigator.userAgent;
      if (ua.includes("Windows")) deviceName = "Windows PC";
      else if (ua.includes("iPhone")) deviceName = "iPhone";
      else if (ua.includes("iPad")) deviceName = "iPad";
      else if (ua.includes("Android")) deviceName = "Android";
      else if (ua.includes("Mac OS")) deviceName = "Mac";
      else if (ua.includes("Linux")) deviceName = "Linux PC";
    }

    return {
      id: deviceId,
      name: deviceName,
      location: location,
      timestamp: new Date().toISOString()
    };
  };

  const getFullPhoneNumber = () => {
    let cleanNumber = phoneNumber.replace(/\s+/g, '');
    if (cleanNumber.startsWith('0')) cleanNumber = cleanNumber.substring(1);
    return `${countryCode}${cleanNumber}`;
  };

  const handlePhoneSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!phoneNumber) return;
    
    if (authMode === "LOGIN" && !loginPassword) {
      setError(t('passwordRequired'));
      return;
    }
    
    setError("");
    setLoading(true);
    
    try {
      const fullPhoneNumber = getFullPhoneNumber();
      console.log("Attempting SMS to:", fullPhoneNumber);
      
      const appVerifier = window.recaptchaVerifier;
      const confirmation = await signInWithPhoneNumber(auth, fullPhoneNumber, appVerifier);
      setConfirmationResult(confirmation);
      setStep("OTP");
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/unauthorized-domain') {
        setError(t('domainNotAuthorized'));
      } else {
        setError(err.message || t('errorSendingSms'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || !confirmationResult) return;
    setError("");
    setLoading(true);

    try {
      const result = await confirmationResult.confirm(otp);
      const user = result.user;
      setFirebaseUser(user);

      const userDoc = await getDoc(doc(db, "users", user.uid));
      const userData = userDoc.data();
      
      if (authMode === "LOGIN") {
        if (!userDoc.exists()) {
          setError(t('accountNotFound'));
          setStep("MAIN");
          setLoading(false);
          return;
        }

        // Verify login credentials
        const pwdHash = await hashString(loginPassword);
        if (userData?.passwordHash !== pwdHash) {
          setError(t('incorrectPassword'));
          setStep("MAIN");
          setLoading(false);
          return;
        }

        // Password is correct. Move to token step.
        setStep("RECOVERY_KEY");
      } else {
        // REGISTER MODE
        if (userDoc.exists()) {
          setError(t('accountExists'));
          setAuthMode("LOGIN");
          setStep("MAIN");
        } else {
          setStep("PASSWORD_SETUP");
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(t('invalidOtp'));
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerPassword || !confirmPassword || !firebaseUser) return;
    
    if (registerPassword !== confirmPassword) {
      setError(t('passwordsDoNotMatch') || 'Passwords do not match');
      return;
    }
    
    setError("");
    setLoading(true);

    try {
      const pwdHash = await hashString(registerPassword);
      const deviceInfo = await getDeviceInfo();
      const generatedKey = generateRecoveryKey();
      const keyHash = await hashString(generatedKey);

      await setDoc(doc(db, "users", firebaseUser.uid), {
        phoneNumber: firebaseUser.phoneNumber,
        passwordHash: pwdHash,
        recoveryKeyHash: keyHash,
        devices: [deviceInfo],
        createdAt: new Date(),
      });
      
      setNewRecoveryKey(generatedKey);
      setStep("SHOW_NEW_KEY");
    } catch (err: any) {
      console.error(err);
      setError(t('errorCreatingAccount'));
    } finally {
      setLoading(false);
    }
  };

  const handleRecoveryKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const combinedToken = `${tokenParts.slice(0,3).join("")}-${tokenParts.slice(3,7).join("")}-${tokenParts.slice(7,11).join("")}`;
    if (!firebaseUser) return;
    setError("");
    setLoading(true);

    try {
      const keyHash = await hashString(combinedToken.trim());
      const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
      const userData = userDoc.data();

      if (userData?.recoveryKeyHash !== keyHash) {
        setError(t('invalidToken'));
        setLoading(false);
        return;
      }

      const deviceInfo = await getDeviceInfo();
      await updateDoc(doc(db, "users", firebaseUser.uid), {
        devices: arrayUnion(deviceInfo)
      });
      
      router.push("/");
    } catch (err: any) {
      console.error(err);
      setError(t('errorValidatingKey'));
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setRegisterPassword(val);
    setPasswordStrength(evaluatePasswordStrength(val));
  };

  const handleTokenChange = (index: number, value: string) => {
    const newParts = [...tokenParts];
    const char = value.slice(-1).toUpperCase();
    newParts[index] = char;
    setTokenParts(newParts);

    if (char && index < 10) {
      tokenRefs.current[index + 1]?.focus();
    }
  };

  const handleTokenKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !tokenParts[index] && index > 0) {
      tokenRefs.current[index - 1]?.focus();
    }
  };

  const handleTokenPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").toUpperCase();
    const clean = pasted.replace(/[^A-Z0-9]/g, "");
    
    const newParts = [...tokenParts];
    for (let i = 0; i < 11 && i < clean.length; i++) {
      newParts[i] = clean[i];
    }
    setTokenParts(newParts);
    
    const nextEmpty = newParts.findIndex(p => !p);
    if (nextEmpty !== -1) {
      tokenRefs.current[nextEmpty]?.focus();
    } else {
      tokenRefs.current[10]?.focus();
    }
  };

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden retro-bg text-black">
      <header className="retro-nav p-3 sm:p-4 flex items-center justify-center shadow-md z-10 shrink-0">
        <h1 className="text-xl sm:text-2xl font-bold text-white text-center drop-shadow-md text-shadow-sm truncate shrink-0">
          {t('loginTitle')}
        </h1>
      </header>

      <div className="px-4 py-2 sm:p-4 flex-1 flex flex-col justify-start pt-6 sm:pt-10 overflow-y-auto">
        <p className="text-center text-[#4d576b] font-bold text-sm mb-4 shadow-white drop-shadow-sm">
          {t('loginSubtitle')}
        </p>

        <form 
          onSubmit={
            step === "MAIN" ? handlePhoneSubmit : 
            step === "OTP" ? handleOtpSubmit : 
            step === "PASSWORD_SETUP" ? handleRegisterPasswordSubmit :
            step === "RECOVERY_KEY" ? handleRecoveryKeySubmit :
            (e) => { e.preventDefault(); router.push("/"); }
          } 
          className="w-full max-w-md mx-auto flex flex-col"
        >
          {error && (
            <div className="mb-4 text-red-600 font-bold text-center text-sm">
              {error}
            </div>
          )}

          {step === "MAIN" && (
            <div className="bg-white border border-gray-400 rounded-lg overflow-hidden shadow-sm mb-3">
              <div className="flex items-center px-4 py-3 border-b border-gray-200">
                <span className="text-gray-500 font-bold w-24">{t('country')}</span>
                <select 
                  value={countryCode} 
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="flex-1 bg-transparent text-black font-bold focus:outline-none cursor-pointer appearance-none"
                >
                  <option value="+593">Ecuador (+593)</option>
                  <option value="+1">United States (+1)</option>
                  <option value="+44">United Kingdom (+44)</option>
                  <option value="+34">Spain (+34)</option>
                  <option value="+52">Mexico (+52)</option>
                  <option value="+57">Colombia (+57)</option>
                  <option value="+54">Argentina (+54)</option>
                  <option value="+56">Chile (+56)</option>
                </select>
              </div>
              
              <div className={`flex items-center px-4 py-3 ${authMode === "LOGIN" ? "border-b border-gray-200" : ""}`}>
                <span className="text-gray-500 font-bold w-24">{t('phone')}</span>
                <input
                  type="tel"
                  placeholder="123 456 7890"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="flex-1 bg-transparent text-black font-bold focus:outline-none"
                />
              </div>

              {authMode === "LOGIN" && (
                <div className="flex items-center px-4 py-3">
                  <span className="text-gray-500 font-bold w-24">{t('password')}</span>
                  <input
                    type="password"
                    placeholder={t('yourPassword')}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="flex-1 bg-transparent text-black font-bold focus:outline-none"
                  />
                </div>
              )}
            </div>
          )}

          {step === "OTP" && (
            <div className="bg-white border border-gray-400 rounded-lg overflow-hidden shadow-sm mb-4">
              <div className="flex items-center px-4 py-3">
                <span className="text-gray-500 font-bold w-24">{t('smsCode')}</span>
                <input
                  type="text"
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="flex-1 bg-transparent text-black font-bold focus:outline-none tracking-widest"
                  maxLength={6}
                />
              </div>
            </div>
          )}

          {step === "PASSWORD_SETUP" && (
            <div className="bg-white border border-gray-400 rounded-lg overflow-hidden shadow-sm mb-4 p-4 sm:p-5 w-full">
              <h2 className="text-center font-bold text-lg mb-2">{t('setupPassword')}</h2>
              <p className="text-center text-xs text-gray-500 mb-4 font-semibold">
                {t('secureAccount')}
              </p>
              <div className="flex flex-col gap-3">
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder={t('maxChars')}
                    value={registerPassword}
                    onChange={handlePasswordChange}
                    maxLength={14}
                    className="w-full bg-gray-50 border border-gray-300 rounded-md pl-3 pr-10 py-3 text-black font-bold focus:outline-none focus:border-blue-500 shadow-inner"
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                
                {registerPassword && (
                  <div className="flex justify-between items-center px-1 mb-1">
                    <span className="text-xs font-semibold text-gray-500">{t('strength')}</span>
                    <span className={`text-xs font-bold ${
                      passwordStrength === 'Weak' ? 'text-red-500' :
                      passwordStrength === 'Moderate' ? 'text-yellow-500' :
                      passwordStrength === 'Strong' ? 'text-green-500' : 'text-blue-600'
                    }`}>
                      {passwordStrength}
                    </span>
                  </div>
                )}

                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder={t('confirmPassword') || 'Confirm Password'}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setError("");
                    }}
                    maxLength={14}
                    className="w-full bg-gray-50 border border-gray-300 rounded-md pl-3 pr-10 py-3 text-black font-bold focus:outline-none focus:border-blue-500 shadow-inner"
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === "SHOW_NEW_KEY" && (
            <div className="bg-white border border-gray-400 rounded-lg shadow-sm mb-4 p-5 text-center">
              <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
              <h2 className="font-bold text-xl text-red-600 mb-2">{t('saveThisKey')}</h2>
              <p className="text-xs text-gray-600 mb-4 font-semibold">
                {t('loseKeyWarning')}
              </p>
              <div className="bg-gray-100 p-3 rounded border border-gray-300 mb-4 select-all">
                <span className="font-mono font-bold text-blue-700 tracking-wider text-lg">{newRecoveryKey}</span>
              </div>
            </div>
          )}

          {step === "RECOVERY_KEY" && (
            <div className="bg-white border border-gray-400 rounded-lg overflow-hidden shadow-sm mb-4 p-4 sm:p-5 text-center max-w-sm mx-auto w-full">
              <h2 className="font-bold text-lg mb-2 text-gray-800 flex items-center justify-center gap-2">
                <Key className="w-5 h-5"/> {t('enterToken')}
              </h2>
              <p className="text-sm text-gray-500 mb-6 font-semibold">
                {t('enterTokenText')}
              </p>
              <div className="flex justify-center items-center gap-0.5 sm:gap-2 mb-2 w-full max-w-lg mx-auto">
                {/* First 3 boxes (POP) */}
                {tokenParts.slice(0, 3).map((part, i) => (
                  <input
                    key={i}
                    ref={(el) => { tokenRefs.current[i] = el; }}
                    type="text"
                    value={part}
                    onChange={(e) => handleTokenChange(i, e.target.value)}
                    onKeyDown={(e) => handleTokenKeyDown(i, e)}
                    onPaste={handleTokenPaste}
                    className="w-[22px] sm:w-8 h-8 sm:h-10 text-center font-bold text-sm sm:text-lg border-2 border-gray-400 rounded sm:rounded-lg bg-white text-gray-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none transition-all shadow-md"
                    maxLength={2}
                  />
                ))}
                
                <span className="font-bold text-gray-400 shrink-0">-</span>
                
                {/* Next 4 boxes */}
                {tokenParts.slice(3, 7).map((part, i) => (
                  <input
                    key={i + 3}
                    ref={(el) => { tokenRefs.current[i + 3] = el; }}
                    type="text"
                    value={part}
                    onChange={(e) => handleTokenChange(i + 3, e.target.value)}
                    onKeyDown={(e) => handleTokenKeyDown(i + 3, e)}
                    onPaste={handleTokenPaste}
                    className="w-[22px] sm:w-8 h-8 sm:h-10 text-center font-bold text-sm sm:text-lg border-2 border-gray-400 rounded sm:rounded-lg bg-white text-gray-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none transition-all shadow-md"
                    maxLength={2}
                  />
                ))}

                <span className="font-bold text-gray-400 shrink-0">-</span>
                
                {/* Final 4 boxes */}
                {tokenParts.slice(7, 11).map((part, i) => (
                  <input
                    key={i + 7}
                    ref={(el) => { tokenRefs.current[i + 7] = el; }}
                    type="text"
                    value={part}
                    onChange={(e) => handleTokenChange(i + 7, e.target.value)}
                    onKeyDown={(e) => handleTokenKeyDown(i + 7, e)}
                    onPaste={handleTokenPaste}
                    className="w-[22px] sm:w-8 h-8 sm:h-10 text-center font-bold text-sm sm:text-lg border-2 border-gray-400 rounded sm:rounded-lg bg-white text-gray-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none transition-all shadow-md"
                    maxLength={2}
                  />
                ))}
              </div>
            </div>
          )}

          {step === "MAIN" && authMode === "LOGIN" && (
            <div className="mb-4 mt-4">
              <button 
                type="button"
                onClick={() => {
                  setQrValue(crypto.randomUUID());
                  setShowQR(true);
                }}
                className="w-full retro-btn text-white font-bold text-lg py-3 rounded-lg shadow-md active:opacity-70 transition-opacity flex items-center justify-center gap-2"
              >
                <QrCode className="w-5 h-5" /> {t('showQrToLogin')}
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full block retro-btn text-white font-bold text-lg py-3 rounded-lg shadow-md active:opacity-70 transition-opacity mb-4"
          >
            {loading ? t('processing') : 
             step === "SHOW_NEW_KEY" ? t('iHaveSavedIt') : 
             authMode === "LOGIN" && step === "MAIN" ? t('login') : t('continue')}
          </button>
          
          {step === "MAIN" && (
            <div className="text-center">
              {authMode === "LOGIN" ? (
                <button
                  type="button"
                  onClick={() => { setAuthMode("REGISTER"); setError(""); }}
                  className="text-sm font-bold text-blue-800 hover:underline"
                >
                  {t('dontHaveAccount')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => { setAuthMode("LOGIN"); setError(""); }}
                  className="text-sm font-bold text-blue-800 hover:underline"
                >
                  {t('alreadyHaveAccount')}
                </button>
              )}
            </div>
          )}

          {step === "MAIN" && (
            <div className="mt-4 text-center">
              <div className="bg-white dark:bg-[#1a1a1a] rounded-xl p-4 shadow-sm border border-gray-200 dark:border-[#333]">
                <h3 className="text-xs sm:text-sm font-bold text-gray-800 dark:text-gray-200 mb-2 uppercase tracking-wide">{t('aboutTitle')}</h3>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium leading-relaxed max-w-sm mx-auto">
                  {t('aboutText')}
                </p>
              </div>
            </div>
          )}
        </form>
      </div>
      
      {showQR && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-[#121212]">
          <div className="retro-nav px-4 py-3 flex items-center justify-between shadow-md shrink-0">
            <h2 className="text-white font-bold text-lg text-shadow-sm">{t('scanQrCode')}</h2>
            <button onClick={() => setShowQR(false)} className="retro-btn px-3 py-1 text-white text-sm font-bold">{t('close')}</button>
          </div>
          
          <div className="flex-1 flex flex-col items-center justify-center p-4">
            <div className="bg-white p-6 border-2 border-gray-300 rounded-xl shadow-2xl mb-8">
              <QRCode 
                value={qrValue} 
                size={256}
                style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                viewBox={`0 0 256 256`}
              />
            </div>
            
            <div className="bg-white/80 dark:bg-[#1e1e1e]/80 backdrop-blur-sm p-4 rounded-lg border border-gray-300 dark:border-[#333] shadow-sm max-w-sm text-center">
              <p className="text-gray-800 dark:text-gray-200 font-bold text-lg mb-2">
                {t('syncDevice')}
              </p>
              <p className="text-gray-600 dark:text-gray-400 font-semibold text-sm">
                {t('syncDeviceText')}
              </p>
            </div>
          </div>
        </div>
      )}
      
      <div id="recaptcha-container"></div>
    </div>
  );
}
