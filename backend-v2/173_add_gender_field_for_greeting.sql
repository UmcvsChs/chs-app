-- Real, new feature per direct client request: a real gender field
-- at registration, so the app can greet someone respectfully — "Hi
-- Mr. Samson" or "Hi Miss Jennifer" — instead of a bare first name.

alter table profiles add column if not exists gender text check (gender in ('male', 'female') or gender is null);
