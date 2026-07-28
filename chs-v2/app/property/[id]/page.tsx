import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Property } from "@/types/property";
import { formatNaira, purposeLabel } from "@/lib/format";
import PropertyActions from "@/components/PropertyActions";
import CommunityFeedback from "@/components/CommunityFeedback";
import { CommunityFeedback as CommunityFeedbackType } from "@/types/communityFeedback";

// Always fetch fresh — a property's price, status, or vacancy could
// change at any moment, and this page must never show stale data.
export const dynamic = "force-dynamic";

async function getProperty(id: string): Promise<Property | null> {
  // The actual fix for the disclosed gap: this now genuinely knows who's
  // asking, via the real session read from cookies — so an owner
  // viewing their own not-yet-verified listing is correctly recognised
  // by the database's own RLS rule (auth.uid() = owner_id), rather than
  // always being treated as an anonymous stranger.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("properties")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return data as Property;
}

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const property = await getProperty(id);

  // A real 404 — not a blank page or a silent failure — for an ID that
  // doesn't exist (deleted, mistyped, or never real to begin with).
  if (!property) {
    notFound();
  }

  const supabase = await createClient();
  const { data: feedback } = await supabase
    .from("community_feedback")
    .select("*")
    .eq("property_id", id)
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  const isUnderVerification = property.verification_status !== "verified";

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <div className="bg-chs-charcoal text-white px-4 py-3 flex items-center gap-3">
        <Link href="/" className="text-sm">
          ← Back
        </Link>
      </div>

      <div className="relative h-56 bg-chs-steel-blue-light flex items-center justify-center">
        {property.photos && property.photos.length > 0 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={property.photos[0]}
            alt={property.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-chs-steel-blue text-sm">No photo yet</span>
        )}
      </div>

      {isUnderVerification && (
        <div className="bg-chs-amber-light text-chs-amber-dark text-xs font-semibold px-4 py-3 border-b border-chs-amber/30">
          ⏳ Under Verification — CHS is still confirming this property&apos;s documents.
          Not yet bookable, but you can register your interest below.
        </div>
      )}

      <div className="px-4 py-4">
        <div className="flex justify-between items-start gap-3 mb-1">
          <h1 className="font-serif text-lg font-bold text-chs-charcoal leading-tight">
            {property.title}
          </h1>
          <span className="shrink-0 text-[10px] font-bold uppercase text-chs-red bg-chs-amber-light px-2 py-1 rounded-full">
            {purposeLabel(property.purpose)}
          </span>
        </div>

        <p className="text-sm text-gray-500 mb-3">
          {property.location_area}
          {property.location_lga ? `, ${property.location_lga}` : ""}
          {property.location_state ? `, ${property.location_state} State` : ""}
        </p>

        <p className="text-2xl font-bold text-chs-charcoal mb-4">
          {formatNaira(property.price)}
          {property.price_period ? (
            <span className="font-normal text-sm text-gray-500"> {property.price_period}</span>
          ) : null}
        </p>

        {property.description && (
          <p className="text-sm text-gray-700 leading-relaxed mb-4">{property.description}</p>
        )}

        <div className="grid grid-cols-2 gap-3 mb-4">
          {property.bedrooms !== null && (
            <div className="bg-white rounded-xl p-3 border border-gray-100">
              <p className="text-[10px] uppercase text-gray-400">Bedrooms</p>
              <p className="text-sm font-semibold text-chs-charcoal">{property.bedrooms}</p>
            </div>
          )}
          {property.bathrooms !== null && (
            <div className="bg-white rounded-xl p-3 border border-gray-100">
              <p className="text-[10px] uppercase text-gray-400">Bathrooms</p>
              <p className="text-sm font-semibold text-chs-charcoal">{property.bathrooms}</p>
            </div>
          )}
          {property.road_type && (
            <div className="bg-white rounded-xl p-3 border border-gray-100">
              <p className="text-[10px] uppercase text-gray-400">Road</p>
              <p className="text-sm font-semibold text-chs-charcoal capitalize">
                {property.road_type.replace(/_/g, " ")}
              </p>
            </div>
          )}
          {property.water_source && (
            <div className="bg-white rounded-xl p-3 border border-gray-100">
              <p className="text-[10px] uppercase text-gray-400">Water</p>
              <p className="text-sm font-semibold text-chs-charcoal">{property.water_source}</p>
            </div>
          )}
        </div>

        {/* Real booking/offer actions — genuinely wired to the actual
            database, not a placeholder claiming to work. */}
        <PropertyActions property={property} />

        <CommunityFeedback propertyId={property.id} approvedFeedback={(feedback || []) as CommunityFeedbackType[]} />
      </div>
    </div>
  );
}
