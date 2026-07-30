import Link from "next/link";

// Real Terms & Conditions content, restored exactly from the original
// app — the same real commission rates the client explicitly finalised
// (5%/5.5% rental, 6.5%/6% sale), not approximated from memory.
export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-md mx-auto">
        <Link href="/" className="text-xs text-gray-400 mb-4 inline-block">← Back to homepage</Link>
        <h1 className="font-serif text-2xl font-bold text-chs-charcoal mb-1">📜 Terms & Conditions</h1>
        <p className="text-xs text-gray-400 mb-6">Summary of key terms</p>

        <div className="text-sm text-gray-600 leading-relaxed space-y-3">
          <p><strong className="text-chs-charcoal">1. CHS is a facilitator, not a party to your transaction.</strong> CHS verifies documents, holds funds in escrow, and provides dispute resolution, but the underlying sale/tenancy agreement is between the Owner and the Buyer/Tenant directly.</p>
          <p><strong className="text-chs-charcoal">2. Every transaction started on CHS must be completed on CHS.</strong> Concluding a deal introduced through the platform outside it does not remove CHS&apos;s commission, which remains legally owed.</p>
          <p><strong className="text-chs-charcoal">3. Commission structure.</strong> On a rental or lease, CHS charges 5% from the Tenant and 5.5% from the Landlord/Owner. On a sale, CHS charges 6.5% from the Buyer and 6% from the Owner/Seller. No inspection fee as standard.</p>
          <p><strong className="text-chs-charcoal">4. Honesty and accurate information is mandatory.</strong> Falsified documents or fraudulent listings result in permanent suspension and may be reported to law enforcement.</p>
          <p><strong className="text-chs-charcoal">5. Agents and Property Managers must not extort Users.</strong> No undisclosed fees, caution money, or inspection charges.</p>
          <p><strong className="text-chs-charcoal">6. All funds are held in escrow</strong> until the conditions for release are met.</p>
          <p><strong className="text-chs-charcoal">7. Ownership warranty.</strong> Owners personally warrant they hold clear authority to list or sell a property; for inherited or family property, consent of all co-owners is required.</p>
          <p><strong className="text-chs-charcoal">8. Disputes are resolved through CHS&apos;s internal process first</strong>, before arbitration or the courts of Kaduna State.</p>
          <p><strong className="text-chs-charcoal">9. CHS reserves the right to suspend or terminate</strong> any account found in breach of these terms.</p>

          <div id="referral" className="border-t border-gray-200 pt-4 mt-2">
            <p className="font-bold text-chs-charcoal mb-2">10. How the Agent Referral system works</p>
            <p>Every registered agent has a unique code (e.g. <strong>CHS-AG-0024</strong>), automatically attached to every property link generated from their dashboard.</p>
            <p className="mt-2"><strong className="text-chs-charcoal">Where the link goes.</strong> A referral link always opens the property directly on CHS — never on the agent&apos;s personal page, profile, or any third-party site. This means CHS can verify the transaction and calculate commission accurately, and it means the buyer/tenant always transacts through CHS&apos;s protections (escrow, dispute resolution, document verification), regardless of where they first saw the link.</p>
            <p className="mt-2"><strong className="text-chs-charcoal">Where an agent can share it.</strong> Anywhere the agent already has an audience — their own Facebook page, WhatsApp status, Instagram bio, a physical flyer with a short link, and so on. Sharing the link doesn&apos;t move any part of the transaction off CHS; it only brings the visitor to CHS.</p>
            <p className="mt-2"><strong className="text-chs-charcoal">How commission is credited.</strong> If someone clicks the link, browses, and eventually completes a transaction on that property (rent, sale, or lease), CHS automatically attributes the deal to that agent&apos;s code and credits their commission — no manual claim or extra step required from the agent.</p>
            <p className="mt-2"><strong className="text-chs-charcoal">What this is not.</strong> This is not a way to direct buyers/tenants to complete a deal outside CHS — see term 2 above. Attempting to circumvent CHS after using a referral link is treated the same as any other circumvention attempt.</p>
          </div>

          <p className="text-xs text-gray-400 bg-white rounded-lg p-3 mt-4">
            This is a summary for quick reference. The full CHS Terms & Conditions document is available on request from CHS support.
          </p>
        </div>
      </div>
    </div>
  );
}
