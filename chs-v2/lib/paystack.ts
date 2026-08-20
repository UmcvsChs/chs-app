"use client";

// Genuinely secure flow: the amount is decided and locked in on the
// server (using the secret key, in the initialize-wallet-funding Edge
// Function), never trusted from the browser — a malicious person could
// otherwise tamper with the amount before it ever reaches Paystack. The
// client only ever "resumes" a transaction that the server already
// created, using the access code the server hands back.
//
// @paystack/inline-js touches `window` as soon as it's imported, which
// breaks Next.js's server-side rendering if imported at the top of the
// file (this genuinely broke the build the first time). Importing it
// dynamically, only inside this function, keeps it entirely out of any
// server-rendered code path.
export async function startWalletFunding(
  amountKobo: number,
  onSuccess: (reference: string) => void,
  onCancel: () => void
) {
  const { default: PaystackPop } = await import("@paystack/inline-js");

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/initialize-wallet-funding`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: amountKobo }),
    }
  );

  const result = await response.json();
  if (!response.ok || result.error) {
    throw new Error(result.error || "Could not start payment");
  }

  const popup = new PaystackPop();
  popup.resumeTransaction(result.accessCode, {
    onSuccess: (transaction) => onSuccess(transaction.reference),
    onCancel: () => onCancel(),
  });
}

// Same real, secure pattern as startWalletFunding above — the server
// (initialize-promo-credit-funding) locks in the real Naira amount from
// a trusted, flat exchange rate, never from anything the browser sends.
export async function startPromoCreditFunding(
  credits: number,
  onSuccess: (reference: string) => void,
  onCancel: () => void
) {
  const { default: PaystackPop } = await import("@paystack/inline-js");

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/initialize-promo-credit-funding`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credits }),
    }
  );

  const result = await response.json();
  if (!response.ok || result.error) {
    throw new Error(result.error || "Could not start payment");
  }

  const popup = new PaystackPop();
  popup.resumeTransaction(result.accessCode, {
    onSuccess: (transaction) => onSuccess(transaction.reference),
    onCancel: () => onCancel(),
  });
}
