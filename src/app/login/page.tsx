"use client";

import { useState, useEffect, useRef } from "react";
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, setDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Key, AlertTriangle, QrCode } from "lucide-react";
import QRCode from "react-qr-code";
import { hashString, generateRecoveryKey, evaluatePasswordStrength } from "@/lib/crypto";

declare global {
  interface Window {
    recaptchaVerifier: any;
  }
}

type AuthMode = "LOGIN" | "REGISTER";
type AuthStep = "MAIN" | "OTP" | "PASSWORD_SETUP" | "SHOW_NEW_KEY" | "RECOVERY_KEY";

export default function LoginPage() {
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

  const getDeviceId = () => {
    let deviceId = localStorage.getItem('pop-device-id');
    if (!deviceId) {
      deviceId = 'DEV-' + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('pop-device-id', deviceId);
    }
    return deviceId;
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
      setError("Password is required to log in.");
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
        setError("Domain not authorized in Firebase Console.");
      } else {
        setError(err.message || "Error sending SMS.");
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
          setError("Account not found. Please register.");
          setStep("MAIN");
          setLoading(false);
          return;
        }

        // Verify login credentials
        const pwdHash = await hashString(loginPassword);
        if (userData?.passwordHash !== pwdHash) {
          setError("Incorrect password.");
          setStep("MAIN");
          setLoading(false);
          return;
        }

        // Password is correct. Move to token step.
        setStep("RECOVERY_KEY");
      } else {
        // REGISTER MODE
        if (userDoc.exists()) {
          setError("Account already exists. Please log in.");
          setAuthMode("LOGIN");
          setStep("MAIN");
        } else {
          setStep("PASSWORD_SETUP");
        }
      }
    } catch (err: any) {
      console.error(err);
      setError("Invalid OTP code.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerPassword || !firebaseUser) return;
    setError("");
    setLoading(true);

    try {
      const pwdHash = await hashString(registerPassword);
      const deviceId = getDeviceId();
      const generatedKey = generateRecoveryKey();
      const keyHash = await hashString(generatedKey);

      await setDoc(doc(db, "users", firebaseUser.uid), {
        phoneNumber: firebaseUser.phoneNumber,
        passwordHash: pwdHash,
        recoveryKeyHash: keyHash,
        devices: [deviceId],
        createdAt: new Date(),
      });
      
      setNewRecoveryKey(generatedKey);
      setStep("SHOW_NEW_KEY");
    } catch (err) {
      console.error(err);
      setError("Error creating account.");
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
        setError("Invalid Token.");
        setLoading(false);
        return;
      }

      const deviceId = getDeviceId();
      await updateDoc(doc(db, "users", firebaseUser.uid), {
        devices: arrayUnion(deviceId)
      });
      
      router.push("/");
    } catch (err) {
      console.error(err);
      setError("Error validating key.");
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
    <div className="min-h-screen retro-bg text-black">
      <header className="retro-nav px-3 py-2 flex justify-center items-center shadow-md">
        <h1 className="text-xl font-bold text-white drop-shadow-md text-shadow-sm">POP Chat</h1>
      </header>

      <div className="p-4 mt-4">
        <p className="text-center text-[#4d576b] font-bold text-sm mb-4 shadow-white drop-shadow-sm">
          Private Open Protocol
        </p>

        <form 
          onSubmit={
            step === "MAIN" ? handlePhoneSubmit : 
            step === "OTP" ? handleOtpSubmit : 
            step === "PASSWORD_SETUP" ? handleRegisterPasswordSubmit :
            step === "RECOVERY_KEY" ? handleRecoveryKeySubmit :
            (e) => { e.preventDefault(); router.push("/"); }
          } 
          className="max-w-md mx-auto"
        >
          {error && (
            <div className="mb-4 text-red-600 font-bold text-center text-sm">
              {error}
            </div>
          )}

          {step === "MAIN" && (
            <div className="bg-white border border-gray-400 rounded-lg overflow-hidden shadow-sm mb-4">
              <div className="flex items-center px-4 py-3 border-b border-gray-200">
                <span className="text-gray-500 font-bold w-24">Country</span>
                <select 
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="flex-1 bg-transparent text-black font-bold focus:outline-none"
                >
                  <option value="+593">Ecuador (+593)</option>
                </select>
              </div>
              
              <div className={`flex items-center px-4 py-3 ${authMode === "LOGIN" ? "border-b border-gray-200" : ""}`}>
                <span className="text-gray-500 font-bold w-24">Phone</span>
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
                  <span className="text-gray-500 font-bold w-24">Password</span>
                  <input
                    type="password"
                    placeholder="Your password"
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
                <span className="text-gray-500 font-bold w-24">SMS Code</span>
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
            <div className="bg-white border border-gray-400 rounded-lg overflow-hidden shadow-sm mb-4 p-4">
              <h2 className="text-center font-bold text-lg mb-2">Create Password</h2>
              <p className="text-center text-xs text-gray-500 mb-4">
                Secure your account with a password.
              </p>
              <div className="flex flex-col gap-2">
                <input
                  type="password"
                  placeholder="Max 14 chars"
                  value={registerPassword}
                  onChange={handlePasswordChange}
                  maxLength={14}
                  className="w-full bg-gray-100 border border-gray-300 rounded-md px-3 py-2 text-black font-bold focus:outline-none focus:border-blue-500"
                />
                {registerPassword && (
                  <div className="flex justify-between items-center px-1">
                    <span className="text-xs font-semibold text-gray-500">Strength:</span>
                    <span className={`text-xs font-bold ${
                      passwordStrength === 'Weak' ? 'text-red-500' :
                      passwordStrength === 'Moderate' ? 'text-yellow-500' :
                      passwordStrength === 'Strong' ? 'text-green-500' : 'text-blue-600'
                    }`}>
                      {passwordStrength}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === "SHOW_NEW_KEY" && (
            <div className="bg-white border border-gray-400 rounded-lg shadow-sm mb-4 p-5 text-center">
              <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
              <h2 className="font-bold text-xl text-red-600 mb-2">Save This Key!</h2>
              <p className="text-xs text-gray-600 mb-4 font-semibold">
                If you lose this key, you will NEVER be able to log in on another device. There is NO password reset.
              </p>
              <div className="bg-gray-100 p-3 rounded border border-gray-300 mb-4 select-all">
                <span className="font-mono font-bold text-blue-700 tracking-wider text-lg">{newRecoveryKey}</span>
              </div>
            </div>
          )}

          {step === "RECOVERY_KEY" && (
            <div className="bg-white border border-gray-400 rounded-lg overflow-hidden shadow-sm mb-4 p-5 text-center">
              <h2 className="font-bold text-lg mb-2 text-gray-800 flex items-center justify-center gap-2">
                <Key className="w-5 h-5"/> Enter Token
              </h2>
              <p className="text-xs text-gray-500 mb-5 font-semibold">
                Please enter your 13-character token key to continue.
              </p>
              <div className="flex justify-center items-center gap-1 mb-2">
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
                    className="w-6 h-8 sm:w-8 sm:h-10 md:w-9 md:h-10 text-center font-bold text-sm sm:text-base border border-gray-300 rounded-md sm:rounded-lg bg-gray-50 text-gray-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-all shadow-sm"
                    maxLength={2}
                  />
                ))}
                
                <span className="font-bold text-gray-400 mx-1">-</span>
                
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
                    className="w-6 h-8 sm:w-8 sm:h-10 md:w-9 md:h-10 text-center font-bold text-sm sm:text-base border border-gray-300 rounded-md sm:rounded-lg bg-gray-50 text-gray-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-all shadow-sm"
                    maxLength={2}
                  />
                ))}

                <span className="font-bold text-gray-400 mx-1">-</span>
                
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
                    className="w-6 h-8 sm:w-8 sm:h-10 md:w-9 md:h-10 text-center font-bold text-sm sm:text-base border border-gray-300 rounded-md sm:rounded-lg bg-gray-50 text-gray-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-all shadow-sm"
                    maxLength={2}
                  />
                ))}
              </div>
            </div>
          )}

          {step === "MAIN" && authMode === "LOGIN" && (
            <div className="mb-4">
              <button
                type="button"
                onClick={() => {
                  setQrValue(crypto.randomUUID());
                  setShowQR(true);
                }}
                className="w-full retro-btn text-white font-bold text-lg py-3 rounded-lg shadow-md active:opacity-70 transition-opacity flex items-center justify-center gap-2"
              >
                <QrCode className="w-5 h-5" /> Scan with QR
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full retro-btn text-white font-bold text-lg py-3 rounded-lg shadow-md active:opacity-70 transition-opacity mb-4"
          >
            {loading ? "Processing..." : 
             step === "SHOW_NEW_KEY" ? "I have saved it" : 
             authMode === "LOGIN" && step === "MAIN" ? "Log In" : "Continue"}
          </button>
          
          {step === "MAIN" && (
            <div className="text-center">
              {authMode === "LOGIN" ? (
                <button
                  type="button"
                  onClick={() => { setAuthMode("REGISTER"); setError(""); }}
                  className="text-sm font-bold text-blue-800 hover:underline"
                >
                  Don't have an account? Sign up
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => { setAuthMode("LOGIN"); setError(""); }}
                  className="text-sm font-bold text-blue-800 hover:underline"
                >
                  Already have an account? Log in
                </button>
              )}
            </div>
          )}
        </form>
      </div>
      
      {showQR && (
        <div className="fixed inset-0 z-50 flex flex-col retro-bg dark:bg-[#121212]">
          <div className="retro-nav px-4 py-3 flex items-center justify-between shadow-md shrink-0">
            <h2 className="text-white font-bold text-lg text-shadow-sm">Scan QR Code</h2>
            <button onClick={() => setShowQR(false)} className="retro-btn px-3 py-1 text-white text-sm font-bold">Close</button>
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
                Sync Device
              </p>
              <p className="text-gray-600 dark:text-gray-400 font-semibold text-sm">
                Scan this unique code from your primary device to log in automatically.
              </p>
            </div>
          </div>
        </div>
      )}
      
      <div id="recaptcha-container"></div>
    </div>
  );
}
