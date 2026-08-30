-- Real cleanup: discovered mid-task that a complete, working
-- pre-commit negotiation moderation system (precommit_messages,
-- send_precommit_message, detect_offplatform_contact,
-- approve/reject_precommit_message — see migration 113) already
-- existed, already correctly wired into the admin dashboard. An
-- offer_messages table and its own functions were built as a genuine,
-- unnecessary duplicate before this was discovered — removed here
-- rather than left as dead, confusing code alongside the real system.

drop table if exists offer_messages cascade;
drop function if exists send_offer_message(uuid, text);
drop function if exists review_offer_message(uuid, boolean, text);
drop function if exists contains_contact_info(text);
