// CHS Edge Function: verify-identity-document
//
// Phase 1 of the AVS (Automated Verification System) discussed
// directly with the client: an automated first-pass check on an ID
// verification submission, reading the actual uploaded document image
// with Claude's real vision capability and comparing what is printed
// on it against what the applicant typed on the form (full name, ID
// number). This is a text-matching check only -- it does not, and
// cannot, confirm the ID itself is genuine, that it belongs to the
// person who submitted it, or that a submitted face matches the
// person on the document. That is a fundamentally different,
// biometric/government-database problem, deliberately scoped out of
// this phase and discussed directly with the client as Phase 2,
// requiring a licensed third-party provider (Dojah / VerifyMe /
// Youverify) and a separate real cost decision.
//
// Admin-only. Requires ANTHROPIC_API_KEY to be set as a real Supabase
// secret -- this function cannot run without it, and fails with a
// clear, honest error rather than silently pretending to work.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MODEL = 'claude-sonnet-5'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// Real, deliberately forgiving normalization -- the same real
// philosophy as the platform's own chs_enforce_formats trigger:
// strip whitespace/punctuation noise before comparing, so a genuinely
// matching value formatted slightly differently (extra space, a
// hyphen) is not wrongly flagged as a mismatch.
function normalizeName(s: string | null | undefined): string {
  return (s || '').toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim()
}
function normalizeIdNumber(s: string | null | undefined): string {
  return (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

// A real, deliberately forgiving name match: every real word in the
// shorter name must appear in the longer one. This tolerates a
// missing middle name (very common between a registered name and a
// printed ID) without tolerating a genuinely different name.
function namesLikelyMatch(a: string, b: string): boolean {
  if (!a || !b) return false
  const wordsA = a.split(' ').filter(Boolean)
  const wordsB = b.split(' ').filter(Boolean)
  const [shorter, longer] = wordsA.length <= wordsB.length ? [wordsA, wordsB] : [wordsB, wordsA]
  if (shorter.length === 0) return false
  return shorter.every((w) => longer.includes(w))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse({ error: 'You must be signed in.' }, 401)
    }

    // Real caller check, using the caller's own session -- not a
    // blanket service-role bypass. Only real CHS registration staff
    // (or a super admin) may trigger this.
    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: userData, error: userError } = await callerClient.auth.getUser()
    if (userError || !userData?.user) {
      return jsonResponse({ error: 'Your sign-in could not be verified.' }, 401)
    }
    const { data: canAccess, error: accessError } = await callerClient.rpc('staff_can_access', { p_domain: 'registration_setup' })
    if (accessError || !canAccess) {
      return jsonResponse({ error: 'Not authorised: ID verification is reviewed by CHS registration staff only.' }, 403)
    }

    const { verificationId } = await req.json()
    if (!verificationId) {
      return jsonResponse({ error: 'A real verification ID is required.' }, 400)
    }

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicKey) {
      // Real, honest failure -- never pretend a check ran when the
      // one real ingredient it depends on was never configured.
      return jsonResponse({ error: 'Automated verification is not yet configured — an ANTHROPIC_API_KEY secret has not been set for this project. Contact your developer to add one before this button will work.' }, 500)
    }

    // Service-role client for the real, privileged parts: reading the
    // private document and writing the result back.
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: sub, error: subError } = await adminClient
      .from('buyer_id_verifications')
      .select('id, id_document_url, full_name_on_id, id_number, id_type')
      .eq('id', verificationId)
      .single()

    if (subError || !sub) {
      return jsonResponse({ error: 'This verification submission could not be found.' }, 404)
    }
    if (!sub.id_document_url) {
      return jsonResponse({ error: 'This submission has no real document image to check.' }, 400)
    }

    // Extract the real storage path from the stored URL (the same
    // real pattern lib/storage.ts already uses on the frontend) and
    // download the actual file directly, bypassing the fragility of
    // any previously-generated signed URL.
    const pathMatch = sub.id_document_url.match(/private-documents\/(.+?)(?:\?|$)/)
    if (!pathMatch) {
      return jsonResponse({ error: 'Could not locate the real document file for this submission.' }, 400)
    }
    const filePath = decodeURIComponent(pathMatch[1])

    const { data: fileBlob, error: downloadError } = await adminClient.storage
      .from('private-documents')
      .download(filePath)
    if (downloadError || !fileBlob) {
      await adminClient.rpc('record_avs_result', {
        p_verification_id: verificationId, p_status: 'error', p_extracted_name: null, p_extracted_id_number: null,
        p_name_match: null, p_id_number_match: null, p_notes: 'Could not download the real document file to check it.',
      })
      return jsonResponse({ error: 'Could not download the real document file to check it.' }, 500)
    }

    const isPdf = filePath.toLowerCase().endsWith('.pdf')
    if (isPdf) {
      // A PDF cannot be read as an image by the vision call directly.
      // Rather than fail silently, this is recorded as a real,
      // honest outcome an admin can see, not a false negative.
      await adminClient.rpc('record_avs_result', {
        p_verification_id: verificationId, p_status: 'error', p_extracted_name: null, p_extracted_id_number: null,
        p_name_match: null, p_id_number_match: null, p_notes: 'This submission is a PDF, not an image — automated reading is not yet supported for PDFs. Please review it manually.',
      })
      return jsonResponse({ status: 'error', notes: 'This submission is a PDF, not an image — automated reading is not yet supported for PDFs. Please review it manually.' })
    }

    const arrayBuffer = await fileBlob.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
    const base64 = btoa(binary)
    const mediaType = filePath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'

    const prompt = `You are looking at a photo of a real, government-issued identity document from Nigeria. Read only what is genuinely, clearly printed or written on the document itself.

Return ONLY a JSON object, no other text, in exactly this shape:
{"extracted_full_name": string or null, "extracted_id_number": string or null, "document_looks_genuine": boolean, "notes": string}

- extracted_full_name: the person's full name exactly as printed on the document. null if you genuinely cannot read it (blurry, obscured, wrong document type).
- extracted_id_number: the ID/NIN/document number exactly as printed. null if you genuinely cannot read it.
- document_looks_genuine: false ONLY if there is something visibly, obviously wrong (e.g. it is clearly not an ID document at all, or is an obvious photo of a screen/photo-of-a-photo with heavy glare making it unreadable). Do not guess at forgery — you cannot detect that from an image alone. Default to true when the document looks like a normal, readable ID photo.
- notes: one short, honest sentence about anything an admin should know (e.g. "image is a little blurry but the name is legible").`

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
            { type: 'text', text: prompt },
          ],
        }],
      }),
    })

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text()
      await adminClient.rpc('record_avs_result', {
        p_verification_id: verificationId, p_status: 'error', p_extracted_name: null, p_extracted_id_number: null,
        p_name_match: null, p_id_number_match: null, p_notes: 'The automated check could not run right now. Please review this manually or try again shortly.',
      })
      console.error('Anthropic API error:', errText)
      return jsonResponse({ error: 'The automated check could not run right now. Please review this manually or try again shortly.' }, 502)
    }

    const anthropicData = await anthropicRes.json()
    const textBlock = (anthropicData.content || []).find((b: { type: string }) => b.type === 'text')
    let parsed: { extracted_full_name: string | null; extracted_id_number: string | null; document_looks_genuine: boolean; notes: string }
    try {
      const raw = (textBlock?.text || '').trim().replace(/^```json\s*|\s*```$/g, '')
      parsed = JSON.parse(raw)
    } catch {
      await adminClient.rpc('record_avs_result', {
        p_verification_id: verificationId, p_status: 'error', p_extracted_name: null, p_extracted_id_number: null,
        p_name_match: null, p_id_number_match: null, p_notes: 'Could not read a clear result from the automated check. Please review this manually.',
      })
      return jsonResponse({ error: 'Could not read a clear result from the automated check. Please review this manually.' }, 500)
    }

    const nameMatch = parsed.extracted_full_name
      ? namesLikelyMatch(normalizeName(parsed.extracted_full_name), normalizeName(sub.full_name_on_id))
      : null
    const idNumberMatch = parsed.extracted_id_number
      ? normalizeIdNumber(parsed.extracted_id_number) === normalizeIdNumber(sub.id_number)
      : null

    const genuinelyClean = parsed.document_looks_genuine && nameMatch === true && idNumberMatch === true
    const anyMismatch = nameMatch === false || idNumberMatch === false || parsed.document_looks_genuine === false
    const status = genuinelyClean ? 'match' : (anyMismatch ? 'mismatch' : 'error')

    await adminClient.rpc('record_avs_result', {
      p_verification_id: verificationId,
      p_status: status,
      p_extracted_name: parsed.extracted_full_name,
      p_extracted_id_number: parsed.extracted_id_number,
      p_name_match: nameMatch,
      p_id_number_match: idNumberMatch,
      p_notes: parsed.notes || null,
    })

    return jsonResponse({
      status,
      extracted_full_name: parsed.extracted_full_name,
      extracted_id_number: parsed.extracted_id_number,
      name_match: nameMatch,
      id_number_match: idNumberMatch,
      document_looks_genuine: parsed.document_looks_genuine,
      notes: parsed.notes,
    })
  } catch (err) {
    console.error('verify-identity-document error:', err)
    return jsonResponse({ error: 'Could not complete the automated check right now. Please try again or review manually.' }, 500)
  }
})
