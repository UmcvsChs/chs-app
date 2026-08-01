// The complete, real, exact service-specific Terms & Conditions —
// extracted programmatically from the original app's own source
// to guarantee exact fidelity on legally significant text, not
// manually retyped and risking a transcription error. Found
// completely missing during the systematic Service T&C comparison.
export interface ServiceTncSection { h: string; body: string; }
export interface ServiceTnc { title: string; fee: string; sections: ServiceTncSection[]; }

export const SERVICE_TNC: Record<string, ServiceTnc> = {
  "Full property management": {
    "title": "Property Management — Terms & Conditions",
    "fee": "10% of gross annual rent collected, billed annually or monthly at your preference. Minimum charge of ₦150,000/year per property.",
    "sections": [
      {
        "h": "1. Scope of Authority",
        "body": "You grant CHS a written mandate to manage the property named in your request, including sourcing and vetting tenants, collecting rent and service charges, issuing lawful notices, and coordinating routine maintenance. The specific scope is confirmed in a signed Management Agreement before work begins."
      },
      {
        "h": "2. Evaluation and Structuring",
        "body": "CHS is given reasonable authority to inspect the property’s current condition and recommend improvements to its management — including tenant arrangements, maintenance schedules, or record-keeping — where these are found to be poorly structured. Any material change to existing tenant arrangements requires your prior written consent."
      },
      {
        "h": "3. Contractor Selection",
        "body": "Where maintenance or repair work is required, CHS uses its multi-quotation vetting system — a minimum of three independent quotations reviewed by a CHS officer distinct from the officer who solicited them — before any expenditure is approved on your behalf."
      },
      {
        "h": "4. Financial Reporting and Fund Disbursement",
        "body": "Rent and service charges collected are held in the CHS wallet system and disbursed to you monthly, less CHS’s management fee and any maintenance expenditure you have pre-authorised. You receive an itemised statement with every disbursement."
      },
      {
        "h": "5. Remuneration",
        "body": "CHS’s fee is 10% of gross annual rent collected, deducted at each disbursement cycle rather than billed as a lump sum. A minimum annual charge of ₦150,000 per property applies regardless of rent value, to reflect CHS’s fixed administrative cost of management."
      },
      {
        "h": "6. Indemnification and Liability",
        "body": "CHS is not liable for a tenant’s default on rent obligations where CHS has exercised reasonable diligence in tenant vetting, nor for pre-existing property conditions not disclosed to CHS at the start of the mandate, nor for events of force majeure. CHS’s liability in respect of this mandate is limited to direct losses arising from CHS’s own proven negligence."
      },
      {
        "h": "7. Termination",
        "body": "Either party may terminate this mandate with 30 days’ written notice. CHS will hand over all records, tenant information, and any funds held in trust within 14 days of termination taking effect."
      }
    ]
  },
  "Sale negotiation & marketing": {
    "title": "Sale Negotiation & Marketing — Terms & Conditions",
    "fee": "Tiered by property value: 8% up to ₦50M, 6% for ₦50M–₦200M, 5% for ₦200M–₦500M, 4% for ₦500M–₦1B, 3% above ₦1B.",
    "sections": [
      {
        "h": "1. Scope of Authority",
        "body": "You grant CHS the right to market your property, arrange and conduct viewings, and negotiate offers on your behalf within the minimum acceptable price and terms you set in writing. CHS does not have authority to bind you to a sale — final acceptance of any offer remains yours alone."
      },
      {
        "h": "2. Marketing Conduct",
        "body": "CHS will market the property honestly and accurately, using the same standards of full disclosure required of every listing on the Platform. CHS will not misrepresent the property’s condition, title status, or any material fact to a prospective buyer."
      },
      {
        "h": "3. Exclusivity (where granted)",
        "body": "Where you grant CHS an exclusive mandate for a defined period, you agree not to engage another agent or independently conclude a sale of the same property during that period without CHS’s written consent, save where CHS has materially failed to perform its obligations."
      },
      {
        "h": "4. Remuneration",
        "body": "CHS’s fee is calculated on the tiered scale set out above, based on the final agreed sale price. On a ₦1,000,000,000 sale, for example, CHS’s fee is 4% — ₦40,000,000."
      },
      {
        "h": "5. Fund Disbursement",
        "body": "CHS’s fee is earned and payable only upon completion — meaning full payment received and title validly transferred — not upon mere acceptance of an offer. Funds pass through the CHS escrow system, with CHS’s fee deducted at the point of final disbursement to you."
      },
      {
        "h": "6. Indemnification and Liability",
        "body": "CHS is not liable for a buyer’s default after completion, for title defects that were not disclosed to CHS by you at the outset, or for a buyer’s later dissatisfaction with the property’s condition where the property was accurately described at the time of sale."
      },
      {
        "h": "7. Termination",
        "body": "You may withdraw the property from CHS’s marketing mandate at any time with 14 days’ written notice, save that CHS’s fee remains payable in full if a sale later completes with a buyer CHS introduced during the mandate period, within 90 days of that mandate ending."
      }
    ]
  },
  "Construction monitoring": {
    "title": "Construction Monitoring — Terms & Conditions",
    "fee": "3% of total construction budget, minimum ₦2,000,000, paid in tranches tied to construction milestones.",
    "sections": [
      {
        "h": "1. Scope of Authority",
        "body": "CHS’s role is limited strictly to periodic site visits, verification of progress against the approved plan, and written reporting to you. CHS does not act as your building contractor, structural engineer, or guarantor of construction quality unless a separate, distinct agreement expressly says so."
      },
      {
        "h": "2. Reporting",
        "body": "CHS will visit the site and issue a written progress report at the frequency agreed in your Management Agreement (typically bi-weekly), covering visible progress, any deviation from the approved plan, and any visible defect or concern observed."
      },
      {
        "h": "3. Evaluation and Escalation",
        "body": "Where CHS observes work that appears structurally unsound, materially deviates from approved plans, or uses visibly substandard materials, CHS will escalate this to you in writing without delay and may recommend an independent structural assessment, at your cost."
      },
      {
        "h": "4. Remuneration and Fund Disbursement",
        "body": "CHS’s fee of 3% of the total construction budget (minimum ₦2,000,000) is paid to CHS in tranches tied to CHS’s own reporting milestones — for example 20% at mobilisation, 30% at mid-construction, 30% near completion, and 20% at final handover sign-off — and is entirely separate from payments you make directly to your building contractor."
      },
      {
        "h": "5. Indemnification and Liability",
        "body": "CHS’s liability is limited to losses arising from CHS’s own negligent failure to report a defect that was reasonably observable during a scheduled visit using standard visual inspection. CHS is not liable for defects requiring specialised testing beyond standard visual inspection, nor for the contractor’s own workmanship failures, nor for delays or cost overruns caused by the contractor."
      },
      {
        "h": "6. Termination",
        "body": "Either party may terminate this mandate with 14 days’ written notice. CHS retains any tranche already earned for milestones completed and reported before termination."
      }
    ]
  },
  "Full construction / project management": {
    "title": "Full Construction / Project Management — Terms & Conditions",
    "fee": "10% of total construction budget, paid in tranches tied to construction stages.",
    "sections": [
      {
        "h": "1. Scope of Authority",
        "body": "You grant CHS authority to appoint and manage contractors (through CHS’s multi-quotation vetting system), oversee procurement of materials, manage the construction timeline, and control quality throughout the project, in accordance with plans and a budget you have approved in writing."
      },
      {
        "h": "2. Evaluation and Restructuring",
        "body": "CHS is given a free hand to evaluate work in progress and restructure the approach — including replacing an underperforming contractor through CHS’s vetting process — where execution deviates materially from the approved plan, provided you are informed in writing before any material change proceeds."
      },
      {
        "h": "3. Stage-Based Fund Disbursement",
        "body": "Both the construction budget and CHS’s own fee are disbursed by stage, tracking standard building phases: design and architectural work, foundation and structural work, superstructure, roofing, and finishing through to handover. CHS’s 10% fee is drawn proportionally as each stage’s construction spend is disbursed — never as a lump sum in advance of work performed."
      },
      {
        "h": "4. Remuneration",
        "body": "CHS’s fee is 10% of the total approved construction budget. On a ₦450,000,000 project, for example, CHS’s total fee across all stages is ₦45,000,000."
      },
      {
        "h": "5. Reporting and Owner Audit Rights",
        "body": "CHS provides a written report at the completion of each stage, including photographs, expenditure to date, and any variance from budget. You retain the right to commission an independent audit of any stage at your own cost, and CHS will cooperate fully with such an audit."
      },
      {
        "h": "6. Indemnification and Liability",
        "body": "CHS’s liability is limited to losses arising from CHS’s own negligence in contractor selection or oversight. CHS is not liable for force majeure, for a contractor’s fraud or default despite CHS’s reasonable vetting, or for cost increases arising from factors outside CHS’s control (such as material price inflation)."
      },
      {
        "h": "7. Termination",
        "body": "Either party may terminate with 30 days’ written notice. CHS will provide a full accounting of funds received and disbursed within 14 days, and will cooperate in an orderly handover to a successor project manager of your choosing."
      }
    ]
  },
  "Renovation project management": {
    "title": "Renovation Project Management — Terms & Conditions",
    "fee": "Tiered by renovation budget: 15% under ₦20M, 10% for ₦20M–₦100M, 7% above ₦100M. Minimum charge ₦500,000.",
    "sections": [
      {
        "h": "1. Scope of Authority",
        "body": "CHS will evaluate the existing structure, propose a renovation scope aligned with your brief and budget, and manage contractors through CHS’s multi-quotation vetting system to execute that scope, subject to your written approval of the final plan before work begins."
      },
      {
        "h": "2. Concealed Conditions",
        "body": "You acknowledge that renovation work may reveal structural or other issues concealed within existing walls, foundations, or fittings that could not reasonably be discovered without invasive investigation. CHS will inform you promptly of any such discovery and will not proceed with additional remedial work beyond the agreed scope without your written approval of any additional cost."
      },
      {
        "h": "3. Stage-Based Fund Disbursement",
        "body": "CHS’s fee is drawn proportionally across the agreed renovation stages as each stage is completed and verified, never as a lump sum in advance."
      },
      {
        "h": "4. Remuneration",
        "body": "CHS’s fee is tiered by total renovation budget: 15% for budgets under ₦20,000,000, 10% for ₦20,000,000–₦100,000,000, and 7% above ₦100,000,000, subject to a minimum charge of ₦500,000."
      },
      {
        "h": "5. Indemnification and Liability",
        "body": "CHS’s liability is limited to losses arising from CHS’s own negligence in contractor selection or oversight. CHS is not liable for pre-existing structural conditions not reasonably discoverable at the outset, nor for a contractor’s workmanship failures despite CHS’s reasonable vetting and supervision."
      },
      {
        "h": "6. Termination",
        "body": "Either party may terminate with 14 days’ written notice. CHS retains fees earned for stages completed and verified before termination."
      }
    ]
  },
  "Other real estate service": {
    "title": "Bespoke Service — Terms & Conditions",
    "fee": "To be agreed individually based on the scope you describe, and confirmed in writing before any work begins.",
    "sections": [
      {
        "h": "1. Scope of Authority",
        "body": "Because this request falls outside CHS’s standard service categories, CHS will review your description and contact you to define a specific scope of work, timeline, and fee structure before any engagement begins."
      },
      {
        "h": "2. No Automatic Engagement",
        "body": "Submitting this request does not itself create a binding engagement. A distinct written Agency or Management Agreement, specific to the work you have described, will be prepared and must be signed by both parties before CHS begins any work or charges any fee."
      },
      {
        "h": "3. General Principles",
        "body": "Whatever the specific scope agreed, CHS commits to the same standards applied across every other category of service: fund disbursement tied to verified progress rather than paid in advance, full financial transparency and reporting, and liability limited to CHS’s own proven negligence."
      },
      {
        "h": "4. Indemnification and Liability",
        "body": "General indemnification and liability terms will be confirmed in the specific written agreement for your engagement, consistent with the principles applied across CHS’s other service categories."
      }
    ]
  },
};
