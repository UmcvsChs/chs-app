import Link from "next/link";

// Real About Us content, restored exactly from the original app,
// including the actual, real company registration details.
export default function AboutPage() {
  return (
    <div className="min-h-screen zone-buyer bg-[var(--zone-bg)] px-4 py-8">
      <div className="max-w-md mx-auto">
        <Link href="/" className="text-xs text-gray-400 mb-4 inline-block">← Back to homepage</Link>

        <div className="text-center mb-6">
          <h1 className="font-serif text-2xl font-bold text-chs-red">Complete Housing Solutions</h1>
          <p className="text-xs text-gray-400 italic mt-1">Your property, our commitment</p>
        </div>

        <p className="text-sm text-gray-600 leading-relaxed mb-4">
          CHS is a digital property platform connecting property owners, tenants, buyers, agents, and property managers across Nigeria. Every property listed goes through document verification with the relevant state land registry before it can be transacted on, and every payment is protected through CHS&apos;s escrow system.
        </p>

        <div className="bg-[var(--zone-card)] rounded-xl p-4 mb-3">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-2">Company details</p>
          <p className="text-xs text-gray-600 leading-relaxed">
            Operated by: Complete Comprehensive Concepts<br />
            BN Registration: 3568074 (CAC registered 8 Feb 2022)<br />
            TIN: 2621880600961<br />
            Address: 9 Tudun Wada, Bagado Street, Kamazau, Kaduna
          </p>
        </div>

        <p className="text-[10px] text-gray-400 leading-relaxed">
          CHS started in Kaduna State and is built to expand nationwide as verification infrastructure grows in each state.
        </p>
      </div>
    </div>
  );
}
