"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { auth, firebaseEnabled, googleProvider } from "lib/firebase";
import { ensureProfile, fetchProfile, updateNickname, type UserProfile } from "lib/games";

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  enabled: boolean;
  /** A signed-in, non-anonymous (Google) account. */
  loggedIn: boolean;
  /** True when the signed-in account has isAdmin set in Firestore. */
  isAdmin: boolean;
  signIn: () => Promise<void>;
  /** Sign in anonymously (guest) — used to enter online lobbies without a login. */
  signInGuest: () => Promise<User | null>;
  signOutUser: () => Promise<void>;
  saveNickname: (nickname: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  loading: true,
  enabled: false,
  loggedIn: false,
  isAdmin: false,
  signIn: async () => {},
  signInGuest: async () => null,
  signOutUser: async () => {},
  saveNickname: async () => {},
  refreshProfile: async () => {},
});

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseEnabled || !auth) {
      setLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      // Only real (non-anonymous) accounts get a Firestore profile / leaderboard presence.
      if (u && !u.isAnonymous) {
        try {
          setProfile(await ensureProfile(u));
        } catch (e) {
          console.error("Failed to load profile", e);
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const signIn = useCallback(async () => {
    if (!auth) return;
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      console.error("Google sign-in failed", e);
    }
  }, []);

  const signInGuest = useCallback(async () => {
    if (!auth) return null;
    if (auth.currentUser) return auth.currentUser;
    const cred = await signInAnonymously(auth);
    return cred.user;
  }, []);

  const signOutUser = useCallback(async () => {
    if (auth) await signOut(auth);
  }, []);

  const saveNickname = useCallback(
    async (nickname: string) => {
      if (!user) return;
      await updateNickname(user.uid, nickname);
      setProfile((p) => (p ? { ...p, nickname: nickname.trim().slice(0, 16) || "Player" } : p));
    },
    [user]
  );

  const refreshProfile = useCallback(async () => {
    if (user) setProfile(await fetchProfile(user.uid));
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        enabled: firebaseEnabled,
        loggedIn: !!user && !user.isAnonymous,
        isAdmin: !!profile?.isAdmin,
        signIn,
        signInGuest,
        signOutUser,
        saveNickname,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
