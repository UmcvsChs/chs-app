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
  state: string;
  secondary_roles: string[] | null;
  status: string;
  suspension_reason: string | null;
  membership_verified: boolean | null;
  valid_id_verified: boolean | null;
  avatar_url: string | null;
  is_super_admin: boolean;
  staff_role: string | null;
  terms_accepted_at: string | null;
  guide_roles_seen: string[];
  chs_agent_id: string | null;
}

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  activeRole: string | null;
  loading: boolean;
  setActiveRole: (role: string) => void;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  // Pre-launch admin testing tool ONLY — lets the super admin preview
  // any role's real dashboard using their OWN account (never another
  // real person's data), so testing a new feature doesn't require
  // logging out and back in as a different account. This has no
  // purpose once CHS is actually live and should be removed at that
  // point, not left lingering — flagged here and in every place it's
  // used, not just this one comment.
  testModeRole: string | null;
  setTestModeRole: (role: string | null) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activeRole, setActiveRoleState] = useState<string | null>(null);
  const [testModeRole, setTestModeRoleState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Deliberately real React state, not persisted anywhere (not
  // localStorage, not the database) — resets on every real page
  // refresh, so nobody stays in test mode by accident across sessions.
  // Enforced here too, not just in the UI that triggers it — only a
  // genuine super admin can ever actually set this.
  function setTestModeRole(role: string | null) {
    if (role !== null && !profile?.is_super_admin) return;
    setTestModeRoleState(role);
  }

  async function loadProfile(userId: string) {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, role, state, secondary_roles, status, suspension_reason, membership_verified, valid_id_verified, avatar_url, is_super_admin, staff_role, terms_accepted_at, guide_roles_seen, chs_agent_id")
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
        testModeRole,
        setTestModeRole,
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
