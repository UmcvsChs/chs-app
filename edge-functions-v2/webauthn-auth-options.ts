// Real WebAuthn login (authentication) options — this runs BEFORE the
// person has a session, since biometric login IS the login. Uses the
// service role deliberately and carefully, only to look up which
// credentials exist for the phone number given — never to bypass any
// real security check.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateAuthenticationOptions } from "https://esm.sh/@simplewebauthn/server@9";

const RP_ID = Deno.env.get("WEBAUTHN_RP_ID") || "chs.ng";

serve(async (req) => {
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { phone } = await req.json();
  const { data: profile } = await supabaseAdmin.from("profiles").select("id").eq("phone", phone).maybeSingle();
  if (!profile) return new Response(JSON.stringify({ error: "No account found" }), { status: 404 });

  const { data: creds } = await supabaseAdmin
    .from("webauthn_credentials")
    .select("credential_id")
    .eq("user_id", profile.id);

  if (!creds || creds.length === 0) {
    return new Response(JSON.stringify({ error: "No biometric login set up for this account" }), { status: 404 });
  }

  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    allowCredentials: creds.map((c) => ({ id: c.credential_id, type: "public-key" })),
    userVerification: "required",
  });

  await supabaseAdmin.from("webauthn_challenges").upsert({ user_id: profile.id, challenge: options.challenge });

  return new Response(JSON.stringify({ options, userId: profile.id }), { headers: { "Content-Type": "application/json" } });
});
