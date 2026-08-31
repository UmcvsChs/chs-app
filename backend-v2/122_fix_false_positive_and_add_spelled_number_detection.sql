-- Real, serious false-positive bug found through direct client
-- testing: a genuine Naira amount written in full digits (e.g.
-- "54,000,000") was being flagged as a phone number, since it also
-- has 7+ digits once non-digit characters are stripped. This would
-- have blocked completely legitimate price negotiation.
--
-- Real fix: a genuine currency amount uses comma-thousands
-- separators (54,000,000) — a real phone number never does. Comma-
-- separated numeric groups are now excluded before checking for a
-- real phone-like digit run. Also adds detection for a real evasion
-- attempt the client specifically flagged — spelling digits out as
-- words ("zero eight zero...") to dodge digit-based detection.

create or replace function detect_offplatform_contact(p_text text)
returns text
language plpgsql
as $$
declare
  v_cleaned text;
  v_digits_only text;
  v_number_words text[] := array['zero','one','two','three','four','five','six','seven','eight','nine','oh'];
  v_word_count int := 0;
  v_word text;
  v_lower text;
begin
  if p_text ~* '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}' then
    return 'This message appears to contain an email address.';
  end if;

  v_cleaned := regexp_replace(p_text, '\d{1,3}(,\d{3})+', '', 'g');

  v_digits_only := regexp_replace(v_cleaned, '[^0-9]', '', 'g');
  if length(v_digits_only) >= 7 then
    return 'This message appears to contain a phone number.';
  end if;

  v_lower := lower(p_text);
  for v_word in select unnest(regexp_split_to_array(regexp_replace(v_lower, '[^a-z\s]', ' ', 'g'), '\s+')) loop
    if v_word = any(v_number_words) then
      v_word_count := v_word_count + 1;
      if v_word_count >= 6 then
        return 'This message appears to contain a phone number spelled out in words.';
      end if;
    else
      v_word_count := 0;
    end if;
  end loop;

  return null;
end;
$$;
