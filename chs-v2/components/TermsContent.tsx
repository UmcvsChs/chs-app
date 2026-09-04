// The single real source of the Terms & Conditions body — shared
// between the browsable /terms page and the scroll-to-accept gate at
// /accept-terms, so both always show the exact same real content
// rather than two copies that could drift apart.
export default function TermsContent() {
  return (
    <div className="text-sm text-gray-600 leading-relaxed space-y-3">
      <p><strong className="text-chs-charcoal">1. CHS is a facilitator, not a party to your transaction.</strong> CHS verifies documents, holds funds in escrow, and provides dispute resolution, but the underlying sale/tenancy agreement is between the Owner and the Buyer/Tenant directly.</p>
      <p><strong className="text-chs-charcoal">2. Every transaction started on CHS must be completed on CHS.</strong> Concluding a deal introduced through the platform outside it does not remove CHS&apos;s commission, which remains legally owed.</p>
      <p><strong className="text-chs-charcoal">3. Commission structure.</strong> CHS&apos;s real commission varies by category, always split between both sides of the transaction:</p>
      <ul className="list-disc pl-5 space-y-1">
        <li><strong className="text-chs-charcoal">Residential/Commercial Rental or Lease</strong> (houses, offices, shops, warehouses, factories, land leased long-term): 6% from the Tenant/Lessee, 4% from the Landlord/Owner. From the second year of the same tenancy onward, the tenant pays no further commission at all — only the landlord, at a real, reduced 3%.</li>
        <li><strong className="text-chs-charcoal">Sale</strong> (houses, land, warehouses, factories, or any property sold outright): 6.5% from the Buyer, 6% from the Seller.</li>
        <li><strong className="text-chs-charcoal">Rent to Own / Mortgage</strong>: 5% from the Buyer, 5.5% from the Seller, charged on every real monthly installment as it&apos;s paid — not on the total price upfront.</li>
        <li><strong className="text-chs-charcoal">Shortlet</strong> (genuine short-term apartment/house stays): a real sliding scale by length of stay — 1–3 nights: 7% Guest / 5% Host; 4–13 nights: 6% Guest / 4% Host; 14+ nights: 5% Guest / 3% Host.</li>
        <li><strong className="text-chs-charcoal">Hotel &amp; Lodge, Event Centre, and casual/hourly Car Park bookings</strong>: a flat 6% from the Guest, 4% from the Host, regardless of duration.</li>
        <li><strong className="text-chs-charcoal">Agent-managed listings</strong>: a real, independent agent who brings full management authority to a property may set their own commission rate with their client (matching real market practice). In this arrangement, CHS charges neither the buyer/tenant nor the owner directly — instead, CHS takes a real, capped 3% only from the agent&apos;s own commission earnings, once paid.</li>
      </ul>
      <p>No inspection fee as standard.</p>
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
        <p>As an alternative to the fixed-tier promotion in term 13, an owner or agent may purchase reusable promotion credits (₦400 each) and apply them to any listing they own, or subscribe to a monthly package (Classic, Premium, Elite, or Signature) which includes bonus credits and additional placement benefits.</p>
        <p className="mt-2"><strong className="text-chs-charcoal">Credits are one shared balance across every listing you own — not split per listing.</strong> Each listing you turn ON is charged separately, every real day it stays on, all from that same one balance. If you turn on multiple listings at once, you pay for each of them that day. There is no fixed daily limit — your real total simply depends on how many listings you keep active and each one&apos;s own real cost.</p>
        <p className="mt-2"><strong className="text-chs-charcoal">Daily cost per listing</strong> is calculated from that specific property&apos;s real location and size, disclosed on the promotion screen before you turn it on or buy any credits. Turning promotion off costs nothing further, and you are never charged for a day it was off.</p>
        <p className="mt-2"><strong className="text-chs-charcoal">Ranking (Category A–D, and a literal Top 10/Top 20 position)</strong> is based on real, comparative spend against other promoted listings in the same real local market (same state, similar area type, same property type and size), recalculated daily. A higher position reflects relatively higher spend within that specific comparison group — it is not a separate purchase on top of your credits.</p>
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

      <div className="border-t border-gray-200 pt-4 mt-2">
        <p className="font-bold text-chs-charcoal mb-2">21. Construction Roadmap access</p>
        <p>Accessing a Construction Roadmap (real quantities, permits checklist, and payment plan for a specific building configuration) requires a one-time access fee, credited in full toward the real project cost if the client proceeds with CHS for construction. Cost figures shown are a general market estimate, not a firm CHS quotation, until CHS&apos;s own verified rates are available for that configuration.</p>
      </div>

      <div className="border-t border-gray-200 pt-4 mt-2">
        <p className="font-bold text-chs-charcoal mb-2">22. Rent to Own / Mortgage</p>
        <p>A buyer may request a Rent to Own / Mortgage agreement on any property listed under that category; the owner must approve the request before it begins. Each real monthly installment is paid through the CHS Wallet directly to the owner, and genuinely builds toward full ownership at the real percentage disclosed on the listing. Once 100% ownership is reached, the property automatically converts to a completed sale — this is irreversible and does not require a further approval step.</p>
      </div>

      <div className="border-t border-gray-200 pt-4 mt-2">
        <p className="font-bold text-chs-charcoal mb-2">23. Estate Management subscription</p>
        <p>A property manager overseeing a bounded estate of units may subscribe to CHS&apos;s Estate Management tools for a real, tiered monthly fee based on real unit count. This subscription fee is CHS&apos;s own charge for the tools and automation provided — it is entirely separate from, and does not include, any real service charges the estate manager collects from residents, which remain the estate manager&apos;s own revenue.</p>
      </div>

      <div className="border-t border-gray-200 pt-4 mt-2">
        <p className="font-bold text-chs-charcoal mb-2">24. Shortlet and Hotel guest-host messaging</p>
        <p>Guests and hosts may communicate directly in-app for the duration of a real booking. A host may remain anonymous to the guest — CHS never discloses a host&apos;s real identity to a guest without the host&apos;s consent — but a host is never anonymous to CHS itself. If a genuine guest message goes unanswered for an extended period, CHS may contact the host directly to intervene, using contact information CHS holds regardless of the anonymity shown to the guest.</p>
      </div>

      <div className="border-t border-gray-200 pt-4 mt-2">
        <p className="font-bold text-chs-charcoal mb-2">25. Maintenance Reserve</p>
        <p>An owner&apos;s Maintenance Reserve may be funded directly from their own Main Wallet at any time, in addition to whatever automatic allocation already applies. When a maintenance job is confirmed complete, payment is drawn from the Maintenance Reserve first; any real shortfall is drawn from the Main Wallet. Unused Maintenance Reserve funds may be withdrawn back to the Main Wallet by the owner at any time, without requiring CHS approval.</p>
      </div>

      <div className="border-t border-gray-200 pt-4 mt-2">
        <p className="font-bold text-chs-charcoal mb-2">26. Sale payment and total due</p>
        <p>Once a seller accepts an offer, the buyer&apos;s real total due is calculated automatically and shown before payment: the accepted price, the buyer&apos;s commission (both the percentage and the real Naira value shown), and the combined total. This total is charged in a single transaction — CHS does not charge the purchase price and commission separately. The seller likewise sees, in advance, the real net amount they will receive after their own commission is deducted.</p>
      </div>

      <div className="border-t border-gray-200 pt-4 mt-2">
        <p className="font-bold text-chs-charcoal mb-2">27. Required legal documents for a Sale listing</p>
        <p>Before listing a property under Sale, an owner must upload soft copies of the real legal documents required to transfer ownership under Nigerian law: Certificate of Occupancy, Deed of Assignment, Survey Plan, Governor&apos;s Consent, Tax Clearance Certificate, and Sale Agreement — plus Building Plan Approval where the property includes a real structure. CHS independently verifies each document. A buyer&apos;s payment cannot proceed until every required document for that property has been confirmed verified by CHS.</p>
      </div>

      <div className="border-t border-gray-200 pt-4 mt-2">
        <p className="font-bold text-chs-charcoal mb-2">28. Escrow hold on sale proceeds</p>
        <p>When a buyer completes payment for a property, the seller&apos;s net proceeds are immediately visible in their CHS Wallet, but held and not withdrawable. Funds are released to the seller&apos;s spendable balance only once CHS confirms that the real, physical legal documents — Deed of Assignment, Certificate of Occupancy, and all other required documents — have genuinely been prepared (through a qualified barrister where required) and delivered to the new owner. This protection exists to ensure a buyer receives real, complete legal ownership before a seller can access sale proceeds.</p>
      </div>

      <div className="border-t border-gray-200 pt-4 mt-2">
        <p className="font-bold text-chs-charcoal mb-2">29. Non-renewal notice</p>
        <p>A tenant who does not intend to renew their tenancy should give notice at least 90 real days before their lease end date. CHS displays a real, live countdown to lease end on the tenant&apos;s dashboard, and highlights this window as it approaches. Notice given after this window is still recorded and forwarded to the landlord, honestly noted as later than the requested period, rather than refused.</p>
      </div>

      <div className="border-t-2 border-chs-red pt-4 mt-2 bg-chs-amber-light rounded-lg p-3">
        <p className="font-bold text-chs-red mb-2">30. Alternative service of legal notice — please read carefully</p>
        <p>
          By registering as a tenant, you agree that CHS and/or your landlord may validly serve you any real legal document — including a court process, eviction notice, or quit notice — using the phone number, email address, or WhatsApp/social media contact you supplied at registration, if you become genuinely unreachable through normal means (e.g. your phone is switched off, your registered number is no longer active, or you cannot otherwise be reached after real, documented attempts). This does not replace your legal right to be heard; it exists solely so a landlord is not left without recourse when a tenant cannot be physically located — for example, if a property is abandoned or locked with rent unpaid and the tenant cannot be reached. Service through any of these real channels, once genuinely attempted and documented, is treated as valid notice for the purposes of this agreement.
        </p>
      </div>

      <p className="text-xs text-gray-400 bg-[var(--zone-card)] rounded-lg p-3 mt-4">
        This is a summary for quick reference. The full CHS Terms & Conditions document is available on request from CHS support at <a href="mailto:support@completehousingsolutions.com" className="underline">support@completehousingsolutions.com</a>.
      </p>
    </div>
  );
}
