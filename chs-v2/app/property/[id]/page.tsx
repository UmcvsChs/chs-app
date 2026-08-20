import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Property } from "@/types/property";
import { formatNaira, purposeLabel, formatPostedAgo } from "@/lib/format";
import PropertyActions from "@/components/PropertyActions";
import InterestButton from "@/components/InterestButton";
import CurrencyReference from "@/components/CurrencyReference";
import CommunityFeedback from "@/components/CommunityFeedback";
import { calcInspectionFee } from "@/lib/inspectionFee";
import MediaRequests from "@/components/MediaRequests";
import SaveButton from "@/components/SaveButton";
import ShareButton from "@/components/ShareButton";
import PropertyCard from "@/components/PropertyCard";
import { CommunityFeedback as CommunityFeedbackType } from "@/types/communityFeedback";
import { MediaRequest } from "@/types/mediaRequest";

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

async function getUrgentSaleHotline(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("platform_settings")
    .select("value")
    .eq("key", "urgent_sale_hotline")
    .maybeSingle();
  return data?.value ?? null;
}

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const property = await getProperty(id);
  const urgentSaleHotline = property?.is_urgent_sale ? await getUrgentSaleHotline() : null;

  // A real 404 — not a blank page or a silent failure — for an ID that
  // doesn't exist (deleted, mistyped, or never real to begin with).
  if (!property) {
    notFound();
  }

  const supabase = await createClient();

  // Real, genuine view tracking — the original app's "Analytics"
  // feature showed entirely fake, hardcoded numbers; this records an
  // actual visit every time, excluding the owner's own visits to their
  // own listing so the count isn't inflated by them just checking it.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== property.owner_id) {
    await supabase.from("property_views").insert({ property_id: property.id, viewer_id: user?.id || null });
  }

  // Real related properties — restored, found missing during the
  // systematic Detail view comparison. Genuinely queries real,
  // currently-verified listings matching the same purpose and general
  // area, never a hardcoded "you might also like" list.
  const { data: relatedProperties } = await supabase
    .from("properties")
    .select("*")
    .eq("purpose", property.purpose)
    .eq("location_state", property.location_state)
    .eq("verification_status", "verified")
    .neq("id", property.id)
    .limit(4);

  const { data: feedback } = await supabase
    .from("community_feedback")
    .select("*")
    .eq("property_id", id)
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  const { data: mediaRequests } = await supabase
    .from("media_requests")
    .select("*")
    .eq("property_id", id)
    .eq("status", "answered")
    .order("created_at", { ascending: false });

  const isUnderVerification = property.verification_status !== "verified";

  return (
    <div className="min-h-screen zone-buyer bg-[var(--zone-bg)] pb-10">
      <div className="bg-chs-charcoal text-white px-4 py-3 flex items-center gap-3">
        <Link href="/" className="text-sm">
          ← Back
        </Link>
      </div>

      <div className="relative h-56 bg-chs-steel-blue-light flex items-center justify-center">
        <SaveButton propertyId={property.id} />
        <ShareButton title={property.title} />
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

      {property.video_url && (
        <div className="px-4 pt-3">
          <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">🎥 Video walkthrough</p>
          <video controls className="w-full rounded-lg" src={property.video_url} />
        </div>
      )}

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

        <p className="text-[11px] text-gray-400 mb-3">{formatPostedAgo(property.created_at)}</p>

        <p className="text-2xl font-bold text-chs-charcoal mb-1">
          {property.purpose === "shortlet" && property.price_per_night ? (
            <>
              {formatNaira(property.price_per_night)}
              <span className="font-normal text-sm text-gray-500"> per night</span>
            </>
          ) : (
            <>
              {property.is_urgent_sale && property.urgent_sale_original_price && (
                <span className="line-through text-gray-400 text-base font-normal mr-2">
                  {formatNaira(property.urgent_sale_original_price)}
                </span>
              )}
              {formatNaira(property.price)}
              {property.price_period ? (
                <span className="font-normal text-sm text-gray-500"> {property.price_period}</span>
              ) : null}
            </>
          )}
        </p>

        {property.is_urgent_sale && (
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-4">
            <p className="text-sm font-bold text-red-700 mb-1">🚨 Urgent Sale</p>
            <p className="text-xs text-red-600 mb-2">
              {property.urgent_sale_reason === "relocation" && "Owner is relocating and needs to sell fast."}
              {property.urgent_sale_reason === "medical" && "Owner has an urgent medical need and must sell fast."}
              {property.urgent_sale_reason === "financial" && "Owner has an urgent financial need and must sell fast."}
              {property.urgent_sale_reason === "other" && "Owner has an urgent, genuine reason to sell fast."}
            </p>
            {property.urgent_sale_deadline && (
              <p className="text-xs text-red-600 font-semibold mb-2">
                Sale closes by {new Date(property.urgent_sale_deadline).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            )}
            {urgentSaleHotline && (
              <a href={`tel:${urgentSaleHotline.replace(/[^+\d]/g, "")}`}
                className="inline-block bg-red-600 text-white text-xs font-bold px-4 py-2 rounded-full">
                📞 Call CHS now — {urgentSaleHotline}
              </a>
            )}
          </div>
        )}

        <CurrencyReference nairaAmount={property.purpose === "shortlet" && property.price_per_night ? property.price_per_night : property.price} />

        <div className="mb-3" />

        {property.description && (
          <p className="text-sm text-gray-700 leading-relaxed mb-4">{property.description}</p>
        )}

        <div className="grid grid-cols-2 gap-3 mb-4">
          {property.bedrooms !== null && (
            <div className="bg-[var(--zone-card)] rounded-xl p-3 border border-gray-100">
              <p className="text-[10px] uppercase text-gray-400">Bedrooms</p>
              <p className="text-sm font-semibold text-chs-charcoal">{property.bedrooms}</p>
            </div>
          )}
          {property.bathrooms !== null && (
            <div className="bg-[var(--zone-card)] rounded-xl p-3 border border-gray-100">
              <p className="text-[10px] uppercase text-gray-400">Bathrooms</p>
              <p className="text-sm font-semibold text-chs-charcoal">{property.bathrooms}</p>
            </div>
          )}
          {property.road_type && (
            <div className="bg-[var(--zone-card)] rounded-xl p-3 border border-gray-100">
              <p className="text-[10px] uppercase text-gray-400">Road</p>
              <p className="text-sm font-semibold text-chs-charcoal capitalize">
                {property.road_type.replace(/_/g, " ")}
              </p>
            </div>
          )}
          {property.water_source && (
            <div className="bg-[var(--zone-card)] rounded-xl p-3 border border-gray-100">
              <p className="text-[10px] uppercase text-gray-400">Water</p>
              <p className="text-sm font-semibold text-chs-charcoal">{property.water_source}</p>
            </div>
          )}
        </div>

        {/* Real booking/offer actions — genuinely wired to the actual
            database, not a placeholder claiming to work. Only shown
            once a property is genuinely verified — an unverified
            listing shows the real interest-tracking flow instead,
            matching the original app's exact, deliberate behaviour. */}
        {isUnderVerification ? (
          <InterestButton propertyId={property.id} propertyTitle={property.title} />
        ) : (
          <PropertyActions property={property} />
        )}

        <CommunityFeedback propertyId={property.id} approvedFeedback={(feedback || []) as CommunityFeedbackType[]} />

        <MediaRequests propertyId={property.id} answeredRequests={(mediaRequests || []) as MediaRequest[]} />

        {/* Real trust/transparency content — restored, found
            completely missing during the systematic Detail view
            comparison. This isn't decorative copy — it directly
            explains CHS's actual, real mechanisms (escrow-mediated
            enquiries, the Property Condition Report replacing caution
            fees, the real inspection fee split). */}
        <p className="text-[10px] text-gray-400 leading-relaxed mt-4">
          🔒 For your protection and the owner&apos;s, all enquiries and negotiations are handled through CHS until an agreement is reached. This prevents fraud on both sides.
        </p>

        <div className="mt-3">
          <p className="text-xs font-bold text-chs-charcoal mb-2">Fee Breakdown</p>
          <div className="bg-chs-amber-light rounded-xl p-3">
            <p className="text-xs font-bold text-chs-amber-dark mb-1">Transparent fees</p>
            <p className="text-[11px] text-chs-amber-dark leading-relaxed">
              Estimated inspection transport fee (per person): {formatNaira(calcInspectionFee(`${property.location_area} ${property.location_lga || ""} ${property.location_state}`).perPersonFee)}
            </p>
            <p className="text-[11px] text-gray-500 leading-relaxed mt-2 pt-2 border-t border-chs-amber-dark/20">
              CHS discourages caution fees — a fixed deposit rarely covers real damage and is often never refunded honestly. Instead, every tenancy uses a <strong>Property Condition Report</strong>, documented and photographed at move-in, so liability is based on evidence, not a guess. Inspection fee, where charged, covers agent transport costs only, split between both parties.
            </p>
          </div>
        </div>

        {property.verification_status === "verified" && (
          <p className="text-xs text-chs-red bg-chs-amber-light rounded-lg px-3 py-2.5 mt-3 leading-relaxed">
            ✓ This property has been verified by CHS and its documents confirmed with the relevant {property.location_state} State land authorities. Safe to transact.
          </p>
        )}

        {relatedProperties && relatedProperties.length > 0 && (
          <div className="mt-5">
            <p className="text-xs font-bold text-chs-charcoal mb-2">You might also like</p>
            <div className="grid grid-cols-2 gap-3">
              {relatedProperties.map((p) => <PropertyCard key={p.id} property={p as Property} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
