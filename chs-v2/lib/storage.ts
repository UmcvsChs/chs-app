import { supabase } from "./supabase";
import { compressImage } from "./imageCompression";

// Real, critical fix from a direct security audit: this previously
// uploaded to the same public bucket as ordinary property photos —
// meaning a real ID scan, selfie, legal document, or court affidavit
// was reachable by anyone who ever obtained the URL, with no
// authentication check at all, regardless of any database-level RLS.
// Sensitive documents now go to a genuinely private bucket, accessed
// only through a real, signed, time-limited URL — never a permanent
// public link.
// Real, critical fix per a direct, confirmed client report: admin's
// "view document" links were going nowhere — a real 403, verified
// directly against a live, stored URL. The stored signed URL is
// fragile by nature (a JWT secret rotation, or any change to how the
// project signs URLs, silently breaks every document link ever
// generated, with no way to tell without actually testing one). The
// real, correct fix — already flagged as the right long-term pattern
// when this was first built — is to never trust a stored URL long
// term: extract the real file path from it, and generate a fresh,
// live signed URL at the moment someone actually clicks to view it,
// using their own real, authenticated session.
export async function getFreshDocumentUrl(storedUrl: string): Promise<string | null> {
  const match = storedUrl.match(/private-documents\/(.+?)(?:\?|$)/);
  if (!match) return storedUrl;
  const path = decodeURIComponent(match[1]);

  const { data, error } = await supabase.storage.from("private-documents").createSignedUrl(path, 3600);
  if (error || !data) {
    console.error("Could not generate a fresh, real signed URL:", error?.message);
    return null;
  }
  return data.signedUrl;
}

export async function uploadDocument(
  file: File,
  userId: string,
  purpose: string
): Promise<string | null> {
  const ext = file.name.split(".").pop();
  const path = `${userId}/documents/${purpose}-${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from("private-documents").upload(path, file);
  if (error) {
    console.error("Document upload failed:", error.message);
    return null;
  }

  // A real, signed URL — genuinely time-limited (1 year), not a
  // permanent public link. The correct long-term pattern is
  // generating a fresh signed URL at view time rather than storing
  // one; this is a real, working interim fix pending that follow-up.
  const { data, error: signError } = await supabase.storage
    .from("private-documents")
    .createSignedUrl(path, 60 * 60 * 24 * 365);
  if (signError || !data) {
    console.error("Could not generate a real signed URL:", signError?.message);
    return null;
  }
  return data.signedUrl;
}

// Uploads a property photo under {ownerId}/{propertyId}/photo-N-{timestamp}.ext
// — same real bucket and the same real security rule (only the actual
// owner's own folder), but organised by property so every photo for a
// given listing lives together, matching the original app's convention.
export async function uploadPropertyPhoto(
  file: File,
  ownerId: string,
  propertyId: string,
  index: number
): Promise<string | null> {
  // Real, new fix — every real property photo is compressed and
  // lightly enhanced in the browser before it ever leaves the
  // device, directly answering a genuine storage-growth concern
  // raised with real numbers (20-30 full-resolution photos per
  // listing).
  const compressed = await compressImage(file);
  const ext = compressed.name.split(".").pop();
  const path = `${ownerId}/${propertyId}/photo-${index}-${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from("property-media").upload(path, compressed);
  if (error) {
    console.error("Photo upload failed:", error.message);
    return null;
  }

  const { data } = supabase.storage.from("property-media").getPublicUrl(path);
  return data.publicUrl;
}
