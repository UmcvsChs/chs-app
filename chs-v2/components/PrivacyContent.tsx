// The single real source of the Privacy Policy body. Written to match
// what the platform genuinely does, checked against the actual
// verification flow, the actual database, and the actual RLS rules —
// not a generic template. This should be reviewed by a Nigerian
// lawyer familiar with the Nigeria Data Protection Act (NDPA) before
// being treated as a final, legally complete statement — this is a
// real, honest first draft of what CHS actually collects and does
// with it, not a substitute for that legal review.
export default function PrivacyContent() {
  return (
    <div className="text-sm text-gray-600 leading-relaxed space-y-3">
      <p className="text-xs text-gray-400">Last updated: September 2026</p>

      <p><strong className="text-chs-charcoal">1. Who this covers.</strong> This Privacy Policy applies to everyone who uses the CHS platform — buyers, tenants, owners, agents, managers, guests, hosts, vendors, artisans, and developers — whether or not you complete identity verification.</p>

      <p><strong className="text-chs-charcoal">2. What CHS collects.</strong></p>
      <ul className="list-disc pl-5 space-y-1">
        <li><strong className="text-chs-charcoal">At registration:</strong> your full name, phone number, and a National Identification Number (NIN).</li>
        <li><strong className="text-chs-charcoal">At identity verification</strong> (required before making an offer, applying to rent, booking a stay, requesting an inspection, or engaging CHS for a professional service): the name exactly as printed on a government-issued ID, gender, age bracket, state and full residential address, occupation, email address, a contact phone number, and a photo or scan of the ID itself.</li>
        <li><strong className="text-chs-charcoal">If you stand as a guarantor:</strong> your relationship to the applicant, address, occupation, your own ID, and a real proof of address dated within the last 90 days.</li>
        <li><strong className="text-chs-charcoal">Face verification (where used):</strong> a photo captured directly on your device during a short liveness check, confirming a real person is completing the step.</li>
        <li><strong className="text-chs-charcoal">Transaction data:</strong> offers, rental applications, bookings, messages exchanged through the platform, condition reports, payment records, and wallet transactions.</li>
        <li><strong className="text-chs-charcoal">Technical data:</strong> the device and browser you use to access CHS, and basic usage logs, collected automatically to keep the platform working and secure.</li>
      </ul>

      <p><strong className="text-chs-charcoal">3. Why CHS collects it.</strong></p>
      <ul className="list-disc pl-5 space-y-1">
        <li>To confirm you are a real, accountable person — the foundation of CHS&apos;s trust and safety model (see Terms &amp; Conditions, term 32).</li>
        <li>To let a guarantor be independently reached and verified, protecting both the tenant and the landlord.</li>
        <li>To process payments, hold funds in escrow correctly, and release them to the right person at the right time.</li>
        <li>To resolve a dispute, a fault report, or a support request.</li>
        <li>Where you become genuinely unreachable, to serve a real legal notice through the contact details you provided (see Terms &amp; Conditions, term 30) — this is a narrow, specific use, not a general licence to contact you for anything.</li>
        <li>To meet CHS&apos;s own legal and regulatory obligations under Nigerian law.</li>
      </ul>

      <p><strong className="text-chs-charcoal">4. Who can see your data.</strong> CHS deliberately limits this:</p>
      <ul className="list-disc pl-5 space-y-1">
        <li>Your own ID number and uploaded ID document are visible only to you and to CHS staff reviewing your verification. A counterparty you transact with — an owner, a buyer, a host — never sees these; they see only a confirmation that you are verified.</li>
        <li>An owner or host sees the real details their own screens genuinely need to make a decision — for example, an applicant&apos;s occupation and income source on a rental application — but not their NIN, ID document, or, in most cases, their phone number, which CHS handles directly on their behalf.</li>
        <li>CHS staff can access what their specific role requires — a registration reviewer sees verification submissions; a finance-domain admin sees wallet activity; a super admin has full access for platform administration and support.</li>
        <li>CHS does not sell your personal data to anyone, for any reason.</li>
        <li>CHS may share information with a real law enforcement or regulatory body where genuinely required by Nigerian law.</li>
      </ul>

      <p><strong className="text-chs-charcoal">5. How long CHS keeps it.</strong> Your data is kept for as long as your account is active, and for a reasonable period afterward to meet real legal, tax, and dispute-resolution obligations. A photo captured for face verification and an ID document are stored securely and are not made public.</p>

      <p><strong className="text-chs-charcoal">6. Your rights.</strong> You can ask CHS to correct inaccurate information on your profile, request a copy of the personal data CHS holds about you, and ask questions about how your data is used. Changing your registered name resets your identity verification, since a verification is genuinely tied to the name it was issued against (see Terms &amp; Conditions, term regarding profile edits). To exercise any of these rights, contact CHS support using the details below.</p>

      <p><strong className="text-chs-charcoal">7. Security.</strong> ID documents and government identification numbers are stored in restricted, access-controlled storage, separate from publicly viewable content. Wallet and payment data is protected by the same database-level access rules that govern every other part of the platform. No system is perfectly secure, and CHS will notify affected users directly if a real data breach genuinely occurs.</p>

      <p><strong className="text-chs-charcoal">8. Changes to this policy.</strong> CHS may update this policy as the platform changes. Continuing to use CHS after an update means you accept the current version.</p>

      <p className="text-xs text-gray-400 bg-[var(--zone-card)] rounded-lg p-3 mt-4">
        Questions about your data, or a request to correct or access it, can be sent to CHS support at <a href="mailto:support@completehousingsolutions.com" className="underline">support@completehousingsolutions.com</a>. This policy should be read alongside the CHS Terms &amp; Conditions.
      </p>
    </div>
  );
}
