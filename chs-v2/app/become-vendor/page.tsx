"use client";

import VendorRegistrationForm from "@/components/VendorRegistrationForm";

// A VENDOR sells goods. (Security, cleaning, fumigation and facilities maintenance are SERVICE PROVIDERS — see
// /become-service-provider — and artisans have their own registration.)
export default function BecomeVendorPage() {
  return <VendorRegistrationForm kind="vendor" />;
}
