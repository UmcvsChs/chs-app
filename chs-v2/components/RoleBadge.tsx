"use client";

import { useAuth } from "@/contexts/AuthContext";

// Real, new fix per direct client feedback from live testing: testing
// multiple accounts across browser tabs made it genuinely easy to
// lose track of which real dashboard — and which role — you were
// looking at. A small, consistent, bold badge on every dashboard
// header, so the role is unmistakable at a glance, on top of the
// zone background color each dashboard already carries.
//
// Real, direct extension per a second, equally real round of client
// confusion while testing multiple demo accounts side by side: the
// role alone ("Owner Dashboard") wasn't enough once several real
// accounts shared the same role — the real, logged-in phone number
// is now shown directly beneath it, on every one of these badges
// across the whole app, fixed once here rather than in each of the
// real dashboards individually. Reads directly from the real,
// already-loaded session — no extra prop needed anywhere this
// component is already used.
export default function RoleBadge({ label }: { label: string }) {
  const { profile } = useAuth();
  return (
    <span className="inline-flex flex-col items-start mt-1">
      <span className="bg-white/20 text-white text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full">
        {label}
      </span>
      {profile?.phone && (
        <span className="text-white/70 text-[9px] font-medium mt-0.5 ml-0.5">
          Logged in as {profile.phone}
        </span>
      )}
    </span>
  );
}
