"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// Real, new page per direct client request: four real, distinct
// contact emails and two real phone numbers, genuinely fetched from
// admin-editable settings rather than hardcoded — so CHS can update
// these themselves at any time.
interface ContactSettings {
  contact_email_admin: string;
  contact_email_engage: string;
  contact_email_inquiry: string;
  contact_email_support: string;
  contact_phone_primary: string;
  contact_phone_secondary: string;
}

export default function ContactUsPage() {
  const router = useRouter();
  const [contact, setContact] = useState<ContactSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.rpc("get_contact_settings").then(({ data }) => {
      setContact(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>;
  }

  const cards = contact ? [
    {
      label: "Customer Support",
      desc: "For help with your account, a transaction, or anything not working as expected.",
      email: contact.contact_email_support,
      icon: "🛟",
    },
    {
      label: "General Inquiries",
      desc: "For general questions about CHS, its features, or the platform.",
      email: contact.contact_email_inquiry,
      icon: "💬",
    },
    {
      label: "Engage CHS for a Service",
      desc: "To formally engage CHS for one of its listed professional services (property management, sale negotiation, construction monitoring, and more).",
      email: contact.contact_email_engage,
      icon: "🤝",
    },
    {
      label: "Talk to Admin",
      desc: "To reach CHS administration directly.",
      email: contact.contact_email_admin,
      icon: "🏢",
    },
  ] : [];

  return (
    <div className="min-h-screen bg-[var(--zone-bg)] pb-10">
      <div className="bg-chs-charcoal text-white px-4 py-4">
        <button onClick={() => router.back()} className="text-xs text-white/70">← Back</button>
        <h1 className="font-serif text-lg font-bold mt-1">Contact CHS</h1>
        <p className="text-xs text-white/60 mt-1">Real people, real channels — choose the one that fits what you need.</p>
      </div>

      <div className="px-4 py-4 space-y-3">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm font-bold text-chs-charcoal mb-1">{c.icon} {c.label}</p>
            <p className="text-xs text-gray-500 mb-2">{c.desc}</p>
            <a href={`mailto:${c.email}`} className="text-sm font-semibold text-chs-red underline">
              {c.email}
            </a>
          </div>
        ))}

        {contact && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm font-bold text-chs-charcoal mb-2">📞 Call or WhatsApp Us</p>
            <a href={`tel:${contact.contact_phone_primary}`} className="block text-sm font-semibold text-chs-red underline mb-1">
              {contact.contact_phone_primary}
            </a>
            <a href={`tel:${contact.contact_phone_secondary}`} className="block text-sm font-semibold text-chs-red underline">
              {contact.contact_phone_secondary}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
