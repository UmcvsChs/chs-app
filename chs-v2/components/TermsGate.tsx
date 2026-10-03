"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { termsAcceptanceRequired } from "@/lib/termsVersion";

// Real, global enforcement of the Terms & Conditions, per a direct client
// decision that every user — including every tenant, buyer and guest —
// must be clearly shown the current Terms (term 36, refunds when the
// other party defaults, among them) and accept them.
//
// Why this exists as one global gate rather than more page-by-page
// checks: only seven dashboards (tenant, owner, agent, manager, artisan,
// vendor, admin) ever sent a person to accept the Terms. Buyers, guests,
// hosts, developers, staff and investors had no gate at all — confirmed
// against the live data, where 14 of 35 accounts had never accepted any
// version. Those are exactly the people who pay. One check here covers
// every role and every page.
//
// Public and account-recovery pages are exempt so nobody is ever locked
// out of signing in, reading the Terms, or opening a guarantor link.
const EXEMPT_PREFIXES = [
  "/accept-terms",
  "/terms",
  "/privacy",
  "/login",
  "/register",
  "/forgot-pin",
  "/guarantor-confirm",
  "/invite",
  "/link-account",
  "/admin-approval-pending",
  "/about",
  "/contact",
  "/faq",
  "/blog",
  "/guide",
];

export default function TermsGate({ children }: { children: React.ReactNode }) {
  const { session, profile, loading } = useAuth();
  const pathname = usePathname() || "/";
  const router = useRouter();

  const exempt =
    pathname === "/" ||
    EXEMPT_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const mustAccept = !loading && !!session && !!profile && termsAcceptanceRequired(profile);
  const blocked = mustAccept && !exempt;

  useEffect(() => {
    if (blocked) {
      router.replace(`/accept-terms?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [blocked, pathname, router]);

  // While redirecting, show nothing of the page behind — so no payment
  // button can be pressed in the instant before the Terms appear.
  if (blocked) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">
        Opening the updated Terms &amp; Conditions…
      </div>
    );
  }

  return <>{children}</>;
}
