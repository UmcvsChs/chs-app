import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import AccountStatusGate from "@/components/AccountStatusGate";
import { ThemeProvider } from "@/contexts/ThemeContext";
import SplashScreen from "@/components/SplashScreen";
import TestModeBanner from "@/components/TestModeBanner";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";

// CHS's real, established typography — Playfair Display for headings
// (used throughout this whole project's branding work) and Inter for
// body text — loaded via a stylesheet link rather than next/font/google,
// since this avoids a build-time fetch to Google's servers and gives
// identical, predictable results in every environment.

// The real, missing fix confirmed by direct user testing on multiple
// real phones: without this, a mobile browser assumes the page is a
// ~980px desktop layout and shrinks the whole thing to fit the real
// screen, rather than genuinely rendering at native mobile width —
// producing exactly the squeezed-content-with-blank-space symptom
// reported. This is the one, real, standard fix for that entire class
// of "looks fine on a laptop, broken on every real phone" bug.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#1E1B16",
};

export const metadata: Metadata = {
  title: "CHS — Complete Housing Solutions",
  description: "Complete Housing Solutions — Nigeria's trusted property platform, connecting owners, tenants, buyers, agents, and property managers nationwide",
  // manifest.ts (in this same folder) is automatically linked by
  // Next.js — no manual <link> tag needed for that part.
  // Real, necessary fix found while preparing real iPhone testing
  // instructions: no apple-touch-icon existed at all, meaning "Add to
  // Home Screen" on a real iPhone would have used a generic or
  // screenshot-based icon instead of the real CHS logo.
  icons: {
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    // iOS Safari doesn't use the manifest for its own home-screen
    // install prompt the way Android does — this is the real, separate
    // setting iOS specifically needs for "Add to Home Screen" to work
    // properly there too.
    capable: true,
    statusBarStyle: "black-translucent",
    title: "CHS",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col font-sans bg-background text-foreground">
        <ThemeProvider>
          <ServiceWorkerRegistration />
          <SplashScreen />
          <AuthProvider>
            <TestModeBanner />
            <AccountStatusGate>{children}</AccountStatusGate>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
