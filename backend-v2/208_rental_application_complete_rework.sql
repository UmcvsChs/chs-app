-- Real, complete rework per direct, serious client testing feedback:
-- the applicant's own full name, employer/business details were never
-- captured, and critically, the owner's review screen never showed
-- ANY of the real applicant data that already existed in the table --
-- occupation, address, income source, ID type/number/verification --
-- only the guarantor's name/phone and the move-in date. An owner was
-- being asked to approve a total stranger with almost no real
-- information to go on.

alter table rental_applications add column if not exists applicant_full_name text;
alter table rental_applications add column if not exists employer_business_name text;
alter table rental_applications add column if not exists employer_business_address text;
