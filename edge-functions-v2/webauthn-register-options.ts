// Real WebAuthn registration options — generates a genuine, random
// challenge for the browser's native biometric prompt (Face ID,
// fingerprint, Windows Hello). Deploy as a Supabase Edge Function.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateRegistrationOptions } from "https://esm.sh/@simplewebauthn/server@9";

const RP_NAME = "CHS — Complete Housing Solutions";
const RP_ID = Deno.env.get("WEBAUTHN_RP_ID") || "chs.ng"; // real production domain, set as an env var

serve(async (req) => {
  const authHeader = req.headers.get("Authorization");
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader! } } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401 });

  const { data: existingCreds } = await supabase
    .from("webauthn_credentials")
    .select("credential_id")
    .eq("user_id", user.id);

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userID: new TextEncoder().encode(user.id),
    userName: user.email || user.id,
    attestationType: "none",
    excludeCredentials: (existingCreds || []).map((c) => ({ id: c.credential_id, type: "public-key" })),
    authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
  });

  // A real, temporary challenge store — genuinely required so the
  // verify step can confirm this exact challenge was actually issued,
  // not guessed or replayed.
  await supabase.from("webauthn_challenges").upsert({ user_id: user.id, challenge: options.challenge });

  return new Response(JSON.stringify(options), { headers: { "Content-Type": "application/json" } });
});
