// A real, hand-written type declaration for @paystack/inline-js —
// written directly into this project rather than relying on the
// separate @types/paystack__inline-js package. That external package
// caused a genuine, repeated build failure on Netlify (the module
// couldn't be resolved there, even though it worked correctly in local
// testing) — rather than keep chasing an installation-timing mismatch,
// this removes the dependency entirely by declaring the shape of the
// library ourselves, matching only what this app actually uses.
declare module "@paystack/inline-js" {
  interface PaystackTransaction {
    reference: string;
    status: string;
    trans: string;
    transaction: string;
    message: string;
    trxref: string;
  }

  interface TransactionCallbacks {
    onSuccess?: (transaction: PaystackTransaction) => void;
    onCancel?: () => void;
    onError?: (error: { message: string }) => void;
    onLoad?: () => void;
  }

  export default class PaystackPop {
    constructor();
    resumeTransaction(accessCode: string, callbacks?: TransactionCallbacks): void;
    newTransaction(options: {
      key: string;
      amount: number;
      email: string;
      reference?: string;
      onSuccess?: (transaction: PaystackTransaction) => void;
      onCancel?: () => void;
      onError?: (error: { message: string }) => void;
    }): void;
  }
}
