"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

// Pre-launch admin testing tool ONLY — see the real note in
// AuthContext.tsx. This banner exists specifically so nobody can be in
// test mode without it being completely obvious, on every single
// screen, the whole time.
export default function TestModeBanner() {
  const router = useRouter();
  const { testModeRole, setTestModeRole, profile } = useAuth();

  // A TEST/DEMO account (flagged in the database) always shows an amber
  // strip on every screen, so nobody mistakes it for a real customer.
  if (!testModeRole && profile?.is_test) {
    return (
      <div className="sticky top-0 z-[997] bg-amber-500 text-black text-[11px] font-bold px-4 py-1 text-center">
        🧪 TEST ACCOUNT — practice data and test money, not a real customer
      </div>
    );
  }
  if (!testModeRole) return null;

  return (
    <div className="sticky top-0 z-[998] bg-amber-500 text-black text-xs font-bold px-4 py-2 flex items-center justify-between">
      <span>🧪 TEST MODE — Viewing the {testModeRole} dashboard as yourself, not a real user</span>
      <button
        onClick={() => {
          setTestModeRole(null);
          router.push("/admin");
        }}
        className="ml-3 shrink-0 px-3 py-1 rounded-full bg-black text-amber-400 text-[10px]"
      >
        Exit Test Mode
      </button>
    </div>
  );
}
