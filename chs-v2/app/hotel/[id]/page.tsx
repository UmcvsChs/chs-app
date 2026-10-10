import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { formatNaira } from "@/lib/format";
import ShareButton from "@/components/ShareButton";

// Public, shareable page for one verified hotel or lodge: photos, room types with prices, facilities and
// (if the hotel has one) its menu. Booking itself still happens on the normal listing page.
export const dynamic = "force-dynamic";

interface HotelPage {
  id: string; title: string; area: string | null; state: string | null; description: string | null;
  photos: string[] | null; facilities: string[] | null; price_per_night: number | null; total_rooms: number | null;
  rooms: { name: string; description: string | null; max_guests: number | null; price_per_night: number }[];
  menu: { category: string; name: string; description: string | null; price: number }[];
}

async function getHotel(id: string): Promise<HotelPage | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_hotel_page", { p_property_id: id });
  if (error || !data) return null;
  return data as HotelPage;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const h = await getHotel(id);
  if (!h) return { title: "Hotel not found | CHS", robots: { index: false } };
  const place = [h.area, h.state].filter(Boolean).join(", ");
  const title = `${h.title}${place ? ` in ${place}` : ""} | CHS`;
  const description = h.description?.slice(0, 155) || `Rooms and prices at ${h.title}, verified on CHS.`;
  const images = h.photos && h.photos.length > 0 ? [h.photos[0]] : [];
  return { title, description, openGraph: { title, description, images, type: "website" }, twitter: { card: "summary_large_image", title, description, images } };
}

export default async function HotelPublicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const h = await getHotel(id);
  if (!h) notFound();
  const photos = h.photos ?? [];
  const place = [h.area, h.state].filter(Boolean).join(", ");
  const cats = Array.from(new Set(h.menu.map((m) => m.category)));

  return (
    <main className="max-w-2xl mx-auto pb-24">
      {photos[0] && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photos[0]} alt={h.title} className="w-full h-56 sm:h-72 object-cover" />
      )}
      <div className="px-4 pt-4">
        <h1 className="font-serif text-2xl font-bold text-chs-charcoal">{h.title}</h1>
        {place && <p className="text-sm text-gray-500">{place}</p>}
        <p className="text-xs text-green-700 mt-1">✔ Verified by CHS</p>
        {h.description && <p className="text-sm text-gray-700 mt-3">{h.description}</p>}

        {photos.length > 1 && (
          <div className="flex gap-2 overflow-x-auto mt-4">
            {photos.slice(1, 9).map((p, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={p} alt="" className="h-24 w-36 object-cover rounded-lg shrink-0" />
            ))}
          </div>
        )}

        <h2 className="font-serif text-lg font-bold text-chs-charcoal mt-6 mb-2">Rooms</h2>
        {h.rooms.length === 0 && h.price_per_night ? <p className="text-sm">From {formatNaira(h.price_per_night)} per night</p> : (
          <div className="space-y-2">
            {h.rooms.map((r, i) => (
              <div key={i} className="border border-gray-200 rounded-xl p-3 flex justify-between gap-3">
                <div>
                  <p className="font-semibold text-sm">{r.name}</p>
                  {r.description && <p className="text-xs text-gray-600">{r.description}</p>}
                  {r.max_guests && <p className="text-xs text-gray-500">Up to {r.max_guests} guests</p>}
                </div>
                <p className="text-sm font-semibold whitespace-nowrap">{formatNaira(r.price_per_night)}<span className="block text-[11px] font-normal text-gray-500">per night</span></p>
              </div>
            ))}
          </div>
        )}

        {h.facilities && h.facilities.length > 0 && (
          <>
            <h2 className="font-serif text-lg font-bold text-chs-charcoal mt-6 mb-2">Facilities</h2>
            <div className="flex flex-wrap gap-1.5">{h.facilities.map((f, i) => <span key={i} className="text-xs border border-gray-300 rounded-full px-2.5 py-1">{f}</span>)}</div>
          </>
        )}

        {cats.length > 0 && (
          <>
            <h2 className="font-serif text-lg font-bold text-chs-charcoal mt-6 mb-2">Restaurant &amp; bar menu</h2>
            {cats.map((c) => (
              <div key={c} className="mb-3">
                <p className="text-xs font-semibold text-gray-500 mb-1">{c}</p>
                {h.menu.filter((m) => m.category === c).map((m, i) => (
                  <div key={i} className="flex justify-between gap-3 text-sm py-1 border-b border-gray-100">
                    <span>{m.name}{m.description && <span className="block text-xs text-gray-500">{m.description}</span>}</span>
                    <span className="whitespace-nowrap">{formatNaira(m.price)}</span>
                  </div>
                ))}
              </div>
            ))}
            <p className="text-[11px] text-gray-500">Menu items are paid to the hotel directly. Guests who have checked in can order to their room from My Bookings.</p>
          </>
        )}
      </div>
      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 p-3 flex gap-2 max-w-2xl mx-auto">
        <Link href={`/property/${h.id}`} className="flex-1 text-center py-2.5 rounded-full bg-chs-charcoal text-white text-sm font-semibold">Check dates &amp; book</Link>
        <ShareButton title={h.title} />
      </div>
    </main>
  );
}
