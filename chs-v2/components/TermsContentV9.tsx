// The single real source of the Terms & Conditions body — shared
// between the browsable /terms page and the scroll-to-accept gate at
// /accept-terms, so both always show the exact same real content
// rather than two copies that could drift apart.
export default function TermsContentV9() {
  return (
    <div className="text-sm text-gray-600 leading-relaxed space-y-3">
      <p><strong className="text-chs-charcoal">1. CHS is a facilitator, not a party to your transaction.</strong> CHS verifies documents, holds funds in escrow, and provides dispute resolution, but the underlying sale/tenancy agreement is between the Owner and the Buyer/Tenant directly.</p>
      <p><strong className="text-chs-charcoal">2. Every transaction started on CHS must be completed on CHS.</strong> Concluding a deal introduced through the platform outside it does not remove CHS&apos;s fee, which remains legally owed.</p>
      <p><strong className="text-chs-charcoal">3. CHS fees.</strong> CHS charges an <strong className="text-chs-charcoal">agency fee</strong> to the tenant, buyer or guest, and a <strong className="text-chs-charcoal">service charge</strong> to the landlord, seller or host. Where these Terms or the app say &quot;commission&quot;, they mean these fees. The agency fee pays for finding, checking and presenting the property and for the protection of your money. The service charge pays for CHS&apos;s listing, verification, escrow and payment services to the owner. The fees vary by category and are always split between both sides of the transaction:</p>
      <ul className="list-disc pl-5 space-y-1">
        <li><strong className="text-chs-charcoal">Residential/Commercial Rental or Lease</strong> (houses, offices, shops, warehouses, factories, land leased long-term): a 6% agency fee from the Tenant/Lessee and a 4% service charge from the Landlord/Owner. From the second year of the same tenancy onward, the tenant pays no further agency fee at all — only the landlord, at a reduced 3% service charge.</li>
        <li><strong className="text-chs-charcoal">Sale</strong> (houses, land, warehouses, factories, or any property sold outright): a 6.5% agency fee from the Buyer and a 6% service charge from the Seller.</li>
        <li><strong className="text-chs-charcoal">Mortgage (Rent to Own)</strong>: a 5.5% agency fee from the Buyer and a 4.5% service charge from the Seller, charged on every monthly installment as it&apos;s paid — not on the total price upfront.</li>
        <li><strong className="text-chs-charcoal">Shortlet</strong> (genuine short-term apartment/house stays): a sliding scale by length of stay — 1–3 nights: 7% Guest agency fee / 5% Host service charge; 4–13 nights: 6% / 4%; 14+ nights: 5% / 3%.</li>
        <li><strong className="text-chs-charcoal">Hotel &amp; Lodge, Event Centre, and casual/hourly Car Park bookings</strong>: a flat 6% agency fee from the Guest and a 4% service charge from the Host, regardless of duration.</li>
        <li><strong className="text-chs-charcoal">Agent-managed listings</strong>: an independent agent who brings full management authority to a property may set their own commission rate with their client. In this arrangement, CHS charges neither the buyer/tenant nor the owner directly — instead, CHS takes a capped 3% only from the agent&apos;s own commission earnings, once paid.</li>
        <li><strong className="text-chs-charcoal">Properties managed by CHS</strong> (term 41): where CHS manages a property for its owner under a signed management agreement, a management fee replaces the owner&apos;s service charge, so the owner pays one fee, not two. For rent it is 10% of the rent collected. For a sale it is tiered by price and never more than 6.5%. For shortlets and hotels it is the rate in the management agreement, shown to the owner before they accept. The tenant, buyer or guest still pays the agency fee and no other fee.</li>
      </ul>
      <p>No inspection fee as standard. Photographs and videos are free, and a buyer or tenant may ask for more of either. If, after that, they still ask for a physical visit, the whole transport cost — worked out from where the CHS agent sets off — is theirs alone: it is shown before the visit, paid from their wallet and held until the visit, and refunded if the owner or CHS cancels or the requester cancels at least 12 hours before.</p>
      <p><strong className="text-chs-charcoal">4. Honesty and accurate information is mandatory.</strong> Falsified documents or fraudulent listings result in permanent suspension and may be reported to law enforcement.</p>
      <p><strong className="text-chs-charcoal">5. Agents and Property Managers must not extort Users.</strong> No undisclosed fees, caution money, or inspection charges.</p>
      <p><strong className="text-chs-charcoal">6. All funds are held in escrow</strong> until the conditions for release are met. (The one exception is venue service payments, which go from your Wallet straight to the operator without escrow or commission, as set out in the hotel, lodge and event centre section.) <strong className="text-chs-charcoal">Every payment on CHS is made through your CHS Wallet, and only there.</strong> Never transfer money to any person or bank account, even one claiming to be CHS, an agent, an owner, a host or a vendor; CHS staff and agents will never ask you to, nor ask for your PIN or a confirmation code. A request to pay any other way is a scam and should be reported to CHS.</p>
      <p><strong className="text-chs-charcoal">7. Ownership warranty.</strong> Owners personally warrant they hold clear authority to list or sell a property; for inherited or family property, consent of all co-owners is required.</p>
      <p><strong className="text-chs-charcoal">8. Disputes are resolved through CHS&apos;s internal process first</strong>, before arbitration or the courts of Kaduna State.</p>
      <p><strong className="text-chs-charcoal">9. CHS reserves the right to suspend or terminate</strong> any account found in breach of these terms.</p>

      <div className="border-t border-gray-200 pt-4 mt-2">
        <p className="font-bold text-chs-charcoal mb-2">10. Sale Approvals checkpoint</p>
        <p>Once an owner accepts a buyer&apos;s offer on a for-sale property, the transaction does not move straight to document submission and escrow payment — CHS first reviews and clears it. This is the real checkpoint between an offer being accepted and money actually moving.</p>
      </div>

      <div className="border-t border-gray-200 pt-4 mt-2">
        <p className="font-bold text-chs-charcoal mb-2">11. Shortlet and hire bookings</p>
        <p>A hotel, lodge, shortlet, event centre or other hire booking is made in this order: you send a request, and <strong className="text-chs-charcoal">nothing is charged</strong>; CHS passes the request to the host, who confirms the dates are free; you then have a short window to pay. When you pay, the real, full amount (the booking price plus the guest&apos;s commission share and any refundable deposit) is taken from your CHS Wallet and held in escrow, and is released to the host as soon as you arrive and confirm, by ticking a short checklist in the app, that the property is as described and each listed facility is present and working. Your confirmation reaches both the host and CHS. If you do not respond, the payment is released automatically 24 hours after check-in unless you report a problem; if you report one, the payment stays held while CHS looks into it. Genuine guest verification (name, phone, valid ID) is required before any request can be submitted.</p>
        <p className="mt-2"><strong className="text-chs-charcoal">Time limits:</strong> how long each step may take depends on how soon your stay starts. If your stay starts more than 3 days away, the host has 24 hours to reply and you have 6 hours to pay. If it starts in 1 to 3 days, the host has 6 hours and you have 2 hours. If it starts today, the host has 30 minutes and you have 20 minutes, and you must tell the host roughly what time you will arrive. For a stay starting within 3 days, your CHS Wallet must already hold the full amount when you send the request. If the host declines or does not reply in time, or if you do not pay in time, the request lapses, the dates are released and nothing is charged. Requests made under the earlier order, where payment was taken when the request was sent, remain automatically and fully refundable if the host declines or does not reply in time.</p>
        <p className="mt-2"><strong className="text-chs-charcoal">Everything goes through CHS:</strong> CHS relays every booking request and every message between a guest and a host; the two never deal with each other directly. CHS passes each request to the host promptly, and the host&apos;s time to reply starts when CHS passes it on. Until a booking has been paid, each message is reviewed by CHS before it is delivered. Phone numbers and email addresses may not be shared and are blocked at all times. A host sees a guest&apos;s name and a CHS reference, not their phone number or ID document.</p>
        <p className="mt-2"><strong className="text-chs-charcoal">Cancellation policy:</strong> a guest may withdraw a request that has not been paid for at any time, at no cost. A guest may cancel a paid booking at any time before check-in. A cancellation 48 or more hours before check-in receives a full refund; a cancellation within 48 hours of check-in receives a 50% refund; no refund is given on or after check-in. A booking that the host never confirmed is always refunded in full. The part of a booking that is not refunded is shared: the unrefunded stay price goes to the host as compensation for the dates they held, less CHS&apos;s commission on it (CHS may keep a share of it, as published in its settings), and CHS keeps its service fee on that part. The guest&apos;s and the host&apos;s CHS commissions are recorded as collected when the guest pays.</p>
        <p className="mt-2"><strong className="text-chs-charcoal">Security deposit:</strong> a host may choose to require a real, refundable security deposit on a listing. This deposit applies only to a genuinely first-time guest at that property and is automatically waived once a guest has 3 or more real ratings on CHS. A deposit is held separately and resolved by CHS after the stay — released back to the guest if no damage is reported, or paid to the host if genuine damage is confirmed.</p>
        <p className="mt-2">A host and guest may each rate the other once, after a stay is confirmed complete.</p>
      </div>

      <div className="border-t border-gray-200 pt-4 mt-2">
        <p className="font-bold text-chs-charcoal mb-2">12. Wallet freezing</p>
        <p>CHS reserves the right to freeze any wallet pending a genuine investigation into suspected fraud or a policy violation. A frozen wallet is functionally blocked from withdrawal until the matter is resolved. A wallet holder may also freeze their own wallet at any time; only CHS can lift that freeze, after verifying their identity. When a user reports a transfer as unauthorised or a scam, the amount is held in the recipient&apos;s wallet while CHS investigates, and CHS may reverse the transfer while that money remains in the recipient&apos;s wallet.</p>
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
        <p>A user may transfer wallet funds directly to another CHS user, identified by their registered phone number or email. A transfer cannot be sent to oneself, cannot exceed the sender&apos;s available balance, and cannot be sent from or to a frozen wallet. A completed transfer is final, except where CHS reverses it after a fraud report. Transfers are protected: the sender must be ID-verified; once a transaction PIN is set it must be entered (CHS may require it of every user); CHS may require a confirmation code sent by SMS for larger amounts or from a device it has not seen before; and limits apply per transfer, per day and per hour, with a lower cap on a first transfer to a new recipient. Money received from another CHS user, or added to a wallet by card, can be used inside CHS at once but cannot be withdrawn to a bank for 24 hours. CHS is not responsible for funds sent to the wrong recipient due to a user-entered error, though CHS support may be contacted to investigate.</p>
      </div>

      <div className="border-t border-gray-200 pt-4 mt-2">
        <p className="font-bold text-chs-charcoal mb-2">21. Construction Roadmap access</p>
        <p>Accessing a Construction Roadmap (real quantities, permits checklist, and payment plan for a specific building configuration) requires a one-time access fee, credited in full toward the real project cost if the client proceeds with CHS for construction. Cost figures shown are a general market estimate, not a firm CHS quotation, until CHS&apos;s own verified rates are available for that configuration.</p>
      </div>

      <div className="border-t border-gray-200 pt-4 mt-2">
        <p className="font-bold text-chs-charcoal mb-2">22. Rent to Own / Mortgage</p>
        <p>A buyer may request a Rent to Own / Mortgage agreement on any property listed under that category. The buyer gives CHS their details first; the request goes to CHS, which either passes it to the owner or declines it with a reason. The owner approves or declines, and CHS passes that answer to the buyer, so the buyer and the owner never deal with each other directly and neither sees the other&apos;s phone number. Every instalment is paid through the CHS Wallet to CHS, which holds it and releases it to the owner after CHS has checked it; every step is recorded. A buyer may pay one instalment or any larger amount up to the full balance. The final payment is always held by CHS until the property documents have been handed over: the owner uploads the documents for CHS to check, CHS approves them, the owner sends the hard copies, the buyer confirms in the app that they arrived, and only then does CHS release the final payment. That release is made by hand by a CHS super admin, unless CHS has switched on automatic release for a busy period. The buyer&apos;s ownership grows with every payment and, once the full price is paid and the documents are handed over, the agreement is completed. A property can have only one active Rent to Own agreement, and approving one buyer declines the other pending requests.</p>
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
        <p>When a buyer completes payment for a property, the seller&apos;s net proceeds are immediately visible in their CHS Wallet, but held and not withdrawable. Funds are released to the seller&apos;s spendable balance only once CHS confirms that the real, physical legal documents — Deed of Assignment, Certificate of Occupancy, and all other required documents — have genuinely been prepared (through a qualified barrister where required) and delivered to the new owner. This protection exists to ensure a buyer receives real, complete legal ownership before a seller can access sale proceeds. The proceeds of a sale are released when the buyer confirms they have received the documents, when CHS confirms delivery, or when the seller asks CHS to release them and CHS has verified delivery from its records or by contacting the buyer. Each release is for that sale&apos;s own proceeds only.</p>
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

      <div className="border-t-2 border-chs-red pt-4 mt-2 bg-chs-amber-light rounded-lg p-3">
        <p className="font-bold text-chs-red mb-2">37. Records and timestamps</p>
        <p>CHS keeps an electronic record, with the exact date and time to the second in Nigerian time (WAT), of the important things that happen on the platform: documents uploaded, sent, approved and confirmed as received; messages and notifications sent and read; payments, releases and refunds; applications, offers and requests; confirmations such as arrival or receipt of documents; your acceptance of these Terms; and actions taken by CHS staff. These records are kept for as long as needed to run the platform, resolve disputes and meet legal obligations (see the Privacy Policy). You agree that, in any dispute between you and another user, or between you and CHS, these electronic records and their timestamps may be relied on, and may be produced to a court, regulator or arbitrator where required, as evidence of what happened and when. If you believe a record is wrong, tell CHS support straight away and CHS will review it; a timestamp is evidence, not a verdict, and you remain free to show otherwise. CHS does not alter the timestamp of an event after it is recorded.</p>
      </div>

      <div className="border-t-2 border-chs-red pt-4 mt-2 bg-chs-amber-light rounded-lg p-3">
        <p className="font-bold text-chs-red mb-2">38. Hospitality plans, team tools and operator data</p>
        <p>This applies to a Host who runs a hotel, lodge or event centre on CHS.</p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li><strong className="text-chs-charcoal">Plans.</strong> Listed is free. Pro and Business are paid plans: the price is shown before you pay, is taken from your CHS Wallet for 30 days, and renews from your wallet every 30 days until you cancel. A period you have paid for is not refunded when you cancel; it runs to its end. If a renewal fails you have 7 days to top up; after that you move to Listed. On Listed your earlier records stay readable and you can still download them. CHS may change a price; the new price applies from your next renewal after CHS has told you.</li>
          <li><strong className="text-chs-charcoal">Lower commission.</strong> A paid plan may lower the commission CHS charges you on bookings that CHS brings you, for as long as the plan is active. CHS charges no commission on walk-in guests or direct sales that you record in the tools.</li>
          <li><strong className="text-chs-charcoal">Pilot.</strong> A free pilot lasts for the period CHS tells you and ends by itself on that date and time. CHS may end a pilot early if these Terms are broken.</li>
          <li><strong className="text-chs-charcoal">Your team.</strong> You choose who joins your team and what role they hold. You are responsible for what they do on your properties and for removing them when they leave. Everything a team member records carries their name and the exact date and time.</li>
          <li><strong className="text-chs-charcoal">Guest and staff data.</strong> You decide why and how the personal data of your guests and your staff is used. CHS processes that data only to provide the tools and on your instructions, and keeps it secure. You must have the right to use it, and you must not use it for anything unlawful.</li>
          <li><strong className="text-chs-charcoal">Importing and linking calendars.</strong> When you import a sheet you confirm that you have the right to use it and that it is yours. An import can be undone. A linked calendar shows what the other site reports: CHS cannot promise it is complete or current, and you remain responsible for not selling a room twice. Keep your calendar links private; anyone who has one can see which nights are booked.</li>
          <li><strong className="text-chs-charcoal">Event vendors.</strong> For an event centre, you record the people or companies providing ushers, catering, music, security or other services, with their phone numbers. You must have their agreement to be recorded. Only you and your managers see a vendor&apos;s phone number. When you confirm a vendor, CHS tells the client the vendor&apos;s name and never the phone number.</li>
          <li><strong className="text-chs-charcoal">Records.</strong> A wrong income or expense entry is voided with a reason. It is never erased, and stays visible with the time it was voided and by whom.</li>
        </ul>
      </div>

      <div className="border-t-2 border-chs-red pt-4 mt-2 bg-chs-amber-light rounded-lg p-3">
        <p className="font-bold text-chs-red mb-2">39. Complete and honest listings</p>
        <p>This applies to everyone who lists a property, a hotel, lodge or event centre, or a marketplace product or service on CHS, including agents and managers listing for an owner.</p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li><strong className="text-chs-charcoal">What every listing must show.</strong> The real price, the location and a street address or house number, at least five photos, at least one video, a short honest description and a contact phone number. A service must show a starting price. CHS will not publish a listing, and a listing that is not complete cannot go live, even if you try to submit it another way.</li>
          <li><strong className="text-chs-charcoal">No hidden prices.</strong> You must not ask people to message, call, inbox or DM you to learn the price, or use wording that has that effect, in a title, a description or anywhere else on the listing. CHS refuses such wording automatically and may remove a listing or suspend an account that gets around it.</li>
          <li><strong className="text-chs-charcoal">The price is the price.</strong> Do not advertise a price you do not intend to honour. When you change the price of a live listing, CHS records the earlier price and the date and shows them on the listing.</li>
          <li><strong className="text-chs-charcoal">Your contact number.</strong> You must give a working Nigerian mobile number that reaches you. CHS keeps it private and uses it to reach you about the listing; it is not shown to the public. You must not use photos, videos or descriptions to share contact details so that a deal can be moved off CHS.</li>
          <li><strong className="text-chs-charcoal">Keeping a listing current.</strong> For a property for sale, rent or lease, you must confirm every 30 days that it is still available. CHS reminds you first. A listing that has not been confirmed is hidden from the public until you confirm it. Hotel, lodge and event-centre listings are kept current through their calendar.</li>
          <li><strong className="text-chs-charcoal">Reports and review.</strong> Anyone signed in can report a listing. CHS may hide a listing while it looks into a report, ask you for proof, correct it, remove it, or suspend the account. The name of the person who reported is not shown to you. CHS also reviews listings more closely when there are warning signs, such as a new or unverified account, a possible duplicate of another listing, or a price far from similar listings. A warning sign is not a finding against you, and you may respond.</li>
          <li><strong className="text-chs-charcoal">Consequences.</strong> Repeated or deliberate breaches of this term can lead to removal of listings, loss of the right to list, and a record on the account.</li>
        </ul>
      </div>

      <div className="border-t-2 border-chs-red pt-4 mt-2 bg-chs-amber-light rounded-lg p-3">
        <p className="font-bold text-chs-red mb-2">40. Food, drink and extras paid to the operator</p>
        <p>This applies to a hotel, lodge or event centre that uses the menu, room-order, counter-sales or quotation tools, and to the guests and clients who use them.</p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li><strong className="text-chs-charcoal">Services are paid through CHS and held by CHS.</strong> Your booking and every service you buy for it (each instalment of an accepted event quotation, and any service the operator or CHS agrees to supply) are paid from your CHS Wallet and held by CHS, in the same way as your booking payment, until after your event. CHS adds a service fee to what you pay (currently 6% of the service price) and shows it before you pay. CHS pays the operator, and any provider CHS found, in two parts: an advance (currently 60% of what they will earn) shortly before your event, so they can prepare, and the balance after your event. The advance is paid out of the money CHS already holds for you, so it does not cost you more; if your event is then cancelled, your refund is worked out under the cancellation rules above and CHS recovers any advance paid out of the amount returned to you. If the operator cancels, or CHS cancels for a reason outside anyone&apos;s control, you are refunded in full including the fee; if you cancel 48 hours or more before the event you are refunded in full; if you cancel less than 48 hours before, 50% is refunded; after the event has started nothing is refunded. Food and drink ordered to your room are supplied and priced by the operator. Nothing may be paid outside CHS: payments made outside CHS are not protected and break these Terms. Where CHS finds a provider, you contract with the operator, who is responsible for the service, and CHS does not disclose the provider&apos;s private contact details to you. You receive a receipt for each payment. </li>
          <li><strong className="text-chs-charcoal">When nobody is at fault.</strong> If something outside the control of both the guest and the operator stops a paid booking (for example a curfew, riot, flood, government order, a death in the guest&apos;s immediate family or a medical emergency), the guest may move to new dates at no charge or ask for a refund. Where CHS has declared a disruption covering the area and dates, the request qualifies automatically; otherwise the operator replies first and CHS decides if they disagree. The operator may keep only costs it has really incurred and can show, up to a limit set by CHS (currently 25 percent of the booking price), and CHS takes no commission on that amount and returns its own fee in full. A booking that another guest has already paid for is never moved to make room. If the operator does not reply in time, a request under a declared disruption goes ahead with no costs to the guest. This does not apply to an ordinary change of mind, which follows the cancellation terms of the booking.</li>
          <li><strong className="text-chs-charcoal">Before you pay.</strong> The price of each item and the total are shown when you order or when you accept a quotation. An accepted quotation sets out the payment dates, which fall on or before the event. A quotation can be withdrawn or replaced by the operator until a payment is recorded against it.</li>
          <li><strong className="text-chs-charcoal">Records.</strong> The operator records when an order is delivered and paid and when a quotation payment is received. You should ask for proof of any payment you make. If you and the operator disagree about an order or an extra, you must first try to settle it with the operator; CHS may look at the records and may help, but it does not guarantee these payments.</li>
          <li><strong className="text-chs-charcoal">The operator&apos;s duties.</strong> An operator must charge the prices shown, must not add items you did not order, and must keep its stock and prices honest. Orders and sales an operator records feed its income records, which are subject to term 38.</li>
        </ul>
      </div>

      <div className="border-t-2 border-chs-red pt-4 mt-2 bg-chs-amber-light rounded-lg p-3">
        <p className="font-bold text-chs-red mb-2">41. The CHS stamp, tag and CHS-managed properties</p>
        <p>This applies to every listing that carries a CHS stamp, to owners who ask CHS to manage a property, and to anyone who sees or uses the stamp.</p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li><strong className="text-chs-charcoal">Two stamps.</strong> &quot;Advertised by CHS&quot; means CHS has checked the property and advertises it. &quot;Managed &amp; Advertised by CHS&quot; means CHS also runs the property for its owner under a signed management agreement. Only CHS can award a stamp. An owner or agent cannot give one to themselves.</li>
          <li><strong className="text-chs-charcoal">The tag.</strong> Every stamped property has a CHS tag, such as CHS-100002-3. Anyone can check a tag on the CHS website without signing in. A stamp or tag that CHS did not issue is not genuine; do not pay anyone because of it.</li>
          <li><strong className="text-chs-charcoal">What a managed property costs.</strong> On a Managed &amp; Advertised property you pay only the published CHS fee. No agent fee, legal or agreement fee, &quot;RCD&quot; fee or inspection fee is charged by anyone. If someone asks you for one, report it to CHS.</li>
          <li><strong className="text-chs-charcoal">Handing a property to CHS.</strong> An owner asks CHS to manage a property through the app, says in what capacity they are acting, uploads the documents CHS asks for and accepts the management terms for that service. CHS checks the documents before approving. The stamp is awarded only when CHS approves. Either side may end the arrangement under the management terms, and the stamp is then removed.</li>
          <li><strong className="text-chs-charcoal">Hotels, lodges, event centres and other venues.</strong> A commercial venue is handed to CHS under the hotel and commercial management terms. Before CHS can approve it the owner must give proof of ownership, the venue&apos;s operating permit or licence (which states its licensed capacity) and a public liability insurance certificate, and for an event centre or open venue also a fire safety certificate, and must keep them valid while CHS manages the venue. On a managed venue the management fee replaces the host-side booking commission, so that commission is not charged as well; the guest-side fee and the fees on extra services stay as published.</li>
          <li><strong className="text-chs-charcoal">Misuse.</strong> Using a CHS stamp, tag, name or logo on a property CHS has not stamped, copying or changing a stamp, or using it on a sign, advert or document without CHS&apos;s written approval is misuse. It can lead to suspension, removal of listings and a report to the police.</li>
        </ul>
      </div>

      <div className="border-t-2 border-chs-red pt-4 mt-2 bg-chs-amber-light rounded-lg p-3">
        <p className="font-bold text-chs-red mb-2">42. CHS-approved agents</p>
        <p>This applies to agents and to anyone dealing with an agent who shows the CHS-approved agent badge.</p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li><strong className="text-chs-charcoal">What the badge means.</strong> It shows that CHS has checked a registered company or firm and approved it. It is not a guarantee of any deal, and the agent is not CHS and does not speak for CHS.</li>
          <li><strong className="text-chs-charcoal">Who can hold it.</strong> Only a company registered with the CAC, or a firm registered with ESVARBON or QSRBN. An individual cannot. The firm and its directors must have completed full, current KYC, and the firm must have a record of paid transactions on CHS. The full conditions are in the CHS-approved agent badge terms the agent accepts when applying.</li>
          <li><strong className="text-chs-charcoal">Checking an agent.</strong> Every approved agent has a CHS agent ID. Anyone can check it on the CHS website. If an agent says they are approved and the ID does not check out, pay nothing outside your CHS account and tell CHS.</li>
          <li><strong className="text-chs-charcoal">Withdrawal.</strong> The badge lasts 12 months, hides itself when the registration or KYC expires, and CHS may remove it at any time, with or without prior notice.</li>
        </ul>
      </div>

      <div className="border-t-2 border-chs-red pt-4 mt-2 bg-chs-amber-light rounded-lg p-3">
        <p className="font-bold text-chs-red mb-2">43. Viewings and inspection slots</p>
        <p>This applies to owners who set viewing times and to people who book a physical visit.</p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li><strong className="text-chs-charcoal">Slots.</strong> An owner may set the days and hours they can show a property. Where they have, a visitor must pick a free slot, and each slot can be booked once.</li>
          <li><strong className="text-chs-charcoal">Moving a visit.</strong> A visitor may move a visit to another free slot up to 12 hours before it. The owner may move a visit at any time, and CHS tells the visitor. Cancelling follows the existing rules on inspections: a visit cancelled at least 12 hours ahead is refunded, and a later cancellation or a no-show means the transport cost goes to the agent who travelled.</li>
          <li><strong className="text-chs-charcoal">Reminders and attendance.</strong> CHS reminds both sides before a confirmed visit. The owner records whether the visitor came. Missed visits are recorded and shown to owners the visitor books with, to help them plan their time.</li>
        </ul>
      </div>

      <div className="border-t-2 border-chs-red pt-4 mt-2 bg-chs-amber-light rounded-lg p-3">
        <p className="font-bold text-chs-red mb-2">44. Rent by instalments</p>
        <p>This applies to CHS-managed rentals where the landlord has allowed quarterly or monthly rent, and to the tenants who choose it.</p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li><strong className="text-chs-charcoal">Choice.</strong> The landlord decides which plans are offered; paying the full year is always available. A tenant picks a plan when paying the first rent, or within 30 days of the end of the lease for the next year.</li>
          <li><strong className="text-chs-charcoal">How it works.</strong> Each instalment is paid through the CHS Wallet and held by CHS under the usual rent escrow rules before release to the landlord. The one-time CHS agency fee is paid with the first instalment. The landlord&apos;s management fee is taken in equal parts from each instalment.</li>
          <li><strong className="text-chs-charcoal">Your duty to pay.</strong> A tenant on a plan must pay each instalment by its date. CHS reminds the tenant, and tells the landlord if one is overdue.</li>
          <li><strong className="text-chs-charcoal">CHS does not lend or guarantee.</strong> CHS is not a lender and does not guarantee an instalment a tenant fails to pay. The landlord keeps their rights under the tenancy.</li>
        </ul>
      </div>

      <div className="border-t border-gray-200 pt-4 mt-2">
        <p className="font-bold text-chs-charcoal mb-2">45. Event centres, hotels, group stays and open venues</p>
        <p>This applies to hosts and guests of event centres, hotels, lodges, open fields and stadiums.</p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li><strong className="text-chs-charcoal">Advance to the venue.</strong> After you pay for an event centre booking, CHS holds the money. Shortly before the event (currently 48 hours before) CHS pays the venue an advance (currently 60%) of what the venue will earn from the booking, meaning the booking price less the venue&apos;s service charge, so that it can prepare. The balance is paid after the event under term 11. CHS may change the advance (never above 90%) or switch it off; a change applies to bookings paid after it.</li>
          <li><strong className="text-chs-charcoal">If an event is cancelled after the advance.</strong> The advance is taken back from the venue first, and the guest&apos;s refund is then worked out under term 11 and, where it applies, term 40. If the venue&apos;s wallet cannot cover it, the venue owes CHS the difference and CHS may recover it.</li>
          <li><strong className="text-chs-charcoal">Documents for events.</strong> For larger or higher-risk events (for example political events, concerts and festivals, or an event of 200 or more guests), CHS and the venue may ask the organiser for documents such as a permit, a police clearance or an organiser&apos;s ID. Documents are private: only the organiser, the venue and CHS can see them, and contact details are not allowed in a document title. An event whose required documents are not provided may be declined; an unpaid request that is declined costs nothing (term 11).</li>
          <li><strong className="text-chs-charcoal">Capacity.</strong> A venue states its licensed capacity and CHS checks it against the operating permit. A booking for more guests than the capacity is refused. You must give the real number of guests, and ask the venue through the app if it changes.</li>
          <li><strong className="text-chs-charcoal">Seating layouts.</strong> A venue lists the layouts it can set up and may state the most guests each can hold. The guest chooses one for the event and the venue is told. A layout that cannot hold the guest count cannot be chosen. The diagrams are illustrations, not a plan of the actual hall.</li>
          <li><strong className="text-chs-charcoal">Hotels and lodges: more than one room.</strong> A guest may request several rooms together, and says how many adults and children are staying. Each room is its own booking that the host confirms, and the guest may pay for all of them in one step. Extras such as breakfast, airport pickup, laundry, early check-in or late check-out are requested and paid through CHS under term 40.</li>
          <li><strong className="text-chs-charcoal">Long-stay discounts.</strong> A host may offer a weekly discount (stays of 7 nights or more) and a monthly discount (28 nights or more), of up to 50%. The discount is shown in the price before you pay, and CHS&apos;s fees are worked out on the price after the discount.</li>
          <li><strong className="text-chs-charcoal">Group and corporate enquiries.</strong> A guest may send a host a group or corporate enquiry through CHS. An enquiry is not a booking, it must not contain phone numbers, emails or links, and a person may send a limited number each day. Any booking that follows is made and paid on CHS (term 2).</li>
          <li><strong className="text-chs-charcoal">Ratings and accessibility.</strong> A property shows a summary of its ratings. A guest can rate only after the stay has started, and a rating must not contain contact details. Accessibility features that a host ticks (for example step-free access) must be true; term 39 applies.</li>
          <li><strong className="text-chs-charcoal">Open fields and stadiums.</strong> The host describes the ground: surface, floodlights, toilets, changing rooms, safe crowd limit, rain plan and noise or curfew rules. The guest must keep to the crowd limit and the curfew. Booking, payment and fees are the same as for other hire bookings (terms 3 and 11). Weather is dealt with as the venue&apos;s rain plan says; where something beyond both sides&apos; control stops the event, term 40 may apply.</li>
        </ul>
      </div>

      <div className="border-t border-gray-200 pt-4 mt-2">
        <p className="font-bold text-chs-charcoal mb-2">46. Tax on CHS fees</p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li><strong className="text-chs-charcoal">What CHS&apos;s fees include.</strong> The fees shown to you are the amounts you pay. Where CHS must charge or account for Value Added Tax (VAT) or another tax on its own fees, the fee shown includes it unless CHS tells you otherwise before you pay. Whether and from when a tax applies depends on the law and on CHS&apos;s tax registration. If a change would alter what you pay, CHS will tell you first (term 47).</li>
          <li><strong className="text-chs-charcoal">Your own taxes.</strong> You are responsible for any tax on your own rent, sale, hire or other income. CHS is not your tax adviser.</li>
          <li><strong className="text-chs-charcoal">Records.</strong> CHS records each fee it collects, and the tax part of it where one applies, and a refund reverses that record.</li>
        </ul>
      </div>

      <div className="border-t-2 border-chs-red pt-4 mt-2 bg-chs-amber-light rounded-lg p-3">
        <p className="font-bold text-chs-red mb-2">47. Changes to these Terms</p>
        <p>CHS may review and change these Terms, its fees and the services described in them at any time, with or without prior notice. When a change affects your rights or what you pay, CHS will ask you to read and accept the new version before you continue. Fees already charged on a deal that was agreed before a change are not changed by it.</p>
      </div>

      <p className="text-xs text-gray-400 bg-[var(--zone-card)] rounded-lg p-3 mt-4">
        This is a summary for quick reference. The full CHS Terms & Conditions document is available on request from CHS support at <a href="mailto:support@completehousingsolutions.com" className="underline">support@completehousingsolutions.com</a>.
      </p>
    </div>
  );
}
