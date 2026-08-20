// Verifies a real login attempt against the stored credential, and
// only on genuine success issues a real Supabase session — via a
// real, one-time magic link token, Supabase's own standard mechanism
// for a server-verified passwordless sign-in, never a shortcut around
// real authentication.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuthenticationResponse } from "https://esm.sh/@simplewebauthn/server@9";

const RP_ID = Deno.env.get("WEBAUTHN_RP_ID") || "chs.ng";
const ORIGIN = Deno.env.get("WEBAUTHN_ORIGIN") || "https://chs.ng";

serve(async (req) => {
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { userId, response } = await req.json();

  const { data: challengeRow } = await supabaseAdmin.from("webauthn_challenges").select("challenge").eq("user_id", userId).single();
  if (!challengeRow) return new Response(JSON.stringify({ error: "No pending challenge" }), { status: 400 });

  const { data: cred } = await supabaseAdmin
    .from("webauthn_credentials")
    .select("*")
    .eq("credential_id", response.id)
    .eq("user_id", userId)
    .single();
  if (!cred) return new Response(JSON.stringify({ error: "Credential not recognised" }), { status: 400 });

  const publicKeyBytes = Uint8Array.from(atob(cred.public_key), (c) => c.charCodeAt(0));

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challengeRow.challenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
    authenticator: { credentialID: cred.credential_id, credentialPublicKey: publicKeyBytes, counter: cred.counter },
  });

  if (!verification.verified) {
    return new Response(JSON.stringify({ error: "Verification failed" }), { status: 400 });
  }

  await supabaseAdmin.from("webauthn_credentials").update({ counter: verification.authenticationInfo.newCounter }).eq("id", cred.id);
  await supabaseAdmin.from("webauthn_challenges").delete().eq("user_id", userId);

  const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email: authUser.user?.email!,
  });
  if (linkError || !linkData) {
    return new Response(JSON.stringify({ error: "Could not establish session" }), { status: 500 });
  }

  return new Response(JSON.stringify({
    verified: true,
    token_hash: linkData.properties.hashed_token,
  }), { headers: { "Content-Type": "application/json" } });
});
