import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase.ts';

export interface UserProfile {
  id: number;
  uid: string;
  email: string;
  displayName: string | null;
  role: 'citizen' | 'admin' | 'supervisor' | 'worker';
  anonymousPublicId: string;
  municipalityId: number | null;
  phone: string | null;
  isAdmin: boolean;
}

export interface SetupStatus {
  isConfigured: boolean;
  adminCount: number;
  projectId?: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  setupStatus: SetupStatus | null;
  checkingSetup: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  getAuthToken: () => Promise<string | null>;
  refreshProfile: () => Promise<void>;
  refreshSetupStatus: () => Promise<void>;
  completeInitialSetup: (emails: string[]) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [checkingSetup, setCheckingSetup] = useState(true);

  // Check system setup status
  const refreshSetupStatus = async () => {
    try {
      setCheckingSetup(true);
      const res = await fetch('/api/system/setup-status');
      if (res.ok) {
        const data = await res.json();
        setSetupStatus(data);
      }
    } catch (err) {
      console.error('Failed to check setup status:', err);
    } finally {
      setCheckingSetup(false);
    }
  };

  const getAuthToken = async (): Promise<string | null> => {
    if (!auth.currentUser) return null;
    try {
      return await auth.currentUser.getIdToken();
    } catch (err) {
      console.error('Failed to get auth token:', err);
      return null;
    }
  };

  const refreshProfile = async () => {
    const token = await getAuthToken();
    if (!token) {
      setProfile(null);
      return;
    }

    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data.profile);
      }
    } catch (err) {
      console.error('Failed to fetch user profile:', err);
    }
  };

  useEffect(() => {
    refreshSetupStatus();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await refreshProfile();
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleAuthProvider);
      await refreshProfile();
    } catch (err: any) {
      console.error('Google Sign-In failed:', err);
      throw err;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setProfile(null);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const completeInitialSetup = async (emails: string[]) => {
    try {
      const res = await fetch('/api/system/initial-admin-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to configure administrators' };
      }
      await refreshSetupStatus();
      if (auth.currentUser) {
        await refreshProfile();
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network request failed' };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        setupStatus,
        checkingSetup,
        loginWithGoogle,
        logout,
        getAuthToken,
        refreshProfile,
        refreshSetupStatus,
        completeInitialSetup,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
