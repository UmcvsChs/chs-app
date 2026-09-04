"use client";

import Link from "next/link";

// Real, new page completing item #6 — a brand new artisan, market
// seller, or other service provider previously had no way to even
// discover CHS supported them, since both real application forms
// already existed but were never reachable from the main
// registration flow. This is the real, missing bridge between them.
export default function ChooseCategoryPage() {
  return (
    <div className="min-h-screen bg-[var(--zone-bg)] px-4 py-8 flex flex-col items-center justify-center">
      <div className="max-w-md w-full">
        <h1 className="font-serif text-xl font-bold text-chs-charcoal text-center mb-2">Welcome to CHS</h1>
        <p className="text-sm text-gray-500 text-center mb-6">Your account is ready — now tell us what you actually do, so we can set up the right real profile for you.</p>

        <Link href="/become-artisan" className="block bg-white rounded-xl border-2 border-gray-200 p-4 mb-3 hover:border-chs-red">
          <p className="text-sm font-bold text-chs-charcoal">🔧 I&apos;m an Artisan</p>
          <p className="text-xs text-gray-500 mt-1">Plumbing, electrical, carpentry, painting, and other real trade skills.</p>
        </Link>

        <Link href="/become-vendor" className="block bg-white rounded-xl border-2 border-gray-200 p-4 mb-3 hover:border-chs-red">
          <p className="text-sm font-bold text-chs-charcoal">🛍️ I sell products or offer a service</p>
          <p className="text-xs text-gray-500 mt-1">Bedding, furniture, electronics, cleaning, security, and other real marketplace categories.</p>
        </Link>

        <Link href="/" className="block text-center text-xs text-gray-400 mt-4">
          Not now — take me to the homepage
        </Link>
      </div>
    </div>
  );
}
