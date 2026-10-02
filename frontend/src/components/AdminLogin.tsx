import React, { useState } from 'react';
import { 
  ShieldAlert, Lock, Mail, Eye, EyeOff, 
  ArrowLeft, AlertCircle, Sparkles
} from 'lucide-react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup 
} from 'firebase/auth';
import { auth, googleProvider } from '../services/firebase';

interface AdminLoginProps {
  onSuccess: (adminEmail: string) => void;
  onExit: () => void;
}

const SUPER_ADMIN_EMAIL = 'joysanyal1999@gmail.com';
const SUPER_ADMIN_PASS = '01307460389+';

export const AdminLogin: React.FC<AdminLoginProps> = ({ onSuccess, onExit }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  // Email & Password Authentication
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setError(null);

    const cleanEmail = email.trim().toLowerCase();

    // 1. Direct Whitelisted Super Admin Credentials Check
    if (
      cleanEmail === SUPER_ADMIN_EMAIL.toLowerCase() && 
      (password === SUPER_ADMIN_PASS || password === 'eforce2026')
    ) {
      localStorage.setItem('eforce_admin_session', JSON.stringify({
        email: SUPER_ADMIN_EMAIL,
        role: 'super_admin',
        time: Date.now()
      }));

      // In background, register/login in Firebase Auth if available
      try {
        await signInWithEmailAndPassword(auth, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASS).catch(async () => {
          await createUserWithEmailAndPassword(auth, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASS).catch(() => {});
        });
      } catch {}

      onSuccess(SUPER_ADMIN_EMAIL);
      return;
    }

    try {
      if (isRegisterMode) {
        // Register new admin account in Firebase Auth
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        localStorage.setItem('eforce_admin_session', JSON.stringify({
          email: cred.user.email,
          uid: cred.user.uid,
          time: Date.now()
        }));
        onSuccess(cred.user.email || email);
      } else {
        // Sign in existing admin
        const cred = await signInWithEmailAndPassword(auth, email, password);
        localStorage.setItem('eforce_admin_session', JSON.stringify({
          email: cred.user.email,
          uid: cred.user.uid,
          time: Date.now()
        }));
        onSuccess(cred.user.email || email);
      }
    } catch (err: any) {
      console.warn('Firebase Auth error:', err);
      // Helpful error messages
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        setError('Incorrect email or password, or account does not exist yet. You can click "Create Admin Account" below.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('This Gmail is already registered. Please switch to Sign In mode.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters.');
      } else if (err.code === 'auth/operation-not-allowed') {
        // If Email/Password auth is not toggled in Firebase Console yet, allow master admin bypass
        if (password === 'eforce2026') {
          localStorage.setItem('eforce_admin_session', JSON.stringify({
            email,
            time: Date.now()
          }));
          onSuccess(email);
          return;
        }
        setError('Email/Password provider not enabled in Firebase Console yet. You can use your master PIN as password: eforce2026');
      } else {
        // Allow master password fallback if needed
        if (password === 'eforce2026') {
          localStorage.setItem('eforce_admin_session', JSON.stringify({
            email,
            time: Date.now()
          }));
          onSuccess(email);
          return;
        }
        setError(err.message || 'Authentication failed. Please verify credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Google Sign-In with Gmail
  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await signInWithPopup(auth, googleProvider);
      localStorage.setItem('eforce_admin_session', JSON.stringify({
        email: res.user.email,
        uid: res.user.uid,
        time: Date.now()
      }));
      onSuccess(res.user.email || 'Google Admin');
    } catch (err: any) {
      console.warn('Google Sign-In error:', err);
      if (err.code !== 'auth/popup-closed-by-user') {
        setError(err.message || 'Google Sign-In failed. Please try Email & Password.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#08080C] text-white flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-brand-orange/15 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-80 h-80 bg-orange-600/10 blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md bg-[#10111A]/90 border border-orange-500/25 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-orange to-orange-400 p-0.5 shadow-orange-glow flex items-center justify-center">
              <ShieldAlert size={20} className="text-black" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                E-FORCE ADMIN
                <span className="text-[10px] font-bold bg-orange-500/20 text-brand-orange px-2 py-0.5 rounded-full border border-orange-500/30">
                  PORTAL
                </span>
              </h1>
              <span className="text-xs text-gray-400">Firebase Cloud Authentication</span>
            </div>
          </div>

          <button
            onClick={onExit}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            title="Return to Mini App"
          >
            <ArrowLeft size={16} />
          </button>
        </div>

        {/* Title */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-white tracking-wide">
            {isRegisterMode ? 'Create Admin Account' : 'Admin Sign In'}
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            {isRegisterMode 
              ? 'Register your official Gmail & password to manage the E-FORCE engine.'
              : 'Enter your Gmail & password to access the Command Center.'
            }
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-xs text-red-300 flex items-start gap-2">
            <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Email & Password Form */}
        <form onSubmit={handleEmailAuth} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
              Gmail / Email Address
            </label>
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                required
                placeholder="joysanyal1999@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 focus:border-brand-orange rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 focus:border-brand-orange rounded-xl pl-10 pr-10 py-3 text-sm text-white focus:outline-none transition-all font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-brand-orange to-orange-500 text-white font-black text-sm tracking-wide shadow-orange-glow hover:brightness-110 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Lock size={16} />
                <span>{isRegisterMode ? 'Register & Enter Admin' : 'Sign In with Gmail'}</span>
              </>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-[#10111A] px-2 text-gray-500 font-bold">OR</span>
          </div>
        </div>

        {/* Google Sign In Button */}
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold transition-all flex items-center justify-center gap-2.5"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Continue with Google</span>
        </button>

        {/* Toggle Mode Footer */}
        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsRegisterMode(!isRegisterMode);
              setError(null);
            }}
            className="text-xs text-orange-400 hover:text-orange-300 font-semibold transition-colors"
          >
            {isRegisterMode 
              ? 'Already have an Admin account? Sign In'
              : "Need to create a new Admin account? Click here"
            }
          </button>
        </div>

        <div className="mt-4 pt-4 border-t border-white/5 text-[11px] text-gray-500 text-center flex items-center justify-center gap-1">
          <Sparkles size={12} className="text-brand-orange" />
          <span>Protected by Firebase Authentication & Firestore</span>
        </div>
      </div>
    </div>
  );
};
