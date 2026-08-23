import Link from "next/link";

// Real Terms & Conditions content, restored exactly from the original
// app — the same real commission rates the client explicitly finalised
// (5%/5.5% rental, 6.5%/6% sale), not approximated from memory.
export default function TermsPage() {
  return (
    <div className="min-h-screen zone-buyer bg-[var(--zone-bg)] px-4 py-8">
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

          <div className="border-t border-gray-200 pt-4 mt-2">
            <p className="font-bold text-chs-charcoal mb-2">10. Sale Approvals checkpoint</p>
            <p>Once an owner accepts a buyer&apos;s offer on a for-sale property, the transaction does not move straight to document submission and escrow payment — CHS first reviews and clears it. This is the real checkpoint between an offer being accepted and money actually moving.</p>
          </div>

          <div className="border-t border-gray-200 pt-4 mt-2">
            <p className="font-bold text-chs-charcoal mb-2">11. Shortlet bookings</p>
            <p>A shortlet booking is paid instantly through your CHS Wallet and held in escrow — not released to the host until your check-in is confirmed. Genuine guest verification (name, phone, valid ID) is required before any booking is confirmed.</p>
          </div>

          <div className="border-t border-gray-200 pt-4 mt-2">
            <p className="font-bold text-chs-charcoal mb-2">12. Wallet freezing</p>
            <p>CHS reserves the right to freeze any wallet pending a genuine investigation into suspected fraud or a policy violation. A frozen wallet is functionally blocked from withdrawal until the matter is resolved.</p>
          </div>

          <div className="border-t border-gray-200 pt-4 mt-2">
            <p className="font-bold text-chs-charcoal mb-2">13. Listing promotion</p>
            <p>Promoting a listing (7-Day Boost, 30-Day Featured, or 90-Day Premium) is a real, paid feature, debited directly from the owner&apos;s wallet at time of purchase.</p>
          </div>

          <div className="border-t border-gray-200 pt-4 mt-2">
            <p className="font-bold text-chs-charcoal mb-2">14. Maintenance Artisans</p>
            <p>For any property under full CHS management, maintenance work is offered first and exclusively to verified CHS Maintenance Agents. For every other property, real quotations are ranked by a transparent formula weighted toward rating and reliability first, experience second, and equipment third. Either the client or the artisan may raise a genuine, two-sided dispute about a completed job.</p>
          </div>

          <div className="border-t border-gray-200 pt-4 mt-2">
            <p className="font-bold text-chs-charcoal mb-2">15. Engaging CHS for a professional service</p>
            <p>Full Property Management, Sale Negotiation, Construction Monitoring, Project Management, and Renovation services each carry their own real, specific Terms &amp; Conditions and fee schedule, which must be reviewed in full and accepted before that service begins. The complete terms for every service are available in the full CHS Terms &amp; Conditions document.</p>
          </div>

          <div id="referral" className="border-t border-gray-200 pt-4 mt-2">
            <p className="font-bold text-chs-charcoal mb-2">16. How the Agent Referral system works</p>
            <p>Every registered agent has a unique code (e.g. <strong>CHS-AG-0024</strong>), automatically attached to every property link generated from their dashboard.</p>
            <p className="mt-2"><strong className="text-chs-charcoal">Where the link goes.</strong> A referral link always opens the property directly on CHS — never on the agent&apos;s personal page, profile, or any third-party site. This means CHS can verify the transaction and calculate commission accurately, and it means the buyer/tenant always transacts through CHS&apos;s protections (escrow, dispute resolution, document verification), regardless of where they first saw the link.</p>
            <p className="mt-2"><strong className="text-chs-charcoal">Where an agent can share it.</strong> Anywhere the agent already has an audience — their own Facebook page, WhatsApp status, Instagram bio, a physical flyer with a short link, and so on. Sharing the link doesn&apos;t move any part of the transaction off CHS; it only brings the visitor to CHS.</p>
            <p className="mt-2"><strong className="text-chs-charcoal">How commission is credited.</strong> If someone clicks the link, browses, and eventually completes a transaction on that property (rent, sale, or lease), CHS automatically attributes the deal to that agent&apos;s code and credits their commission — no manual claim or extra step required from the agent.</p>
            <p className="mt-2"><strong className="text-chs-charcoal">What this is not.</strong> This is not a way to direct buyers/tenants to complete a deal outside CHS — see term 2 above. Attempting to circumvent CHS after using a referral link is treated the same as any other circumvention attempt.</p>
          </div>

          <div className="border-t border-gray-200 pt-4 mt-2">
            <p className="font-bold text-chs-charcoal mb-2">17. Credit-based listing promotion</p>
            <p>As an alternative to the fixed-tier promotion in term 13, an owner or agent may purchase reusable promotion credits (₦400 each) and apply them to any listing they own. Turning promotion on for a listing consumes a real number of credits per day, varying by the property&apos;s location and size — this cost is disclosed before activation and may change as CHS adjusts location-tier pricing. Promotion can be turned off at any time at no further cost, and unused credits remain available indefinitely for use on any current or future listing. A promoted listing is assigned a ranking category based on real, comparative spend against other promoted listings in the same real local market, recalculated daily.</p>
          </div>

          <div className="border-t border-gray-200 pt-4 mt-2">
            <p className="font-bold text-chs-charcoal mb-2">18. Urgent & Emergency Sale</p>
            <p>A property may be listed under Urgent & Emergency Sale only once it is already CHS Verified and its owner is ID-verified. The owner must set a genuine original price higher than the current listed price, and a genuine deadline; both are shown to prospective buyers. CHS is notified the moment a listing is activated under this category and may contact the owner or buyer directly to assist. An Urgent Sale listing automatically reverts to a standard sale listing once its deadline passes, unless renewed by the owner. Misrepresenting the urgency, the discount, or the deadline is treated as providing falsified information under term 4.</p>
          </div>

          <div className="border-t border-gray-200 pt-4 mt-2">
            <p className="font-bold text-chs-charcoal mb-2">19. Concierge requests (&quot;Talk to an Agent&quot;)</p>
            <p>A user may submit a free-form request describing a property need, by text or voice, in place of using the standard search tools. CHS reviews these requests directly and may follow up by phone or in-app message. Submitting a concierge request does not guarantee a match is found, and does not change any other term of this agreement once a matching property is pursued.</p>
          </div>

          <div className="border-t border-gray-200 pt-4 mt-2">
            <p className="font-bold text-chs-charcoal mb-2">20. Wallet-to-wallet transfers</p>
            <p>A user may transfer wallet funds directly to another CHS user, identified by their registered phone number or email. A transfer cannot be sent to oneself, cannot exceed the sender&apos;s available balance, and cannot be sent from or to a frozen wallet. A completed transfer is final. CHS is not responsible for funds sent to the wrong recipient due to a user-entered error, though CHS support may be contacted to investigate.</p>
          </div>

          <p className="text-xs text-gray-400 bg-[var(--zone-card)] rounded-lg p-3 mt-4">
            This is a summary for quick reference. The full CHS Terms & Conditions document is available on request from CHS support.
          </p>
        </div>
      </div>
    </div>
  );
}
