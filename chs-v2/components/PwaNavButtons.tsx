"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

// When CHS runs from the home-screen icon (iPhone "Add to Home Screen" or the
// Android app) there is no browser Back button, so a page without its own
// Back link is a dead end. This adds two small round buttons, Back and Home,
// on every page except the home page and the login/register screens.
// In a normal browser tab it shows nothing (the browser has its own Back).
export default function PwaNavButtons() {
  const router = useRouter();
  const path = usePathname();
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    const nav = window.navigator as Navigator & { standalone?: boolean };
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStandalone(isStandalone);
  }, []);

  if (!standalone) return null;
  if (path === "/" || path === "/login" || path === "/team-access" || path === "/register" || path === "/admin-approval-pending") return null;

  const btn = "w-10 h-10 rounded-full bg-chs-charcoal/90 text-white text-lg shadow-lg flex items-center justify-center";
  return (
    <div className="fixed left-3 z-[900] flex gap-2" style={{ bottom: "calc(env(safe-area-inset-bottom) + 76px)" }}>
      <button aria-label="Back" onClick={() => router.back()} className={btn}>←</button>
      <button aria-label="Home" onClick={() => router.push("/")} className={btn}>⌂</button>
    </div>
  );
}
