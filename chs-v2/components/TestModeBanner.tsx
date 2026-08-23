"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

// Pre-launch admin testing tool ONLY — see the real note in
// AuthContext.tsx. This banner exists specifically so nobody can be in
// test mode without it being completely obvious, on every single
// screen, the whole time.
export default function TestModeBanner() {
  const router = useRouter();
  const { testModeRole, setTestModeRole } = useAuth();

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
