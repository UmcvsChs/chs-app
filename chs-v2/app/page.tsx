export default function Home() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-chs-steel-blue via-chs-charcoal to-chs-amber text-white px-6 text-center">
      <div className="mb-6 flex items-center justify-center w-24 h-24 rounded-3xl bg-black/20 border border-white/20">
        <span className="font-serif text-4xl font-bold">CHS</span>
      </div>
      <h1 className="font-serif text-2xl font-bold mb-2">Complete Housing Solutions</h1>
      <p className="text-sm text-white/70 italic mb-8">Your property, our commitment</p>
      <p className="text-xs text-white/50 max-w-xs">
        This is the foundation of the new, properly structured build — real features are being
        added here one at a time, starting with the public homepage.
      </p>
    </main>
  );
}
