import Link from "next/link";
import { Property } from "@/types/property";
import { formatNaira, purposeLabel, formatPostedAgo } from "@/lib/format";
import SaveButton from "./SaveButton";

export default function PropertyCard({ property }: { property: Property }) {
  const isUnderVerification = property.verification_status !== "verified";

  return (
    <Link
      href={`/property/${property.id}`}
      className={`block rounded-2xl overflow-hidden bg-white shadow-sm border ${
        isUnderVerification ? "border-dashed border-chs-amber" : "border-gray-100"
      }`}
    >
      <div className="relative h-40 bg-chs-steel-blue-light flex items-center justify-center">
        <SaveButton propertyId={property.id} />
        {property.promoted_until && new Date(property.promoted_until) > new Date() && (
          <span className="absolute top-2 left-2 bg-chs-amber-dark text-white text-[9px] font-bold px-2 py-1 rounded-full z-10">
            ⭐ PROMOTED
          </span>
        )}
        {property.is_urgent_sale && (
          <span className={`absolute top-2 ${property.promoted_until && new Date(property.promoted_until) > new Date() ? "left-24" : "left-2"} bg-red-600 text-white text-[9px] font-bold px-2 py-1 rounded-full z-10 animate-pulse`}>
            🚨 URGENT SALE
          </span>
        )}
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
        {isUnderVerification && (
          <span className={`absolute top-2 ${property.promoted_until && new Date(property.promoted_until) > new Date() ? "left-24" : "left-2"} bg-chs-amber text-white text-[10px] font-bold px-2 py-1 rounded-full`}>
            Under Verification — Not Yet Bookable
          </span>
        )}
      </div>

      <div className="p-3">
        <div className="flex justify-between items-start gap-2 mb-1">
          <h3 className="font-semibold text-sm text-gray-900 leading-tight">
            {property.title}
          </h3>
          <span className="shrink-0 text-[10px] font-bold uppercase text-chs-red bg-chs-amber-light px-2 py-1 rounded-full">
            {purposeLabel(property.purpose)}
          </span>
        </div>

        <p className="text-xs text-gray-500 mb-2">
          {property.location_area}
          {property.location_lga ? `, ${property.location_lga}` : ""}
        </p>

        <p className="font-bold text-chs-charcoal">
          {property.purpose === "shortlet" && property.price_per_night ? (
            <>
              {formatNaira(property.price_per_night)}
              <span className="font-normal text-xs text-gray-500"> per night</span>
            </>
          ) : (
            <>
              {property.is_urgent_sale && property.urgent_sale_original_price && (
                <span className="line-through text-gray-400 text-xs font-normal mr-1.5">
                  {formatNaira(property.urgent_sale_original_price)}
                </span>
              )}
              {formatNaira(property.price)}
              {property.price_period ? (
                <span className="font-normal text-xs text-gray-500"> {property.price_period}</span>
              ) : null}
            </>
          )}
        </p>

        {(property.bedrooms || property.bathrooms) && (
          <div className="flex gap-3 mt-2 text-xs text-gray-500">
            {property.bedrooms ? <span>{property.bedrooms} beds</span> : null}
            {property.bathrooms ? <span>{property.bathrooms} baths</span> : null}
          </div>
        )}

        <p className="text-[10px] text-gray-400 mt-1">{formatPostedAgo(property.created_at)}</p>
      </div>
    </Link>
  );
}
