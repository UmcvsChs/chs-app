"use client";

// Real, comprehensive Users Guide content — reused directly from the
// same verified source already used for CHS_USERS_GUIDE.docx, so both
// the downloadable document and this in-app page always say the same thing.
export default function GuideContent() {
  return (
    <div className="text-sm text-gray-600 leading-relaxed space-y-2">
      <h2 className="font-serif text-lg font-bold text-chs-charcoal mt-5 mb-2">1. What Is CHS?</h2>
      <p>CHS (Complete Housing Solutions) is a real estate platform covering the full property journey — buying, renting, leasing, short-stay bookings, and property sales — currently focused on Kaduna State, Nigeria. Unlike a simple listings site, CHS is an active facilitator: it verifies documents and identities, holds funds in escrow until conditions are genuinely met, and provides a real dispute-resolution process if something goes wrong between two parties.</p>
      <p>CHS is built around one core rule that shapes everything else in this guide: every transaction started on CHS should be completed on CHS. That&apos;s what makes the escrow protection, the verification, and the dispute process actually mean something — none of it works if a deal moves off-platform halfway through.</p>
      <p>The platform serves many different kinds of people, each with their own dashboard and tools:</p>
      <ul className="list-disc pl-5 space-y-1 mb-2">
        <li>Buyers — searching to purchase, rent, lease, or hire a property</li>
        <li>Tenants — already renting, or about to start renting, through CHS</li>
        <li>Property Owners — listing a property to sell, rent, lease, or hire out</li>
        <li>Agents — marketing properties and earning referral commission</li>
        <li>Property Managers — managing properties professionally on behalf of owners</li>
        <li>Commercial Developers — selling estates, offering instalment or investment plans</li>
        <li>Vendors — selling building materials or services through the CHS Marketplace</li>
        <li>Artisans — skilled tradespeople (plumbers, electricians, painters, and more) who take on real maintenance jobs</li>
        <li>CHS Admin Team — the staff who verify, approve, and keep the platform running safely</li>
      </ul>
      <p>One person can hold more than one of these roles on the same account — for example, someone can be both a Property Owner and a Tenant. See &quot;Linking additional roles&quot; in the next section.</p>
      <h2 className="font-serif text-lg font-bold text-chs-charcoal mt-5 mb-2">2. Getting Started</h2>
      <h3 className="text-sm font-bold text-chs-charcoal mt-3 mb-1">2.1 Creating your account</h3>
      <p>Go to the Register page and choose the role that best describes why you&apos;re joining. You&apos;ll be asked for your name, phone number, email, and a password, plus some role-specific details:</p>
      <ul className="list-disc pl-5 space-y-1 mb-2">
        <li>Agent — your operating LGAs, years of real estate experience, and any professional association/membership ID you hold</li>
        <li>Property Manager — your profession, professional registration number (if any), the states you operate in, and an upload of your professional certificate or licence</li>
        <li>Commercial Developer — your company and project details</li>
      </ul>
      <p>Every account also needs a valid means of identification uploaded during registration or shortly after — this is what unlocks the platform&apos;s trust features later (see 2.3).</p>
      <h3 className="text-sm font-bold text-chs-charcoal mt-3 mb-1">2.2 Approval and verification status</h3>
      <p>New accounts start in a pending state while the CHS team confirms the details you provided are genuine. You&apos;ll get a real notification the moment a decision is made — approved accounts can use the platform immediately; if something needs fixing, you&apos;ll be told what and can update your details.</p>
      <h3 className="text-sm font-bold text-chs-charcoal mt-3 mb-1">2.3 Verifying your identity</h3>
      <p>Two separate, real verification steps exist on CHS, and they unlock different things:</p>
      <p><strong className="text-chs-charcoal">Valid ID Verification —</strong> uploading a real, valid means of ID (National ID, driver&apos;s licence, international passport, or voter&apos;s card). This is what&apos;s checked before certain high-trust actions are allowed — for example, listing a property under Urgent &amp; Emergency Sale (see section 6) requires this.</p>
      <p><strong className="text-chs-charcoal">Liveness / Face Verification —</strong> a genuine, real-time photo capture done directly on your device — never an uploaded or automated photo. This confirms the person using the account is a real person matching the account, and CHS staff review each capture directly rather than relying on any automated pass/fail.</p>
      <h3 className="text-sm font-bold text-chs-charcoal mt-3 mb-1">2.4 Logging in, and biometric login</h3>
      <p>Log in with your phone/email and password as normal. If your device supports it, you can also set up biometric login — Face ID, fingerprint, or your device&apos;s own screen lock — from your Profile page, so you don&apos;t need to re-type your password every time. This uses your device&apos;s own secure hardware; CHS never sees or stores your actual fingerprint or face data.</p>
      <h3 className="text-sm font-bold text-chs-charcoal mt-3 mb-1">2.5 Linking additional roles to one account</h3>
      <p>If you already have a CHS account and want to add another role to it — for example, you registered as a Buyer but now also want to list a property as an Owner, or you&apos;re a registered professional (Agent, Property Manager, Artisan) wanting to add a second professional role — use &quot;Link Account&quot; rather than registering a brand-new account. This keeps your one real identity, one wallet, and one login working across every role you hold.</p>
      <h3 className="text-sm font-bold text-chs-charcoal mt-3 mb-1">2.6 Terms &amp; Conditions, and your first-time guide</h3>
      <p>Before reaching your dashboard for the first time, you&apos;ll be asked to genuinely scroll through and accept the real CHS Terms &amp; Conditions — the checkbox only unlocks once you&apos;ve reached the bottom. Right after that, you&apos;ll see a short, role-specific quick-start guide (just for your own role — not the whole of this document) which you can dismiss once read; a permanent link to the fuller guide stays available afterward from your Profile page.</p>
      <h2 className="font-serif text-lg font-bold text-chs-charcoal mt-5 mb-2">3. Your CHS Wallet</h2>
      <p>Every CHS account gets a real wallet automatically, the moment your profile is created. It&apos;s the one place all your CHS money moves through — funding, spending, withdrawing, and now, sending to other users directly.</p>
      <h3 className="text-sm font-bold text-chs-charcoal mt-3 mb-1">3.1 Funding your wallet</h3>
      <p>From the Wallet page, enter an amount and tap &quot;Continue to pay.&quot; This opens a real, secure Paystack payment window — card, bank transfer, or USSD. Once the payment genuinely completes, your wallet balance updates automatically (usually within a few seconds).</p>
      <h3 className="text-sm font-bold text-chs-charcoal mt-3 mb-1">3.2 Withdrawing to your bank account</h3>
      <p>CHS deliberately allows only one linked bank account per wallet, for security — this is enforced at the database level, not just a setting you could work around. To withdraw, enter the amount from your Wallet page; funds are sent to your one linked account. If you need to change your linked account, that goes through a real, separate approval flow rather than an instant swap, to protect against someone else quietly redirecting your future withdrawals.</p>
      <h3 className="text-sm font-bold text-chs-charcoal mt-3 mb-1">3.3 Sending money to another CHS user</h3>
      <p>From the Wallet page, tap &quot;Send to another CHS user,&quot; enter their phone number or email, confirm you&apos;ve found the right person by name, enter an amount, and confirm. The transfer is instant and moves real money between the two wallets — you cannot send to yourself, and a transfer is blocked if your balance is insufficient or your wallet is currently frozen.</p>
      <h3 className="text-sm font-bold text-chs-charcoal mt-3 mb-1">3.4 Frozen wallets</h3>
      <p>CHS reserves the right to freeze a wallet pending a genuine investigation into suspected fraud or a policy violation. A frozen wallet can still be viewed, but withdrawals and transfers are blocked until the matter is resolved. If your wallet is frozen, you&apos;ll see this clearly on your Wallet page.</p>
      <h2 className="font-serif text-lg font-bold text-chs-charcoal mt-5 mb-2">4. Finding a Property (Buyers &amp; Tenants)</h2>
      <h3 className="text-sm font-bold text-chs-charcoal mt-3 mb-1">4.1 Searching and filtering</h3>
      <p>The homepage shows real, active, CHS-verified listings. Use the Rent / Sale / Shortlet tabs to narrow by purpose, and the search tool to filter by state, LGA, area, price range, property type, and minimum bedrooms.</p>
      <h3 className="text-sm font-bold text-chs-charcoal mt-3 mb-1">4.2 Saved Properties and Saved Searches</h3>
      <p>Tap the save icon on any listing to keep it in your &quot;Saved&quot; page for later. Separately, you can save a whole search — your exact filter combination (purpose, location, price range, bedrooms) — so you don&apos;t have to re-enter it every time; a saved search is also what powers a future vacancy-alert match if a new listing fits it.</p>
      <h3 className="text-sm font-bold text-chs-charcoal mt-3 mb-1">4.3 Making an offer or rental application</h3>
      <p>On a for-sale property, use &quot;Make an Offer&quot; to propose a price directly to the owner. On a rental, submit a rental application — CHS staff screen it first before it&apos;s passed to the owner for their final decision; the owner never sees an application CHS hasn&apos;t reviewed.</p>
      <h3 className="text-sm font-bold text-chs-charcoal mt-3 mb-1">4.4 The Sale Approval checkpoint</h3>
      <p>Once an owner accepts your offer on a for-sale property, the deal doesn&apos;t move straight to paperwork and escrow — CHS reviews and clears it first. This is the real checkpoint between an offer being accepted and money actually moving, designed to protect both sides before anything becomes final.</p>
      <h3 className="text-sm font-bold text-chs-charcoal mt-3 mb-1">4.5 Shortlet bookings</h3>
      <p>A shortlet is paid instantly through your CHS Wallet at time of booking, and held in escrow — not released to the host until your check-in is genuinely confirmed. You&apos;ll be asked for real guest details (name, phone, valid ID) before a booking is confirmed.</p>
      <h3 className="text-sm font-bold text-chs-charcoal mt-3 mb-1">4.6 Rent-to-Own</h3>
      <p>Some sale listings offer a rent-to-own path — paying a monthly amount that counts toward eventually owning the property outright, alongside a minimum deposit and a set number of years. Where available, this is shown directly on the property&apos;s listing page with the real monthly amount, the percentage that counts toward ownership, and the minimum deposit required.</p>
      <h3 className="text-sm font-bold text-chs-charcoal mt-3 mb-1">4.7 Talk to an Agent (Concierge)</h3>
      <p>If you&apos;d rather just describe what you&apos;re looking for in your own words instead of using the search filters, use &quot;Property request&quot; (in the bottom navigation) — type it out, or use your device&apos;s voice input. This is a real request that lands directly with the CHS team, who will search and follow up with you personally — a genuinely faster path when your requirements are specific or you&apos;re not sure exactly what to search for.</p>
      <h3 className="text-sm font-bold text-chs-charcoal mt-3 mb-1">4.8 Urgent &amp; Emergency Sale listings</h3>
      <p>Some for-sale properties are marked 🚨 Urgent Sale — a genuinely real, discounted, time-boxed sale from an owner who needs to sell fast (relocation, a medical situation, or another urgent financial need). These are shown with the real original price struck through next to the real discounted price, plus the actual deadline the owner needs to sell by. If you&apos;re interested, these listings show a direct CHS hotline number for faster processing than standard in-app messaging.</p>
      <h3 className="text-sm font-bold text-chs-charcoal mt-3 mb-1">4.9 A few quick questions when booking an inspection</h3>
      <p>When you book an inspection, you&apos;ll be asked three short questions — your timeline, whether your funds/deposit are ready, and whether you&apos;re the actual decision-maker. This never blocks your booking or costs anything extra — it simply helps the owner prioritize their own time fairly among genuinely ready buyers and tenants. Real, genuine attendance at inspections you book also matters here — it&apos;s one of the strongest real signals of serious interest.</p>
      <h2 className="font-serif text-lg font-bold text-chs-charcoal mt-5 mb-2">5. Listing and Managing Property (Owners)</h2>
      <h3 className="text-sm font-bold text-chs-charcoal mt-3 mb-1">5.1 Listing a property</h3>
      <p>From your Owner dashboard, use &quot;List a property&quot; to add a new listing — photos, location, price, purpose (rent/sale/shortlet), bedrooms, and any special terms (rent-to-own, house rules). A new listing starts unverified and isn&apos;t publicly visible until CHS confirms it.</p>
      <h3 className="text-sm font-bold text-chs-charcoal mt-3 mb-1">5.2 Getting verified</h3>
      <p>CHS reviews every new listing before it goes live — this is what makes &quot;CHS Verified&quot; mean something to a real buyer or tenant. You&apos;ll be notified the moment a decision is made, and everyone who&apos;d already expressed interest in the listing is notified too, the moment it goes live.</p>
      <h3 className="text-sm font-bold text-chs-charcoal mt-3 mb-1">5.3 Promoting a listing</h3>
      <p>There are two separate ways to get extra visibility for a listing, and you can pick either:</p>
      <h4 className="text-xs font-bold text-chs-red mt-2 mb-1">Fixed Boost</h4>
      <p>A one-off, paid tier — 7-Day Boost, 30-Day Featured, or 90-Day Premium — debited directly from your wallet at time of purchase. Good for a single, time-limited push.</p>
      <h4 className="text-xs font-bold text-chs-red mt-2 mb-1">Credits — read this before you buy</h4>
      <p>Buy a reusable pool of promotion credits (₦400 each), or subscribe to a monthly package (Classic, Premium, Elite, or Signature) which includes bonus credits. Here is exactly how consumption works, in plain terms:</p>
      <ul className="list-disc pl-5 space-y-1 mb-2">
        <li>Your credits are ONE shared balance across every listing you own — not split up per listing.</li>
        <li>Each listing you turn ON is charged separately, every real day it stays on, all from that same one balance.</li>
        <li>If you turn on 3 listings at once, you pay for all 3 that day — there is no fixed daily limit on the whole account; your real total simply depends on how many listings you keep active and each one&apos;s own real cost.</li>
        <li>Turn any listing OFF any day for free — you are never charged for a day it was off.</li>
        <li>The daily cost for a specific listing depends on its real location and size — the exact number is always shown on the promote screen before you buy or turn anything on.</li>
      </ul>
      <p>Each promoted listing is also assigned a real ranking — both a category (A through D) and a literal position (e.g. &quot;#3 of Top 10&quot;), based on how it compares to other promoted listings in the same real local market — not a fixed national price line, so a smaller market isn&apos;t unfairly outranked by a bigger one. A higher position reflects relatively higher spend within that comparison group; it is not a separate purchase on top of your credits.</p>
      <h3 className="text-sm font-bold text-chs-charcoal mt-3 mb-1">5.4 Urgent &amp; Emergency Sale — activating it</h3>
      <p>From your Owner dashboard, tap &quot;🚨 Urgent Sale&quot; on a for-sale listing. Three real requirements must be met first: the listing must already be CHS Verified, your own identity must be ID-verified, and you&apos;ll need to set a real original price (higher than your current listed price — this becomes the genuine &quot;before&quot; price buyers see) and a real deadline. The moment it activates, the CHS team is notified immediately to help fast-track buyer interest, and it automatically switches back to a normal listing once the deadline passes unless you renew it.</p>
      <h3 className="text-sm font-bold text-chs-charcoal mt-3 mb-1">5.5 House Rules</h3>
      <p>For a rental property, you can upload a House Rules document that a tenant must acknowledge as part of their tenancy — a real, documented agreement both sides can refer back to.</p>
      <h3 className="text-sm font-bold text-chs-charcoal mt-3 mb-1">5.6 Delegating management to a Property Manager</h3>
      <p>If you&apos;d rather not handle day-to-day management yourself, you can delegate a property to a registered Property Manager. Once delegated, maintenance requests and certain approvals route to the manager instead of you directly — and this can be reversed (management termination) if needed.</p>
      <h2 className="font-serif text-lg font-bold text-chs-charcoal mt-5 mb-2">6. Agents</h2>
      <p>Every registered agent gets a unique referral code (e.g. CHS-AG-0024), automatically attached to every property link generated from their dashboard.</p>
      <h3 className="text-sm font-bold text-chs-charcoal mt-3 mb-1">6.1 How the referral link works</h3>
      <p>A referral link always opens the property directly on CHS — never on your personal page or any third-party site — so CHS can verify the transaction and calculate your commission accurately, and so the buyer or tenant always transacts through CHS&apos;s real protections regardless of where they first saw the link.</p>
      <h3 className="text-sm font-bold text-chs-charcoal mt-3 mb-1">6.2 Where you can share it</h3>
      <p>Anywhere you already have an audience — your Facebook page, WhatsApp status, Instagram bio, a physical flyer with a short link, and so on. Sharing the link doesn&apos;t move any part of the transaction off CHS; it only brings the visitor to CHS.</p>
      <h3 className="text-sm font-bold text-chs-charcoal mt-3 mb-1">6.3 How commission is credited</h3>
      <p>If someone clicks your link, browses, and eventually completes a transaction on that property, CHS automatically attributes the deal to your code and credits your commission — no manual claim or extra step required from you.</p>
      <h2 className="font-serif text-lg font-bold text-chs-charcoal mt-5 mb-2">7. Property Managers</h2>
      <p>As a registered Property Manager, owners can delegate specific properties to you for day-to-day handling. Delegated properties route their maintenance and certain approval flows to you directly. Delegation can be reversed by the owner at any time (management termination), which hands the relevant responsibilities back to the owner.</p>
      <h2 className="font-serif text-lg font-bold text-chs-charcoal mt-5 mb-2">8. Commercial Developers</h2>
      <p>As a registered Developer, your application is reviewed by CHS before your projects (estates, instalment or investment plans) go live on the platform. Once approved, you can list and manage development projects through your Developer dashboard.</p>
      <h2 className="font-serif text-lg font-bold text-chs-charcoal mt-5 mb-2">9. Vendors — The CHS Marketplace</h2>
      <p>The Marketplace connects property owners, tenants, and managers with real vendors of building materials and services. To become a vendor, use &quot;Become a Vendor&quot; — your registration is reviewed and verified by CHS before your listings go live, the same trust standard applied everywhere else on the platform.</p>
      <p>As a vendor, real referral fees may apply on deals connected through the Marketplace, tracked automatically and visible from your vendor dashboard.</p>
      <h2 className="font-serif text-lg font-bold text-chs-charcoal mt-5 mb-2">10. Artisans</h2>
      <h3 className="text-sm font-bold text-chs-charcoal mt-3 mb-1">10.1 Becoming an artisan</h3>
      <p>Use &quot;Become an Artisan&quot; to register. Select every real trade you genuinely have — you&apos;re not limited to one:</p>
      <ul className="list-disc pl-5 space-y-1 mb-2">
        <li>Painter, Plumber, Electrician, Carpenter, Bricklayer/Mason, Tiler</li>
        <li>Welder/Metal fabricator, Roofer, POP/Ceiling installer</li>
        <li>AC/Refrigeration technician, Generator technician, Aluminium/Glazier</li>
        <li>Interior decorator, Landscaper/Gardener, Borehole driller</li>
        <li>Professional cleaner, Fumigation/Pest control, or Other</li>
      </ul>
      <p>You&apos;ll also declare your real years of experience, any certification body, and your equipment level (basic hand tools, power tools, or professional-grade) — claims about equipment can be backed with a real photo and receipt, since CHS verifies what&apos;s claimed rather than taking it on trust alone.</p>
      <h3 className="text-sm font-bold text-chs-charcoal mt-3 mb-1">10.2 Getting verified</h3>
      <p>Your registration is reviewed by CHS before you can quote on real jobs. Once verified, you&apos;re notified and can start quoting on maintenance jobs matching your trade and location.</p>
      <h3 className="text-sm font-bold text-chs-charcoal mt-3 mb-1">10.3 Fault reports and quotes</h3>
      <p>When a tenant or owner reports a maintenance fault, it&apos;s routed to the right decision-maker first — the property manager if that property&apos;s management is genuinely delegated, the owner otherwise. Real quotations from artisans are ranked by a transparent formula weighted toward rating and reliability first, experience second, and equipment third. For any property under full CHS management, maintenance work is offered first and exclusively to verified CHS Maintenance Agents.</p>
      <h3 className="text-sm font-bold text-chs-charcoal mt-3 mb-1">10.4 Disputes on a completed job</h3>
      <p>Either you or the client can raise a genuine, two-sided dispute about a completed job if something went wrong — CHS reviews these directly rather than automatically siding with either party.</p>
      <h2 className="font-serif text-lg font-bold text-chs-charcoal mt-5 mb-2">11. Engaging CHS for a Professional Service</h2>
      <p>Beyond listings, CHS itself offers direct professional services — Full Property Management, Sale Negotiation, Construction Monitoring, Project Management, and Renovation. Use &quot;Engage CHS&quot; to submit a real request describing what you need; the CHS team will respond directly, and each service carries its own specific terms and fee schedule reviewed with you before work begins.</p>
      <h3 className="text-sm font-bold text-chs-charcoal mt-3 mb-1">11.1 Construction Roadmap</h3>
      <p>If you&apos;re considering Construction Monitoring or Full Construction/Project Management, you can unlock a real Construction Roadmap for your specific building type (1–4 bedroom bungalow, or 3–5 bedroom duplex) for a one-time fee — real room-by-room quantities, a real Kaduna permits checklist, a real milestone payment plan, and an estimated cost range. This fee is fully credited toward your real project cost if you proceed with CHS for construction — it&apos;s never money lost if you go ahead. The cost range shown is a general, sourced market indication, clearly labeled as such, until CHS&apos;s own verified rates are available for your specific configuration.</p>
      <h2 className="font-serif text-lg font-bold text-chs-charcoal mt-5 mb-2">12. Disputes and Community Feedback</h2>
      <p>If a real disagreement arises between two parties on a transaction, either side can raise a dispute — CHS&apos;s internal resolution process is the first step, ahead of arbitration or the courts, per the platform&apos;s Terms &amp; Conditions. Separately, Community Feedback is the place for general suggestions, complaints, or praise about the platform itself, not tied to a specific transaction.</p>
      <h2 className="font-serif text-lg font-bold text-chs-charcoal mt-5 mb-2">13. Notifications</h2>
      <p>The notification bell keeps you updated in real time — a new offer, an approval decision, a message, a wallet transfer received, and more. From your Profile page, you can control which categories you receive: offers, messages, and marketing/promotional notifications each have their own real on/off toggle.</p>
      <h2 className="font-serif text-lg font-bold text-chs-charcoal mt-5 mb-2">14. Account Settings</h2>
      <ul className="list-disc pl-5 space-y-1 mb-2">
        <li>Notification preferences — control offers, messages, and marketing notifications independently</li>
        <li>Diaspora Mode — a setting for CHS users managing property or transactions from outside Nigeria</li>
        <li>Biometric login — set up or remove Face ID / fingerprint login for this device</li>
        <li>Linked bank account — view your one linked account; changing it goes through a real approval flow</li>
      </ul>
      <h2 className="font-serif text-lg font-bold text-chs-charcoal mt-5 mb-2">15. Market Data</h2>
      <p>From the bottom navigation, &quot;Average property prices&quot; and &quot;Property demand trend&quot; show real, genuine market data — actual current listing prices and demand patterns, not estimated or placeholder figures.</p>
      <div className="border-t border-gray-200 my-3" />
      <h2 className="font-serif text-lg font-bold text-chs-charcoal mt-5 mb-2">16. For the CHS Admin Team</h2>
      <p>This section is written for CHS staff operating the platform, not for the general public.</p>
      <h3 className="text-sm font-bold text-chs-charcoal mt-3 mb-1">16.1 Super Admin</h3>
      <p>There is one real Super Admin account, practically involved in every part of the platform. The Super Admin handles Finance and Engagement (Engage CHS requests) directly, and is the one who reviews and ratifies every high-stakes decision made by a sub-admin before it actually takes effect.</p>
      <h3 className="text-sm font-bold text-chs-charcoal mt-3 mb-1">16.2 Sub-admin roles</h3>
      <p>Every other admin is assigned to exactly one of five real domains by the Super Admin, and can only ever see and act within that domain:</p>
      <ul className="list-disc pl-5 space-y-1 mb-2">
        <li>Customer Care — disputes, community feedback</li>
        <li>Registration &amp; Setup — new account approvals, face/liveness verification</li>
        <li>Owner/Buyer/Tenant — property verification, rental applications, sale approvals, inspections, concierge requests</li>
        <li>Agent Relations — referral fee tracking</li>
        <li>Artisan/Developer/PM/Vendor — artisan, vendor, and developer verification, maintenance routing</li>
      </ul>
      <h3 className="text-sm font-bold text-chs-charcoal mt-3 mb-1">16.3 The approval queue — how sign-off works</h3>
      <p>Routine actions (like moving a fault report forward, or triaging feedback) happen immediately. High-stakes actions — anything financial, and every verification decision — do not take effect the moment a sub-admin submits them. They&apos;re held in a real pending queue until the Super Admin actually approves or rejects it; only then does the real change apply and the affected user get notified. A sub-admin can only ever submit a request within their own assigned domain — attempting anything outside it is blocked outright.</p>
      <h3 className="text-sm font-bold text-chs-charcoal mt-3 mb-1">16.4 Logging in as an admin</h3>
      <p>A sub-admin&apos;s password alone isn&apos;t enough to reach the dashboard. After a correct password, a real approval code is generated and sent directly to the Super Admin, who must approve the specific login attempt before it goes through — closing the gap a simple accept/reject tap would leave open.</p>
      <h3 className="text-sm font-bold text-chs-charcoal mt-3 mb-1">16.5 Assigning a sub-admin role</h3>
      <p>From the Super Admin&apos;s Overview tab, use &quot;Assign an admin role&quot; — enter the person&apos;s existing phone number or email (they must already have a real CHS account) and select their domain. This promotes their existing account; it does not create a brand-new one.</p>
      <h3 className="text-sm font-bold text-chs-charcoal mt-3 mb-1">16.6 Trace an Account — resolving a real support issue</h3>
      <p>Search by phone, email, or name to find a real person, then see everything real about them in one place: wallet balance and full transaction history, promotion credit history and every active or past promotion, every construction roadmap unlock, their linked bank account, and every Engage CHS request. This is the real tool for resolving a complaint like &quot;I paid but nothing happened&quot; — the same way a phone network&apos;s support line traces an issue the moment you give them your number. Super Admin only, since it surfaces real financial data across every system.</p>
      <h3 className="text-sm font-bold text-chs-charcoal mt-3 mb-1">16.7 Sub-admin action history</h3>
      <p>Once a sub-admin&apos;s request is approved or rejected, it doesn&apos;t just disappear — &quot;View sub-admin action history&quot; on the Overview tab shows a real, permanent record of every past decision, who made it, and any note attached.</p>
      <div className="border-t border-gray-200 my-3" />
      <h2 className="font-serif text-lg font-bold text-chs-charcoal mt-5 mb-2">17. Getting Help</h2>
      <p>If something in the app doesn&apos;t behave the way this guide describes, or you&apos;re stuck on something not covered here, use &quot;Property request&quot; / &quot;Talk to an Agent&quot; to reach the CHS team directly, or Community Feedback to flag a general platform issue. For anything urgent involving an active transaction or payment, contact CHS support directly rather than waiting.</p>
      <p>This guide reflects the CHS platform as it stands today, including every feature described above. As new features are added, this guide should be updated alongside them — the same discipline applied to the platform&apos;s Terms &amp; Conditions.</p>
    </div>
  );
}