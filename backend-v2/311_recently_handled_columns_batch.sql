-- Continuing the same real "Recently Handled, archived manually"
-- pattern across the remaining admin review queues, per explicit
-- client instruction to do this across the whole admin page.

alter table rental_applications add column if not exists archived_at timestamptz;
alter table rental_applications add column if not exists admin_last_read_at timestamptz;

alter table properties add column if not exists verification_archived_at timestamptz;
alter table properties add column if not exists verification_admin_last_read_at timestamptz;

alter table marketplace_vendors add column if not exists archived_at timestamptz;
alter table marketplace_vendors add column if not exists admin_last_read_at timestamptz;

alter table artisans add column if not exists archived_at timestamptz;
alter table artisans add column if not exists admin_last_read_at timestamptz;

alter table developer_applications add column if not exists archived_at timestamptz;
alter table developer_applications add column if not exists admin_last_read_at timestamptz;
