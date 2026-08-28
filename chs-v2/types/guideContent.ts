// Real, condensed per-role guide content — a shorter version of the
// full CHS_USERS_GUIDE.docx, organized so a first-time dashboard visit
// shows only the sections relevant to that person's own role, not the
// whole 11-page document. The full guide remains available separately
// for anyone who wants to read further (see the "from there I can
// read at large" requirement).

export interface GuideSection {
  title: string;
  body: string;
}

export const ROLE_GUIDES: Record<string, { title: string; sections: GuideSection[] }> = {
  owner: {
    title: "Quick-start for Property Owners",
    sections: [
      { title: "Listing a property", body: "From your Owner dashboard, use \"List a property\" — photos, location, price, purpose (rent/sale/shortlet), and any special terms. A new listing starts unverified and isn't publicly visible until CHS confirms it." },
      { title: "Getting verified", body: "CHS reviews every new listing before it goes live. You'll be notified the moment a decision is made, and everyone who'd already expressed interest is notified too, the moment it goes live." },
      { title: "Promoting a listing", body: "Two ways: a one-off Fixed Boost (7/30/90 days, debited from your wallet), or reusable Credits. Important: credits are ONE shared balance across all your listings — each listing you turn on is charged separately, every day it stays on, from that same balance. Turn off any day for free; never charged for a day it's off. Full details, including your real total daily cost, are always shown on the promote screen before you pay." },
      { title: "Urgent & Emergency Sale", body: "For a genuine urgent sale need — requires the listing already verified and your ID verified. Set a real original price and deadline; CHS is notified immediately to help fast-track buyer interest." },
      { title: "Delegating to a Property Manager", body: "If you'd rather not handle day-to-day management, delegate a property to a registered Property Manager — reversible any time." },
    ],
  },
  tenant: {
    title: "Quick-start for Tenants",
    sections: [
      { title: "Searching", body: "Use the Rent tab and the search tool to filter by state, LGA, area, price range, and bedrooms." },
      { title: "Rental applications", body: "Submit a rental application — CHS staff screen it first before it's passed to the owner. The owner never sees an application CHS hasn't reviewed." },
      { title: "Inspections", body: "Book a real inspection with a transport fee split fairly between attendees. A few quick questions at booking help the owner prioritize genuinely ready tenants — this never blocks or charges you extra." },
      { title: "House Rules", body: "Some rentals include a House Rules document you'll be asked to acknowledge as part of your tenancy — a real, documented agreement both sides can refer back to." },
      { title: "Your wallet", body: "Every account gets a real wallet automatically. Fund it via Paystack, and you can send money directly to another CHS user by their phone or email." },
    ],
  },
  buyer: {
    title: "Quick-start for Buyers",
    sections: [
      { title: "Searching", body: "Use the Sale tab and search filters, or save a search to be matched automatically as new listings come in." },
      { title: "Making an offer", body: "Propose a price directly to the owner. Once accepted, CHS reviews and clears the deal before anything moves to escrow — a real checkpoint protecting both sides." },
      { title: "Urgent & Emergency Sale listings", body: "Marked 🚨 on the homepage — a genuine, discounted, time-boxed sale with a real deadline. Shows a direct CHS hotline for faster processing." },
      { title: "Talk to an Agent", body: "Not sure exactly what to search for? Use \"Property request\" in the bottom navigation to describe what you need in your own words — CHS follows up personally." },
      { title: "Rent-to-Own", body: "Some sale listings offer a rent-to-own path — a monthly amount that counts toward eventual ownership, shown directly on the listing where available." },
    ],
  },
  agent: {
    title: "Quick-start for Agents",
    sections: [
      { title: "Your referral link", body: "Every agent gets a unique code (e.g. CHS-AG-0024), automatically attached to every property link from your dashboard. It always opens the property directly on CHS." },
      { title: "Where to share it", body: "Anywhere you already have an audience — Facebook, WhatsApp status, Instagram bio, a flyer with a short link. Sharing the link never moves any part of the deal off CHS." },
      { title: "How commission is credited", body: "If someone clicks your link and eventually completes a transaction on that property, CHS automatically attributes it and credits your commission — no manual claim needed." },
      { title: "Referral fees dashboard", body: "Track every owed and paid commission directly from your Agent dashboard." },
    ],
  },
  manager: {
    title: "Quick-start for Property Managers",
    sections: [
      { title: "Delegated properties", body: "Owners can delegate specific properties to you for day-to-day handling. Delegated properties route their maintenance and certain approvals to you directly." },
      { title: "Management termination", body: "An owner can reverse delegation at any time, handing responsibilities back to them." },
      { title: "Maintenance routing", body: "Fault reports on your delegated properties are routed to you first. For properties under full CHS management, maintenance work goes first to verified CHS Maintenance Agents." },
    ],
  },
  developer: {
    title: "Quick-start for Commercial Developers",
    sections: [
      { title: "Registration review", body: "Your application is reviewed by CHS before your projects (estates, instalment/investment plans) go live." },
      { title: "Managing projects", body: "Once approved, list and manage development projects through your Developer dashboard." },
    ],
  },
  vendor: {
    title: "Quick-start for Marketplace Vendors",
    sections: [
      { title: "Becoming a vendor", body: "Your registration is reviewed and verified by CHS before your listings go live — the same trust standard applied everywhere else on the platform." },
      { title: "Referral fees", body: "Real referral fees may apply on deals connected through the Marketplace, tracked automatically from your vendor dashboard." },
    ],
  },
  artisan: {
    title: "Quick-start for Artisans",
    sections: [
      { title: "Getting verified", body: "Your registration is reviewed before you can quote on real jobs. Once verified, you can quote on maintenance jobs matching your trade and location." },
      { title: "How quotes are ranked", body: "Weighted toward rating and reliability first, experience second, equipment third — a transparent formula, not pay-to-win." },
      { title: "Full-management properties", body: "For any property under full CHS management, maintenance work is offered first and exclusively to verified CHS Maintenance Agents." },
      { title: "Disputes", body: "Either you or the client can raise a genuine, two-sided dispute about a completed job — CHS reviews these directly." },
    ],
  },
  admin: {
    title: "Quick-start for CHS Admin",
    sections: [
      { title: "Your assigned domain", body: "Unless you're the Super Admin, you're assigned to exactly one domain and can only see and act within it." },
      { title: "The approval queue", body: "Routine actions happen immediately. High-stakes actions (finance, every verification decision) are held pending until the Super Admin approves — visible on the Overview tab." },
      { title: "Logging in", body: "A correct password alone isn't enough — a real approval code is generated and sent to the Super Admin, who must approve your specific login attempt." },
      { title: "Trace an Account (Super Admin)", body: "Search any real user by phone/email/name to see their full wallet, promotion, roadmap, and Engage CHS history in one place — the real tool for resolving a support issue." },
    ],
  },
};
