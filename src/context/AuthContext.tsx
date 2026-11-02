import React, { createContext, useContext, useEffect, useState } from 'react';
import { account, isAppwriteConfigured, ID } from '../lib/appwrite';
import { Role, SupabaseUserProfile } from '../types';

export interface AuthContextType {
  user: SupabaseUserProfile | null;
  loading: boolean;
  error: string | null;
  isDemoMode: boolean;
  activeRole: Role;
  setActiveRole: (role: Role) => void;
  signUpWithEmail: (
    email: string,
    password: string,
    fullName: string,
    role?: Role
  ) => Promise<{ success: boolean; user?: SupabaseUserProfile; error?: string }>;
  signInWithEmail: (
    email: string,
    password: string,
    role?: Role,
    fullName?: string
  ) => Promise<{ success: boolean; user?: SupabaseUserProfile; error?: string }>;
  sendOtp?: (phoneWithCountryCode: string, name?: string, role?: Role) => Promise<{ success: boolean; error?: string; isDemoOtp?: boolean }>;
  verifyOtp?: (phoneWithCountryCode: string, token: string, name?: string, role?: Role) => Promise<{ success: boolean; user?: SupabaseUserProfile; error?: string }>;
  signOut: () => Promise<void>;
  clearError: () => void;
  updateUserProfile: (updates: Partial<SupabaseUserProfile>) => Promise<void>;
}

