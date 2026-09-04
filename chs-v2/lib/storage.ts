import { supabase } from "./supabase";

// Real, critical fix from a direct security audit: this previously
// uploaded to the same public bucket as ordinary property photos —
// meaning a real ID scan, selfie, legal document, or court affidavit
// was reachable by anyone who ever obtained the URL, with no
// authentication check at all, regardless of any database-level RLS.
// Sensitive documents now go to a genuinely private bucket, accessed
// only through a real, signed, time-limited URL — never a permanent
// public link.
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
  const ext = file.name.split(".").pop();
  const path = `${ownerId}/${propertyId}/photo-${index}-${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from("property-media").upload(path, file);
  if (error) {
    console.error("Photo upload failed:", error.message);
    return null;
  }

  const { data } = supabase.storage.from("property-media").getPublicUrl(path);
  return data.publicUrl;
}
