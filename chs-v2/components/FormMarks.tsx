// One consistent way to tell people what they MUST fill in and what they may skip, on every form:
//   <Req />   a red asterisk after a label — the form will not go ahead without it
//   <Opt />   "(optional)" after a label — can be left blank
//   <RequiredLegend /> the one-line key shown at the top of a form
export function Req() {
  return <span className="text-chs-red" aria-label="required"> *</span>;
}

export function Opt() {
  return <span className="font-normal text-gray-400"> (optional)</span>;
}

export function RequiredLegend({ className = "" }: { className?: string }) {
  return (
    <p className={`text-[10px] text-gray-500 ${className}`}>
      <span className="text-chs-red font-semibold">*</span> Required — you must fill it in. Fields marked <span className="text-gray-400">(optional)</span> can be left blank.
    </p>
  );
}
