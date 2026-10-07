// THE RULE: every payment on CHS is made through the person's own CHS Wallet — and only there. Nobody is ever to
// pay money to a person or to a bank account, whoever they say they are. This one shared notice carries that rule to
// the places where money is handled (and a slim version to every page), so the wording can never drift.
//   variant "bar"     one slim line shown at the top of every page
//   variant "full"    a prominent card — wallet, login, registration
//   variant "compact" a short line beside a pay button
export default function PaymentSafetyNotice({ variant = "compact", className = "" }: { variant?: "bar" | "full" | "compact"; className?: string }) {
  if (variant === "bar") {
    return (
      <div role="note" className={`bg-chs-charcoal text-white text-[10px] leading-tight text-center px-3 py-1.5 ${className}`}>
        🔒 <b>Pay only through your CHS Wallet.</b> Never send money to any person or bank account — even if they say they are from CHS.
      </div>
    );
  }
  if (variant === "full") {
    return (
      <div role="note" className={`bg-red-50 border-2 border-chs-red rounded-xl px-3.5 py-3 ${className}`}>
        <p className="text-xs font-bold text-chs-red">🔒 Important: every payment on CHS is made through your CHS Wallet — nowhere else</p>
        <ul className="text-[11px] text-chs-charcoal leading-relaxed mt-1 list-disc pl-4 space-y-0.5">
          <li><b>Never</b> transfer money to any person&apos;s account — not an agent, an owner, a host, a vendor, or anyone who says they represent CHS.</li>
          <li>CHS staff and agents will <b>never</b> ask you to pay into a personal or bank account, to “send it first”, or to share your PIN or wallet code.</li>
          <li>Rent, purchases, bookings, inspection costs and fees are all paid <b>from your Wallet</b> inside the app. If you are asked to pay any other way, it is a scam.</li>
          <li>If anyone asks you to pay outside the app, <b>stop</b> and report it to CHS straight away.</li>
        </ul>
      </div>
    );
  }
  return (
    <p role="note" className={`text-[10px] text-chs-red font-semibold leading-snug ${className}`}>
      🔒 Pay only from your CHS Wallet. Never pay any person or bank account, even one claiming to be CHS.
    </p>
  );
}
