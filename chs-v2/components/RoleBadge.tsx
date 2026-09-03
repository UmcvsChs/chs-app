// Real, new fix per direct client feedback from live testing: testing
// multiple accounts across browser tabs made it genuinely easy to
// lose track of which real dashboard — and which role — you were
// looking at. A small, consistent, bold badge on every dashboard
// header, so the role is unmistakable at a glance, on top of the
// zone background color each dashboard already carries.
export default function RoleBadge({ label }: { label: string }) {
  return (
    <span className="inline-block bg-white/20 text-white text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full mt-1">
      {label}
    </span>
  );
}
