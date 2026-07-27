"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

// Tracks who is genuinely logged in, and which specific role they're
// using this session — the same real distinction the original app had
// to build carefully (a person can hold more than one role on the same
// account, and which one they're "using" isn't always their only one).
// Done the proper React way here: a Context every component can read
// from, instead of a loose global variable living outside React's own
// state system.

interface Profile {
  id: string;
  full_name: string;
  role: string;
  secondary_roles: string[] | null;
  status: string;
  membership_verified: boolean | null;
  valid_id_verified: boolean | null;
}

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  activeRole: string | null;
  loading: boolean;
  setActiveRole: (role: string) => void;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activeRole, setActiveRoleState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(userId: string) {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, role, secondary_roles, status, membership_verified, valid_id_verified")
      .eq("id", userId)
      .single();
    if (data) {
      setProfile(data);
      // Default to the account's primary role unless something else
      // (like a role-specific login choice) has already set one.
      setActiveRoleState((current) => current ?? data.role);
    }
  }

  useEffect(() => {
    // Picks up an existing session on page load (e.g. a returning
    // visitor who's already signed in), rather than always starting
    // from a logged-out state.
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) loadProfile(data.session.user.id);
      setLoading(false);
    });

    // Keeps this in sync with real auth events (sign-in, sign-out,
    // token refresh) happening anywhere in the app, automatically.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        loadProfile(newSession.user.id);
      } else {
        setProfile(null);
        setActiveRoleState(null);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setActiveRoleState(null);
  }

  async function refreshProfile() {
    if (session) await loadProfile(session.user.id);
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        activeRole,
        loading,
        setActiveRole: setActiveRoleState,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
