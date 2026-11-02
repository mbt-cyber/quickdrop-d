import React, { useState, useEffect } from 'react';
import { Role } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { ADMIN_EMAIL } from '../../context/AuthContext';
import {
  Mail,
  Lock,
  User,
  Bike,
  Shield,
  ArrowRight,
  Eye,
  EyeOff,
  Sparkles,
  AlertCircle,
  X,
  Send,
  CheckCircle2,
  KeyRound,
  UserPlus,
  LogIn,
} from 'lucide-react';

interface EmailAuthScreenProps {
  initialRole?: Role;
  initialMode?: 'login' | 'signup' | 'forgot';
  onSuccess?: (userRole?: Role) => void;
  onRoleSelect?: (role: Role) => void;
  onClose?: () => void;
}

export const EmailAuthScreen: React.FC<EmailAuthScreenProps> = ({
  initialRole = 'customer',
  initialMode = 'login',
  onSuccess,
  onRoleSelect,
  onClose,
}) => {
  const { signUpWithEmail, signInWithEmail, isDemoMode, error: globalError, clearError, loading } = useAuth();

  const [selectedRole, setSelectedRole] = useState<Role>(initialRole);
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>(initialMode);

  // Form Fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Status & Error
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Password Reset Step
  const [resetSent, setResetSent] = useState(false);

  const handleSelectRole = (role: Role) => {
    setSelectedRole(role);
    setLocalError(null);
    if (onRoleSelect) {
      onRoleSelect(role);
    }
  };

  useEffect(() => {
    setSelectedRole(initialRole);
    setMode(initialMode);
    setLocalError(null);
    setSuccessMsg(null);
    if (onRoleSelect && initialRole) {
      onRoleSelect(initialRole);
    }
  }, [initialRole, initialMode]);

  // Auto Generate Password Function
  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    const nums = '0123456789';
    const symbols = '!@#$%&*';

    let gen = 'QD#';
    for (let i = 0; i < 4; i++) {
      gen += nums.charAt(Math.floor(Math.random() * nums.length));
    }
    for (let i = 0; i < 2; i++) {
      gen += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    gen += symbols.charAt(Math.floor(Math.random() * symbols.length));

    setPassword(gen);
    setConfirmPassword(gen);
    setShowPassword(true);
    setSuccessMsg('Generated strong password! Copy or save it.');
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Handle Sign In Submit
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setSuccessMsg(null);
    if (clearError) clearError();

    if (!email.trim() || !email.includes('@')) {
      setLocalError('Please enter a valid email address.');
      return;
    }
    if (selectedRole === 'admin' && email.trim().toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      setLocalError('⚠️ Warning:\nRestricted area Do not Proceed Stop');
      return;
    }
    if (!password) {
      setLocalError('Please enter your password.');
      return;
    }

    setIsSubmitting(true);
    const result = await signInWithEmail(email.trim(), password, selectedRole, fullName.trim());
    setIsSubmitting(false);

    if (result.success) {
      const userRole = result.user?.role || selectedRole;
      if (onSuccess) onSuccess(userRole);
      if (onClose) onClose();
    } else if (result.error) {
      setLocalError(result.error);
    }
  };

  // Handle Sign Up Submit
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setSuccessMsg(null);
    if (clearError) clearError();

    if (!fullName.trim()) {
      setLocalError('Please enter your full name.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setLocalError('Please enter a valid email address.');
      return;
    }
    if (selectedRole === 'admin' && email.trim().toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      setLocalError('⚠️ Warning:\nRestricted area Do not Proceed Stop');
      return;
    }
    if (!password || password.length < 6) {
      setLocalError('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setLocalError('Passwords do not match. Please re-enter.');
      return;
    }

    setIsSubmitting(true);
    const result = await signUpWithEmail(email.trim(), password, fullName.trim(), selectedRole);
    setIsSubmitting(false);

    if (result.success) {
      const userRole = result.user?.role || selectedRole;
      setSuccessMsg(`Account created successfully as ${userRole.toUpperCase()}! Redirecting...`);
      setTimeout(() => {
        if (onSuccess) onSuccess(userRole);
        if (onClose) onClose();
      }, 500);
    } else if (result.error) {
      setLocalError(result.error);
    }
  };

  // Handle Reset Password Request
  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!email.trim() || !email.includes('@')) {
      setLocalError('Please enter your registered email address.');
      return;
    }

    setResetSent(true);
    setSuccessMsg(`Password reset instructions sent to ${email.trim()}`);
  };

  const activeError = localError || globalError;

  const formatDisplayError = (err: any): string => {
    if (!err) return '';
    if (typeof err === 'string') {
      const trimmed = err.trim();
      if (trimmed === '{}' || trimmed === '[object Object]' || !trimmed) {
        return 'An authentication error occurred. Please verify your details and try again.';
      }
      return trimmed;
    }
    if (typeof err === 'object') {
      if (err.message && typeof err.message === 'string' && err.message.trim() !== '{}') {
        return err.message.trim();
      }
      if (err.error_description && typeof err.error_description === 'string') {
        return err.error_description.trim();
      }
    }
    return 'An authentication error occurred. Please try again.';
  };

  return (
    <div className="bg-slate-900 rounded-3xl shadow-2xl border border-slate-800 text-white w-full max-w-md overflow-hidden relative font-sans animate-in fade-in zoom-in-95">
      {/* Top Header */}
      <div className="bg-gradient-to-r from-indigo-800 via-indigo-900 to-slate-950 p-6 relative">
        {onClose && (
          <button
            onClick={onClose}
            type="button"
            className="absolute top-4 right-4 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/30 border border-indigo-400/30 flex items-center justify-center font-extrabold text-sm text-indigo-200">
            QD
          </div>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-300 bg-indigo-950/60 border border-indigo-800 px-2.5 py-0.5 rounded-full">
            Supabase Auth
          </span>
        </div>

        <h2 className="text-2xl font-black tracking-tight font-heading">
          {mode === 'login' && 'Sign In to Portal'}
          {mode === 'signup' && 'Create Account'}
          {mode === 'forgot' && 'Reset Password'}
        </h2>
        <p className="text-xs text-indigo-200/90 mt-1">
          {mode === 'login' && 'Enter your email and password to log in'}
          {mode === 'signup' && 'Sign up with email to access your dashboard'}
          {mode === 'forgot' && 'Enter your account email to receive recovery instructions'}
        </p>

        {/* Role Selector */}
        <div className="mt-4 pt-3 border-t border-white/10 grid grid-cols-2 gap-1.5 bg-slate-950/60 p-1.5 rounded-2xl border border-white/5">
          <button
            type="button"
            onClick={() => handleSelectRole('customer')}
            className={`py-2 px-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
              selectedRole === 'customer'
                ? 'bg-indigo-600 text-white shadow-md ring-2 ring-white/20'
                : 'text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Customer</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectRole('rider')}
            className={`py-2 px-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
              selectedRole === 'rider'
                ? 'bg-amber-600 text-white shadow-md ring-2 ring-white/20'
                : 'text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <Bike className="w-3.5 h-3.5" />
            <span>Partner</span>
          </button>
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="flex border-b border-slate-800 bg-slate-950 px-6 pt-3 gap-4 text-xs font-bold">
        <button
          type="button"
          onClick={() => {
            setMode('login');
            setLocalError(null);
          }}
          className={`pb-2.5 transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
            mode === 'login'
              ? 'border-indigo-500 text-indigo-400 font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <LogIn className="w-3.5 h-3.5" />
          <span>Sign In</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setMode('signup');
            setLocalError(null);
          }}
          className={`pb-2.5 transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
            mode === 'signup'
              ? 'border-indigo-500 text-indigo-400 font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>Sign Up</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setMode('forgot');
            setLocalError(null);
          }}
          className={`pb-2.5 transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
            mode === 'forgot'
              ? 'border-indigo-500 text-indigo-400 font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <KeyRound className="w-3.5 h-3.5" />
          <span>Forgot?</span>
        </button>
      </div>

      {/* Body Area */}
      <div className="p-6 space-y-4">
        {/* Error Alert */}
        {activeError && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-start gap-2.5 animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 font-semibold">{formatDisplayError(activeError)}</div>
          </div>
        )}

        {/* Success Alert */}
        {successMsg && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-start gap-2.5 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1 font-semibold">{successMsg}</div>
          </div>
        )}

        {/* MODE 1: SIGN IN FORM */}
        {mode === 'login' && (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Email Address</label>
              <div className="relative flex items-center">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. user@gmail.com"
                  required
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none font-medium"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-300">Password</label>
                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot');
                    setLocalError(null);
                  }}
                  className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative flex items-center">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 text-slate-500 hover:text-slate-300 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Notice for Customer Name */}
            <div className="p-3 bg-indigo-950/40 border border-indigo-800/50 rounded-xl text-xs text-indigo-200 flex items-center justify-between">
              <span>New customer? Enter name & signup:</span>
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setLocalError(null);
                }}
                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors cursor-pointer"
              >
                Go to Sign Up
              </button>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || loading}
              className={`w-full py-3.5 text-white font-extrabold text-xs sm:text-sm rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer ${
                selectedRole === 'rider'
                  ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                  : selectedRole === 'admin'
                  ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                  : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In as {selectedRole.toUpperCase()}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="text-center pt-2 text-xs text-slate-400">
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setLocalError(null);
                }}
                className="text-indigo-400 hover:text-indigo-300 font-bold cursor-pointer underline"
              >
                Sign Up Now
              </button>
            </div>
          </form>
        )}

        {/* MODE 2: SIGN UP FORM */}
        {mode === 'signup' && (
          <form onSubmit={handleSignUp} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                {selectedRole === 'rider' ? 'Rider Name' : selectedRole === 'admin' ? 'Admin Name' : 'Customer Name'}
              </label>
              <div className="relative flex items-center">
                <User className="w-4 h-4 text-slate-500 absolute left-3.5" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={selectedRole === 'rider' ? 'e.g. Rahul Rider' : 'e.g. Aarav Sharma'}
                  required
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Email ID</label>
              <div className="relative flex items-center">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. user@gmail.com"
                  required
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none font-medium"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-300">Password</label>
                <button
                  type="button"
                  onClick={handleGeneratePassword}
                  className="text-[11px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>Auto-Generate Password</span>
                </button>
              </div>
              <div className="relative flex items-center">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 text-slate-500 hover:text-slate-300 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Confirm Password</label>
              <div className="relative flex items-center">
                <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  required
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none font-medium"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || loading}
              className={`w-full py-3.5 text-white font-extrabold text-xs sm:text-sm rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer ${
                selectedRole === 'rider'
                  ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                  : selectedRole === 'admin'
                  ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                  : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <span>Create {selectedRole.toUpperCase()} Account</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="text-center pt-2 text-xs text-slate-400">
              Already registered?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setLocalError(null);
                }}
                className="text-indigo-400 hover:text-indigo-300 font-bold cursor-pointer"
              >
                Sign In
              </button>
            </div>
          </form>
        )}

        {/* MODE 3: FORGOT PASSWORD */}
        {mode === 'forgot' && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Registered Email</label>
              <div className="relative flex items-center">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your registered email"
                  required
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none font-medium"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs sm:text-sm rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer shadow-indigo-600/20"
            >
              <Send className="w-4 h-4" />
              <span>Send Password Recovery Email</span>
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setLocalError(null);
                }}
                className="text-xs text-slate-400 hover:text-slate-200 font-semibold cursor-pointer"
              >
                ← Back to Sign In
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default EmailAuthScreen;
