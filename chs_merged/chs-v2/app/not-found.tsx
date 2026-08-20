import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-6 bg-gray-50">
      <p className="font-serif text-2xl font-bold text-chs-charcoal mb-2">Not found</p>
      <p className="text-sm text-gray-500 mb-6">
        This page — or this property — doesn&apos;t exist, or may have been removed.
      </p>
      <Link
        href="/"
        className="text-sm font-semibold text-white bg-chs-red px-5 py-2.5 rounded-full"
      >
        Back to homepage
      </Link>
    </div>
  );
}