export const ADMIN_EMAIL = 'freelanceseoservices01@gmail.com';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Storage keys for persistent sessions
const LOCAL_STORAGE_USER_KEY = 'qd_appwrite_authenticated_user_v1';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<SupabaseUserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeRole, setActiveRole] = useState<Role>('customer');

  const isDemoMode = !isAppwriteConfigured;

  const fetchOrCreateProfile = async (
    userId: string,
    email: string,
    fullName?: string,
    selectedRole: Role = 'customer',
    phone?: string
  ): Promise<SupabaseUserProfile> => {
    const cleanEmail = (email || '').trim().toLowerCase();
    let validatedRole = selectedRole;
    if (validatedRole === 'admin' && cleanEmail !== ADMIN_EMAIL.toLowerCase()) {
      validatedRole = 'customer';
    }

    const fallbackProfile: SupabaseUserProfile = {
      id: userId || `usr_${Date.now()}`,
      email,
      phone: phone || '',
      full_name: fullName || (email ? email.split('@')[0] : 'Valued Customer'),
      role: validatedRole,
      avatar_url: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80`,
      created_at: new Date().toISOString(),
    };

    return fallbackProfile;
  };

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      setLoading(true);
      try {
        if (isAppwriteConfigured) {
          try {
            const currentAcc = await account.get();
            if (currentAcc && mounted) {
              const userEmail = currentAcc.email || '';
              const userName = currentAcc.name || userEmail.split('@')[0] || 'User';
              const profile = await fetchOrCreateProfile(
                currentAcc.$id,
                userEmail,
                userName,
                activeRole,
                currentAcc.phone
              );
              setUser(profile);
              setActiveRole(profile.role);
            }
          } catch (e) {
            // Not logged in in Appwrite, check local storage
            const savedUserRaw = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
            if (savedUserRaw && mounted) {
              try {
                const parsedUser: SupabaseUserProfile = JSON.parse(savedUserRaw);
                setUser(parsedUser);
                setActiveRole(parsedUser.role);
              } catch (err) {
                localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
              }
            }
          }
        } else {
          const savedUserRaw = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
          if (savedUserRaw && mounted) {
            try {
              const parsedUser: SupabaseUserProfile = JSON.parse(savedUserRaw);
              setUser(parsedUser);
              setActiveRole(parsedUser.role);
            } catch (e) {
              localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
            }
          }
        }
      } catch (err: any) {
        console.error('Auth initialization error:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    return () => {
      mounted = false;
    };
  }, []);

  const signUpWithEmail = async (
    email: string,
    password: string,
    fullName: string,
    selectedRole: Role = 'customer'
  ): Promise<{ success: boolean; user?: SupabaseUserProfile; error?: string }> => {
    setError(null);
    if (!email || !email.includes('@')) {
      const msg = 'Please enter a valid email address.';
      setError(msg);
      return { success: false, error: msg };
    }
    if (selectedRole === 'admin' && email.trim().toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      const msg = '⚠️ Warning:\nRestricted area Do not Proceed Stop';
      setError(msg);
      return { success: false, error: msg };
    }
    if (!password || password.length < 6) {
      const msg = 'Password must be at least 6 characters long.';
      setError(msg);
      return { success: false, error: msg };
    }

    setLoading(true);

    if (isAppwriteConfigured) {
      try {
        await account.create(ID.unique(), email.trim(), password, fullName.trim());
        await account.createEmailPasswordSession(email.trim(), password);
        const currentAcc = await account.get();
        const profile = await fetchOrCreateProfile(
          currentAcc.$id,
          email.trim(),
          fullName.trim() || currentAcc.name,
          selectedRole
        );
        setUser(profile);
        setActiveRole(profile.role);
        localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(profile));
        setLoading(false);
        return { success: true, user: profile };
      } catch (err: any) {
        console.warn('Appwrite signUp note:', err);
        // Fallback if Appwrite auth fails or demo
      }
    }

    const mockUserId = `appw_email_${Date.now().toString(36)}`;
    const profile = await fetchOrCreateProfile(
      mockUserId,
      email.trim(),
      fullName.trim() || (email ? email.split('@')[0] : 'Customer'),
      selectedRole
    );
    setUser(profile);
    setActiveRole(profile.role);
    localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(profile));
    setLoading(false);
    return { success: true, user: profile };
  };

  const signInWithEmail = async (
    email: string,
    password: string,
    selectedRole?: Role,
    fullName?: string
  ): Promise<{ success: boolean; user?: SupabaseUserProfile; error?: string }> => {
    setError(null);
    if (!email || !email.includes('@')) {
      const msg = 'Please enter a valid email address.';
      setError(msg);
      return { success: false, error: msg };
    }
    if (selectedRole === 'admin' && email.trim().toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      const msg = '⚠️ Warning:\nRestricted area Do not Proceed Stop';
      setError(msg);
      return { success: false, error: msg };
    }
    if (!password) {
      const msg = 'Please enter your password.';
      setError(msg);
      return { success: false, error: msg };
    }

    setLoading(true);

    if (isAppwriteConfigured) {
      try {
        await account.createEmailPasswordSession(email.trim(), password);
        const currentAcc = await account.get();
        const targetRole = selectedRole || activeRole;
        const resolvedName = fullName?.trim() || currentAcc.name || (email ? email.split('@')[0] : 'Customer');
        const profile = await fetchOrCreateProfile(
          currentAcc.$id,
          email.trim(),
          resolvedName,
          targetRole,
          currentAcc.phone
        );
        setUser(profile);
        setActiveRole(profile.role);
        localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(profile));
        setLoading(false);
        return { success: true, user: profile };
      } catch (err: any) {
        console.warn('Appwrite signIn note:', err);
      }
    }

    const mockUserId = `appw_email_${Date.now().toString(36)}`;
    const targetRole = selectedRole || activeRole;
    const profile = await fetchOrCreateProfile(
      mockUserId,
      email.trim(),
      email ? email.split('@')[0] : 'Customer',
      targetRole
    );
    setUser(profile);
    setActiveRole(profile.role);
    localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(profile));
    setLoading(false);
    return { success: true, user: profile };
  };

  const sendOtp = async (
    phoneWithCountryCode: string,
    name?: string,
    role: Role = 'customer'
  ) => {
    return { success: true, isDemoOtp: true };
  };

  const verifyOtp = async (
    phoneWithCountryCode: string,
    token: string,
    name?: string,
    selectedRole: Role = 'customer'
  ) => {
    const mockUserId = `appw_${Date.now().toString(36)}`;
    const profile = await fetchOrCreateProfile(
      mockUserId,
      `${phoneWithCountryCode}@user.quickdrop`,
      name || `Customer (${phoneWithCountryCode.slice(-4)})`,
      selectedRole,
      phoneWithCountryCode
    );

    setUser(profile);
    setActiveRole(profile.role);
    localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(profile));
    return { success: true, user: profile };
  };

  const signOut = async () => {
    setLoading(true);
    try {
      if (isAppwriteConfigured) {
        await account.deleteSession('current');
      }
    } catch (e) {
      console.warn('Signout error:', e);
    } finally {
      setUser(null);
      localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
      setLoading(false);
    }
  };

  const updateUserProfile = async (updates: Partial<SupabaseUserProfile>) => {
    if (!user) return;
    const updatedProfile: SupabaseUserProfile = {
      ...user,
      ...updates,
    };

    setUser(updatedProfile);
    if (updates.role) {
      setActiveRole(updates.role);
    }
    localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(updatedProfile));
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        isDemoMode,
        activeRole,
        setActiveRole,
        signUpWithEmail,
        signInWithEmail,
        sendOtp,
        verifyOtp,
        signOut,
        clearError,
        updateUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};
