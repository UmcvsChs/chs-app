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
        <li><strong className="text-chs-charcoal">Mortgage (Rent to Own)</strong>: 5.5% from the Buyer, 4.5% from the Seller, charged on every real monthly installment as it&apos;s paid — not on the total price upfront.</li>
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
        <p className="font-bold text-chs-charcoal mb-2">11. Shortlet and hire bookings</p>
        <p>A hotel, lodge, shortlet, event centre or other hire booking is made in this order: you send a request, and <strong className="text-chs-charcoal">nothing is charged</strong>; CHS passes the request to the host, who confirms the dates are free; you then have a short window to pay. When you pay, the real, full amount (the booking price plus the guest&apos;s commission share and any refundable deposit) is taken from your CHS Wallet and held in escrow, and is not released to the host until your stay begins and you confirm check-in. Genuine guest verification (name, phone, valid ID) is required before any request can be submitted.</p>
        <p className="mt-2"><strong className="text-chs-charcoal">Time limits:</strong> how long each step may take depends on how soon your stay starts. If your stay starts more than 3 days away, the host has 24 hours to reply and you have 6 hours to pay. If it starts in 1 to 3 days, the host has 6 hours and you have 2 hours. If it starts today, the host has 30 minutes and you have 20 minutes, and you must tell the host roughly what time you will arrive. For a stay starting within 3 days, your CHS Wallet must already hold the full amount when you send the request. If the host declines or does not reply in time, or if you do not pay in time, the request lapses, the dates are released and nothing is charged. Requests made under the earlier order, where payment was taken when the request was sent, remain automatically and fully refundable if the host declines or does not reply in time.</p>
        <p className="mt-2"><strong className="text-chs-charcoal">Everything goes through CHS:</strong> CHS relays every booking request and every message between a guest and a host; the two never deal with each other directly. CHS passes each request to the host promptly, and the host&apos;s time to reply starts when CHS passes it on. Until a booking has been paid, each message is reviewed by CHS before it is delivered. Phone numbers and email addresses may not be shared and are blocked at all times. A host sees a guest&apos;s name and a CHS reference, not their phone number or ID document.</p>
        <p className="mt-2"><strong className="text-chs-charcoal">Cancellation policy:</strong> a guest may withdraw a request that has not been paid for at any time, at no cost. A guest may cancel a paid booking at any time before check-in. A cancellation 48 or more hours before check-in receives a full refund; a cancellation within 48 hours of check-in receives a 50% refund; no refund is given on or after check-in. A booking that the host never confirmed is always refunded in full. The part of a booking that is not refunded is shared: the unrefunded stay price goes to the host as compensation for the dates they held, less CHS&apos;s commission on it (CHS may keep a share of it, as published in its settings), and CHS keeps its service fee on that part. The guest&apos;s and the host&apos;s CHS commissions are recorded as collected when the guest pays.</p>
        <p className="mt-2"><strong className="text-chs-charcoal">Security deposit:</strong> a host may choose to require a real, refundable security deposit on a listing. This deposit applies only to a genuinely first-time guest at that property and is automatically waived once a guest has 3 or more real ratings on CHS. A deposit is held separately and resolved by CHS after the stay — released back to the guest if no damage is reported, or paid to the host if genuine damage is confirmed.</p>
        <p className="mt-2">A host and guest may each rate the other once, after a stay is confirmed complete.</p>
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
        <p className="mt-2"><strong className="text-chs-charcoal">Commission on labor only.</strong> CHS charges a real commission on an artisan&apos;s labor charge alone, never on materials — if the property owner or buyer procures materials through CHS, commission on that purchase is already collected separately. The real rate is 6% of the labor charge where it is below ₦100,000, and 8.5% where it is ₦100,000 or above.</p>
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

      <div className="border-t-2 border-chs-red pt-4 mt-2 bg-chs-amber-light rounded-lg p-3">
        <p className="font-bold text-chs-red mb-2">31. Marketplace — every deal stays on CHS, no exceptions</p>
        <p>Every real marketplace conversation between a buyer and a vendor — a quote request and every response to it — is reviewed by CHS before it reaches the other party. A message containing a phone number, email address, or any other direct contact detail is blocked outright and never delivered; this applies equally to a buyer and a vendor. Neither party&apos;s real, personal identity is disclosed to the other — communication is identified only by a real CHS reference number. This exists for one reason: to keep every real deal, and the real protection that comes with it, genuinely on CHS from start to finish.</p>
        <p className="mt-2"><strong className="text-chs-charcoal">Real, escrow-backed payment.</strong> Accepting a CHS-approved quote charges your wallet the real quoted price plus a real 6% buyer commission, held in escrow — never released to the vendor until CHS confirms the real deal is genuinely complete. The vendor then receives the real price, net of a real 4% vendor commission — 10% collected in total, from both sides. If a real deal does not go through, CHS can authorize a full, real refund directly from escrow.</p>
        <p className="mt-2"><strong className="text-chs-charcoal">Direct purchase — skip the conversation.</strong> A real product can be sorted by price and bought directly, at its own real, listed price, with no quote or negotiation at all. The same real 6%/4% commission, escrow protection, and refund right apply, and the vendor sees only a real CHS reference number — never the buyer&apos;s identity.</p>
        <p className="mt-2">Attempting to conclude a real marketplace deal outside CHS, or to exchange contact information to do so, is treated the same as circumventing any other real transaction on this platform — see term 2.</p>
      </div>

      <div className="border-t-2 border-chs-red pt-4 mt-2 bg-chs-amber-light rounded-lg p-3">
        <p className="font-bold text-chs-red mb-2">32. Identity verification is required before any commitment</p>
        <p>Before making an offer, applying to rent, booking a shortlet or hire, requesting an inspection, requesting rent-to-own, or engaging CHS for a professional service, you must complete identity verification: your name as printed on a real, valid ID, gender, age bracket, state and address of residence, occupation, phone number, and email, alongside the ID itself. This is done once and covers every future action on your account. A National Identification Number (NIN), once verified on an account, is permanently linked to that account — one real person may hold only one CHS account under one NIN. Your ID number and uploaded document are never shown to another user; where a counterparty needs to know you are verified, they see only a confirmation that you are, not your ID details themselves.</p>
      </div>

      <div className="border-t-2 border-chs-red pt-4 mt-2 bg-chs-amber-light rounded-lg p-3">
        <p className="font-bold text-chs-red mb-2">33. Guarantor confirmation is independent</p>
        <p>A rental applicant provides only their guarantor&apos;s name and phone number. The guarantor themselves — not the applicant — completes every other real field about themselves directly, through a private, single-use link: their relationship to the applicant, address, occupation, their own ID, a real proof of address no older than 90 days, and a typed-name signature confirming their consent. A guarantor may not share the applicant&apos;s surname. The application does not reach the owner until this independent confirmation is complete.</p>
      </div>

      <div className="border-t-2 border-chs-red pt-4 mt-2 bg-chs-amber-light rounded-lg p-3">
        <p className="font-bold text-chs-red mb-2">34. Rent is held in escrow, the same real protection a buyer gets</p>
        <p>When a tenant pays rent, it is not released to the landlord immediately. It is held by CHS and released to the landlord only when the tenant files a genuinely clean move-in condition report (every item confirmed in good condition), or after a real 14-day grace period passes with nothing unresolved raised — whichever happens first. If a fault is reported, or the move-in report flags a real issue, release is paused and CHS reviews the tenancy directly before deciding. CHS may also release held rent early at its own discretion.</p>
      </div>

      <div className="border-t-2 border-chs-red pt-4 mt-2 bg-chs-amber-light rounded-lg p-3">
        <p className="font-bold text-chs-red mb-2">35. Your data</p>
        <p>The personal details CHS collects at identity verification — your name, gender, age bracket, address, occupation, email, phone number, and government ID — are used to verify who you genuinely are, to protect every other user you transact with, and to let CHS reach you directly where needed (including the alternative service of notice described in term 30). CHS does not sell this information. See the separate CHS Privacy Policy for the complete, current statement of what is collected, how it is used, and your rights over it.</p>
      </div>

      <div className="border-t-2 border-chs-red pt-4 mt-2 bg-chs-amber-light rounded-lg p-3">
        <p className="font-bold text-chs-red mb-2">36. Refunds when the other party defaults</p>
        <p>This applies to every Tenant, Buyer, and Guest on CHS. If the other side of your transaction fails to do what they agreed — a Seller who does not deliver the legal documents within the agreed window, a Landlord whose grace period passes with no clean move-in report, a Host who does not honour or respond to a confirmed booking, or a Vendor who does not deliver — you may ask CHS for a refund, and CHS may also issue one after its own review. Your money is then refunded as follows:</p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li><strong className="text-chs-charcoal">The price in full.</strong> Everything you paid for the property, rent, booking, or goods is returned to you, with nothing deducted.</li>
          <li><strong className="text-chs-charcoal">CHS&apos;s own commission from you, returned in full.</strong> CHS does not keep a commission on a deal that failed because of the other side.</li>
          <li><strong className="text-chs-charcoal">One deduction only: a real bank processing fee.</strong> When your original payment moved, CHS&apos;s payment provider charged a real transfer fee that neither you nor CHS can recover. That, and nothing else, is what CHS keeps. It is calculated as 1.5% of CHS&apos;s commission from you plus ₦100, and is never more than ₦2,000, however large the transaction. For example, if CHS&apos;s commission from you was ₦100,000, the fee is ₦1,600, and you receive back the full price plus ₦98,400.</li>
          <li><strong className="text-chs-charcoal">The commission charged to the party who defaulted is cancelled too.</strong> CHS does not collect its fee from the Owner, Seller, Host, or Vendor on a deal that is reversed.</li>
          <li>The refund is credited to your CHS Wallet, and you are notified of the exact amount and the exact processing fee.</li>
        </ul>
        <p className="mt-2"><strong className="text-chs-charcoal">When a refund becomes available.</strong> For a Sale, once the agreed document-delivery window has passed without the legal transfer being confirmed. For Rent, once the grace period has passed with no clean move-in report. For Marketplace goods and for Shortlet or Hire bookings, once CHS has reviewed the failure. A Host who declines your request at the outset refunds you in full with no deduction at all (see term 11), and a refund you request by cancelling your own booking follows the cancellation policy in term 11, not this term.</p>
      </div>

      <p className="text-xs text-gray-400 bg-[var(--zone-card)] rounded-lg p-3 mt-4">
        This is a summary for quick reference. The full CHS Terms & Conditions document is available on request from CHS support at <a href="mailto:support@completehousingsolutions.com" className="underline">support@completehousingsolutions.com</a>.
      </p>
    </div>
  );
}
