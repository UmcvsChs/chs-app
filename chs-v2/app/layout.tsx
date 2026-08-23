import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import SplashScreen from "@/components/SplashScreen";
import TestModeBanner from "@/components/TestModeBanner";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";

// CHS's real, established typography — Playfair Display for headings
// (used throughout this whole project's branding work) and Inter for
// body text — loaded via a stylesheet link rather than next/font/google,
// since this avoids a build-time fetch to Google's servers and gives
// identical, predictable results in every environment.

export const metadata: Metadata = {
  title: "CHS — Complete Housing Solutions",
  description: "Complete Housing Solutions — Nigeria's trusted property platform, connecting owners, tenants, buyers, agents, and property managers nationwide",
  // manifest.ts (in this same folder) is automatically linked by
  // Next.js — no manual <link> tag needed for that part.
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
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
