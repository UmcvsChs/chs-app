// CHS Edge Function: verify-identity-document
//
// Phase 1 of the AVS (Automated Verification System): an automated
// first-pass check reading an uploaded document with Claude's real
// vision/document capability, comparing what is printed on it against
// what was typed on the form (full name, ID number). This is a
// text-matching check only -- it does not, and cannot, confirm the
// document is genuine, that it belongs to the person who submitted
// it, or that a submitted face matches the person on the document.
// That is a fundamentally different, biometric/government-database
// problem, deliberately scoped out of this phase (Phase 2, a licensed
// third-party provider, a separate real cost decision).
//
// Real, direct fix per a direct client question ("why can't PDF be
// verified automatically???"): confirmed directly against Anthropic's
// own current documentation before answering -- Claude's real API
// genuinely does support PDF documents natively, reading both the
// text and the visual layout of every page (including a scanned
// photo saved as a PDF, exactly the real, common case here), via a
// real "document" content block, not the "image" block this function
// used exclusively before. The earlier "PDFs aren't supported yet"
// behaviour was a real, honest limitation of how this function was
// first built, not a real limitation of Claude itself -- corrected
// here, not left as a permanent gap.
//
// Covers two real, separate verification types -- a real buyer's own
// ID (buyer_id_verifications) and a real rental guarantor's ID
// (rental_applications) -- selected by the real "type" field in the
// request body.
//
// Super-admin-only for both types. Requires ANTHROPIC_API_KEY to be
// set as a real Supabase secret -- this function cannot run without
// it, and fails with a clear, honest error rather than silently
// pretending to work.

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

