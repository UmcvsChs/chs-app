import { Property } from "@/types/property";

// Formats a naira amount the same way the original app does throughout
// — with proper comma separators, since a real, tested currency-format
// bug was found and fixed in the original app's offer field for exactly
// this kind of value. Getting this right from the start here.
function formatNaira(amount: number): string {
  return "₦" + amount.toLocaleString("en-NG");
}

function purposeLabel(purpose: Property["purpose"]): string {
  const labels: Record<Property["purpose"], string> = {
    rent: "For Rent",
    sale: "For Sale",
    lease: "For Lease",
    hire: "For Hire",
  };
  return labels[purpose];
}

export default function PropertyCard({ property }: { property: Property }) {
  const isUnderVerification = property.verification_status !== "verified";

  return (
    <div
      className={`rounded-2xl overflow-hidden bg-white shadow-sm border ${
        isUnderVerification ? "border-dashed border-chs-amber" : "border-gray-100"
      }`}
    >
      <div className="relative h-40 bg-chs-steel-blue-light flex items-center justify-center">
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
          <span className="absolute top-2 left-2 bg-chs-amber text-white text-[10px] font-bold px-2 py-1 rounded-full">
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
          {formatNaira(property.price)}
          {property.price_period ? (
            <span className="font-normal text-xs text-gray-500"> {property.price_period}</span>
          ) : null}
        </p>

        {(property.bedrooms || property.bathrooms) && (
          <div className="flex gap-3 mt-2 text-xs text-gray-500">
            {property.bedrooms ? <span>{property.bedrooms} beds</span> : null}
            {property.bathrooms ? <span>{property.bathrooms} baths</span> : null}
          </div>
        )}
      </div>
    </div>
  );
}
