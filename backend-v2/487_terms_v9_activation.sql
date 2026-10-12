-- 487: ACTIVATE TERMS VERSION 9. NOT APPLIED YET. Run this together with the code change that raises
-- CURRENT_TERMS_VERSION to 9 in chs-v2/lib/termsVersion.ts. Every user will be asked to read and accept version 9 once.
update public.platform_settings set value = '9' where key = 'terms_current_version';
