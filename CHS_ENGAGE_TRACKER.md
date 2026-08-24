# CHS — Engage CHS Enhancement Tracker

Created from the client's real feedback after testing the Construction
Roadmap / Engage CHS feature. Backend for items 6, 8, 9, 10 was already
built and tested against live data before this tracker was created —
marked done below with that context preserved, not re-claimed as new
work.

Status key: ☐ not started · ◐ in progress · ☑ done, verified

---

## 1. ☑ Smart currency formatting on budget field
Done — replaced the free-text field with two real `CurrencyInput`
fields (minimum/exact, optional maximum), each formatting with commas
live as you type. A clean budget string is built from these at
submission, preserving support for both an exact figure and a real
range.

## 2. ☑ Client specification fields
Done — a real, genuinely optional "Material & finish preferences"
block (cement brand, block spec, roof, interior, windows/aluminum,
cable brand, other) shown for construction/renovation service types,
with a real "I have specific preferences" vs "Let CHS recommend"
choice, exactly as requested. Stored as clearly-labeled
`Specification: ...` entries so they're distinguishable from the
required scoping answers.

## 3. ☑ Contact phone + email fields in the actual form
Done — both required before final submission, email pre-filled from
the client's real registered account as a sensible default.

## 4. ☑ Backend: contact_phone, contact_email columns
Done — `backend-v2/64_engage_chs_enhancements.sql`, applied and live.

## 5. ☑ Summary-before-submission review screen
Done — the "details" form no longer submits directly; it validates
then moves to a real review screen listing service type, every real
requirement, material preferences, budget, location, description, and
contact info in plain language, with "Go back and edit" or "Yes,
submit this." Nothing reaches the database until confirmed.

## 6. ☑ Backend: real two-way message thread
Done, tested with real data — `engage_chs_messages` table,
`send_engage_chs_message()`, correctly routes notifications to the
client or to the super admin depending on who sent it. This is the
direct fix for "admin asked for more specification, client had
nowhere to reply."

## 7. ☑ Reply thread — actual chat UI
Done — new `EngageChatThread` component, wired into both the owner's
dashboard and the admin's request card. Real messages, real
timestamps, real sender attribution.

## 8. ☑ Backend: per-side unread tracking
Done — `client_last_read_at` / `admin_last_read_at` columns and
`mark_engage_chs_thread_read()`, the foundation for item 9.

## 9. ☑ Dedicated Engage CHS notification badge
Done — two real, separate indicators: a per-conversation unread badge
on the chat toggle button itself, and a real aggregate unread count
shown directly on the "Engage CHS" pill link on the owner dashboard —
genuinely distinct from the general notification bell, exactly as
requested.

## 10. ☑ Voice-to-text for replies
Done — a real mic button in the chat thread, using the same proven
browser speech-recognition pattern from the Concierge feature.

## 11. ☑ Backend: document delivery mechanism
Done, tested with real data — `engage_chs_documents` table,
`upsert_engage_chs_document()` — real document type, real due-by
date, real status (pending → ready → delivered), notifies the client
when something's actually ready.

## 12. ☑ Document delivery — admin upload UI
Done — `EngageDocumentManager` in `EngageDocuments.tsx`, wired into
the admin's request card. Real document type, real due date, real
file upload, marks ready and notifies the client automatically.

## 13. ☑ Document delivery — client view UI
Done — `EngageDocumentsList` in `EngageDocuments.tsx`, wired into the
owner's dashboard. Real status per document, real due dates, real
view link once ready.

## 14. ☑ "What happens next" explanation after submission
Done — this screen already existed for every service type; updated
the Full Construction entry specifically to state the real 3–7
working day turnaround for drawings/BOQ, and to point to where they'll
actually appear (the new document delivery section, items 12–13).

---

**Progress: 14 of 14 done. Every item complete, and this final batch is now also production-build-verified — 0 TypeScript errors, all 34 routes generated correctly.**
