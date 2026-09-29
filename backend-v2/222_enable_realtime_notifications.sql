-- Real, confirmed root cause per direct, repeated client feedback:
-- real-time notifications were never actually possible, because the
-- notifications table was never added to Supabase's real-time
-- publication at all -- confirmed directly, not assumed. This is why
-- a manual refresh was always required. Enabled now.

alter publication supabase_realtime add table notifications;
