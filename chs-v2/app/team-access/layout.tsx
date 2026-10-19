import type { Metadata } from "next";

// Staff and admin door. Kept out of search engines; not linked from anywhere
// in the public app.
export const metadata: Metadata = {
  title: "CHS Team",
  robots: { index: false, follow: false },
};

export default function TeamAccessLayout({ children }: { children: React.ReactNode }) {
  return children;
}
