import { CURRENT_TERMS_VERSION } from "@/lib/termsVersion";
import TermsContentV8 from "@/components/TermsContentV8";
import TermsContentV9 from "@/components/TermsContentV9";

// The single place the Terms & Conditions body is chosen. It follows CURRENT_TERMS_VERSION, so the text people read is
// always the text of the version they are asked to accept. Version 9 is written and waiting; it shows from the moment
// CURRENT_TERMS_VERSION is raised to 9 (see lib/termsVersion.ts for the full switch-over steps).
export default function TermsContent() {
  return CURRENT_TERMS_VERSION >= 9 ? <TermsContentV9 /> : <TermsContentV8 />;
}
