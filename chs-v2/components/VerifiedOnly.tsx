"use client";

import { useState, ReactNode } from "react";
import { Session } from "@supabase/supabase-js";
import IdentityVerificationGate from "@/components/IdentityVerificationGate";
import CompleteDetailsPrompt from "@/components/CompleteDetailsPrompt";

// One shared rule, per a direct client instruction: identity
// verification comes first, for anyone doing anything that commits
// them to something — not only buyers. Previously the rule existed
// only on the buyer's offer screen; a tenant could fill in and submit
// a whole rental application without ever being verified.
//
// While someone isn't verified, they see the verification step and
// nothing else — so they never fill in a long form only to be turned
// away at the end. Once CHS has approved them, the form appears
// automatically, and this step never shows again. The database
// enforces the same rule independently, so this screen is a courtesy
// to the user, not the only lock on the door.
// Remembered for this browser session only, so a form that remounts
// between steps does not flash blank while the check runs again. The
// database still enforces verification independently every time.
const verifiedThisSession = new Set<string>();

export default function VerifiedOnly({
  session,
  propertyId,
  children,
}: {
  session: Session;
  propertyId?: string;
  children: ReactNode;
}) {
  const [verified, setVerified] = useState(() => verifiedThisSession.has(session.user.id));

  return (
    <>
      <IdentityVerificationGate
        session={session}
        propertyId={propertyId}
        onVerified={() => { verifiedThisSession.add(session.user.id); setVerified(true); }}
      />
      {verified && <CompleteDetailsPrompt session={session} />}
      {verified ? children : null}
    </>
  );
}
