// Verifies a real registration response from the browser's native
// biometric prompt, and genuinely stores the credential — never
// trusts the client's own claim of success.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyRegistrationResponse } from "https://esm.sh/@simplewebauthn/server@9";

const RP_ID = Deno.env.get("WEBAUTHN_RP_ID") || "chs.ng";
const ORIGIN = Deno.env.get("WEBAUTHN_ORIGIN") || "https://chs.ng";

serve(async (req) => {
  const authHeader = req.headers.get("Authorization");
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader! } } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401 });

  const { response, deviceLabel } = await req.json();

  const { data: challengeRow } = await supabase
    .from("webauthn_challenges")
    .select("challenge")
    .eq("user_id", user.id)
    .single();
  if (!challengeRow) return new Response(JSON.stringify({ error: "No pending challenge" }), { status: 400 });

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge: challengeRow.challenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
  });

  if (!verification.verified || !verification.registrationInfo) {
    return new Response(JSON.stringify({ error: "Verification failed" }), { status: 400 });
  }

  const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;
  await supabase.from("webauthn_credentials").insert({
    user_id: user.id,
    credential_id: credentialID,
    public_key: btoa(String.fromCharCode(...credentialPublicKey)),
    counter,
    device_label: deviceLabel || "This device",
  });
  await supabase.from("webauthn_challenges").delete().eq("user_id", user.id);

  return new Response(JSON.stringify({ verified: true }), { headers: { "Content-Type": "application/json" } });
});
