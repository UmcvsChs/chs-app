import { supabase } from "./supabase";

// Uploads a document to the same real storage bucket already set up and
// tested for the original app — a document goes to
// {userId}/documents/{purpose}-{timestamp}.{ext}, matching the exact
// path structure the bucket's real security rules expect (the first
// folder must match whoever is uploading, so one person can never
// upload into another person's folder).
export async function uploadDocument(
  file: File,
  userId: string,
  purpose: string
): Promise<string | null> {
  const ext = file.name.split(".").pop();
  const path = `${userId}/documents/${purpose}-${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from("property-media").upload(path, file);
  if (error) {
    console.error("Document upload failed:", error.message);
    return null;
  }

  const { data } = supabase.storage.from("property-media").getPublicUrl(path);
  return data.publicUrl;
}
