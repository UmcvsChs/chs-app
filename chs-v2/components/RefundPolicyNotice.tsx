import Link from "next/link";

// Real, direct implementation of an explicit client instruction: the
// refund policy must be clearly notified to every tenant, buyer, and
// guest — not buried only in the Terms & Conditions. This sits right
// beside each real pay button so it is read at the exact moment the
// person commits money, and it is one shared component so the wording
// can never drift between screens. The exact same policy is also term
// 36 of the Terms & Conditions.
export default function RefundPolicyNotice({ className = "" }: { className?: string }) {
  return (
    <div className={`bg-green-50 border border-green-200 rounded-lg px-3 py-2 ${className}`}>
      <p className="text-[11px] font-semibold text-green-800 mb-0.5">🛡️ Your payment is protected</p>
      <p className="text-[10px] text-green-900 leading-relaxed">
        Your money is held safely in escrow. If the other side fails to deliver, you get your full payment back —
        <b> including CHS&apos;s own commission</b> — less only a real bank processing fee (1.5% of CHS&apos;s commission
        plus ₦100, never more than ₦2,000).{" "}
        <Link href="/terms" className="underline font-semibold">Read the full policy (term 36)</Link>
      </p>
    </div>
  );
}