function normalizeName(s: string | null | undefined): string {
  return (s || '').toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim()
}
function normalizeIdNumber(s: string | null | undefined): string {
  return (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function namesLikelyMatch(a: string, b: string): boolean {
  if (!a || !b) return false
  const wordsA = a.split(' ').filter(Boolean)
  const wordsB = b.split(' ').filter(Boolean)
  const [shorter, longer] = wordsA.length <= wordsB.length ? [wordsA, wordsB] : [wordsB, wordsA]
  if (shorter.length === 0) return false
  return shorter.every((w) => longer.includes(w))
}

type CheckType = 'buyer_id' | 'guarantor'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse({ error: 'You must be signed in.' }, 401)
    }

    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: userData, error: userError } = await callerClient.auth.getUser()
    if (userError || !userData?.user) {
      return jsonResponse({ error: 'Your sign-in could not be verified.' }, 401)
    }

    const adminClientForCheck = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    const { data: callerProfile } = await adminClientForCheck
      .from('profiles')
      .select('is_super_admin')
      .eq('id', userData.user.id)
      .single()
    if (!callerProfile?.is_super_admin) {
      return jsonResponse({ error: 'Not authorised: identity documents are reviewed by the super admin only.' }, 403)
    }

    const body = await req.json()
    const checkType: CheckType = body.type === 'guarantor' ? 'guarantor' : 'buyer_id'
    const recordId: string | undefined = checkType === 'guarantor' ? body.applicationId : body.verificationId
    if (!recordId) {
      return jsonResponse({ error: 'A real record ID is required.' }, 400)
    }

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicKey) {
      return jsonResponse({ error: 'Automated verification is not yet configured — an ANTHROPIC_API_KEY secret has not been set for this project. Contact your developer to add one before this button will work.' }, 500)
    }

    const adminClient = adminClientForCheck

    let submittedName: string | null = null
    let submittedIdNumber: string | null = null
    let documentUrl: string | null = null

    if (checkType === 'buyer_id') {
      const { data: sub, error: subError } = await adminClient
        .from('buyer_id_verifications')
        .select('id, id_document_url, full_name_on_id, id_number')
        .eq('id', recordId)
        .single()
      if (subError || !sub) {
        return jsonResponse({ error: 'This verification submission could not be found.' }, 404)
      }
      submittedName = sub.full_name_on_id
      submittedIdNumber = sub.id_number
      documentUrl = sub.id_document_url
    } else {
      const { data: app, error: appError } = await adminClient
        .from('rental_applications')
        .select('id, guarantor_id_document_url, guarantor_signature_full_name, guarantor_id_number')
        .eq('id', recordId)
        .single()
      if (appError || !app) {
        return jsonResponse({ error: 'This rental application could not be found.' }, 404)
      }
      submittedName = app.guarantor_signature_full_name
      submittedIdNumber = app.guarantor_id_number
      documentUrl = app.guarantor_id_document_url
    }

    if (!documentUrl) {
      return jsonResponse({ error: 'This submission has no real document image to check.' }, 400)
    }

    async function recordResult(status: string, extractedName: string | null, extractedIdNumber: string | null, nameMatch: boolean | null, idNumberMatch: boolean | null, notes: string | null) {
      if (checkType === 'buyer_id') {
        await adminClient.rpc('record_avs_result', {
          p_verification_id: recordId, p_status: status, p_extracted_name: extractedName, p_extracted_id_number: extractedIdNumber,
          p_name_match: nameMatch, p_id_number_match: idNumberMatch, p_notes: notes,
        })
      } else {
        await adminClient.rpc('record_guarantor_avs_result', {
          p_application_id: recordId, p_status: status, p_extracted_name: extractedName, p_extracted_id_number: extractedIdNumber,
          p_name_match: nameMatch, p_id_number_match: idNumberMatch, p_notes: notes,
        })
      }
    }

    const pathMatch = documentUrl.match(/private-documents\/(.+?)(?:\?|$)/)
    if (!pathMatch) {
      return jsonResponse({ error: 'Could not locate the real document file for this submission.' }, 400)
    }
    const filePath = decodeURIComponent(pathMatch[1])

    const { data: fileBlob, error: downloadError } = await adminClient.storage
      .from('private-documents')
      .download(filePath)
    if (downloadError || !fileBlob) {
      await recordResult('error', null, null, null, null, 'Could not download the real document file to check it.')
      return jsonResponse({ error: 'Could not download the real document file to check it.' }, 500)
    }

    const isPdf = filePath.toLowerCase().endsWith('.pdf')

    const arrayBuffer = await fileBlob.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
    const base64 = btoa(binary)

    // Real, direct fix: PDFs are now sent as Claude's real "document"
    // content block, which genuinely reads both the text and the
    // visual layout of every page -- including a scanned photo saved
    // as a PDF, the real, common case for a document uploaded from a
    // phone. Only non-PDF files fall back to the "image" block.
    const contentBlock = isPdf
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
      : { type: 'image', source: { type: 'base64', media_type: filePath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg', data: base64 } }

    const prompt = `You are looking at a real, government-issued identity document from Nigeria. Read only what is genuinely, clearly printed or written on the document itself.

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
            contentBlock,
            { type: 'text', text: prompt },
          ],
        }],
      }),
    })

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text()
      await recordResult('error', null, null, null, null, 'The automated check could not run right now. Please review this manually or try again shortly.')
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
      await recordResult('error', null, null, null, null, 'Could not read a clear result from the automated check. Please review this manually.')
      return jsonResponse({ error: 'Could not read a clear result from the automated check. Please review this manually.' }, 500)
    }

    const nameMatch = parsed.extracted_full_name
      ? namesLikelyMatch(normalizeName(parsed.extracted_full_name), normalizeName(submittedName))
      : null
    const idNumberMatch = parsed.extracted_id_number
      ? normalizeIdNumber(parsed.extracted_id_number) === normalizeIdNumber(submittedIdNumber)
      : null

    const genuinelyClean = parsed.document_looks_genuine && nameMatch === true && idNumberMatch === true
    const anyMismatch = nameMatch === false || idNumberMatch === false || parsed.document_looks_genuine === false
    const status = genuinelyClean ? 'match' : (anyMismatch ? 'mismatch' : 'error')

    await recordResult(status, parsed.extracted_full_name, parsed.extracted_id_number, nameMatch, idNumberMatch, parsed.notes || null)

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
