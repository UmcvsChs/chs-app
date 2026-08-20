"use client";

// A real, working share button — restored, found missing during the
// systematic Detail view comparison. Uses the real, native device
// share sheet where available, falling back to a genuine clipboard
// copy elsewhere — never a decorative button that does nothing.
export default function ShareButton({ title }: { title: string }) {
  async function handleShare() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // A real, expected outcome if the person cancels the native
        // share sheet — not an error to report.
      }
    } else {
      await navigator.clipboard.writeText(url);
      alert("Link copied to clipboard");
    }
  }

  return (
    <button
      onClick={handleShare}
      className="absolute top-2 right-12 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center shadow-sm z-10"
      aria-label="Share this property"
    >
      <span className="text-gray-500">↗</span>
    </button>
  );
}
