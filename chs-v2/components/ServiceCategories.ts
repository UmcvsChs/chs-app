// Shared list of in-house service types a hotel or lodge can offer. The words are plain on purpose:
// hotels differ a lot, so the owner chooses what applies and describes it in their own words.
export const SERVICE_CATEGORIES: { key: string; label: string; icon: string }[] = [
  { key: "restaurant", label: "Restaurant / kitchen", icon: "🍽️" },
  { key: "bar", label: "Bar / drinks", icon: "🍸" },
  { key: "room_service", label: "Room service", icon: "🛎️" },
  { key: "room_cleaning", label: "Room cleaning", icon: "🧹" },
  { key: "laundry", label: "Laundry / ironing", icon: "🧺" },
  { key: "swimming_pool", label: "Swimming pool", icon: "🏊" },
  { key: "gym_spa", label: "Gym / spa", icon: "💆" },
  { key: "airport_pickup", label: "Airport pickup", icon: "🚗" },
  { key: "transport", label: "Car / transport", icon: "🚕" },
  { key: "conference", label: "Conference / meeting room", icon: "💼" },
  { key: "events", label: "Event hall", icon: "🎉" },
  { key: "extra_bed", label: "Extra bed / cot", icon: "🛏️" },
  { key: "child_care", label: "Child care", icon: "🧒" },
  { key: "security", label: "Security", icon: "🛡️" },
  { key: "other", label: "Other", icon: "✨" },
];
export const catInfo = (k: string) => SERVICE_CATEGORIES.find((c) => c.key === k) ?? SERVICE_CATEGORIES[SERVICE_CATEGORIES.length - 1];
export const PAY_NOTICE = "Booking a service only reserves it. You pay the hotel directly, at the hotel, for anything you use. CHS does not take or hold payment for these services. Prices are the hotel's own guide and can change.";
