-- Real, new feature per direct client request: neither CHS nor its
-- agents/managers could issue a real receipt to a client for any
-- transaction — confirmed, genuinely missing. Built on the real,
-- existing reference numbers already generated for every transaction
-- type (RENT-, REMIT-, COMM-, AGENTSALE-, etc.) — a single, unified
-- function assembles a clean, real receipt from any of them, viewable
-- by anyone who was genuinely a party to that specific transaction.

create or replace function get_receipt_data(p_reference text)
returns json
language plpgsql
security definer
as $$
declare
  v_result json;
  v_is_party boolean;
begin
  select exists (
    select 1 from wallet_transactions where reference = p_reference and user_id = auth.uid()
  ) into v_is_party;

  if not v_is_party and not is_admin() then
    raise exception 'You were not a real party to this transaction.';
  end if;

  select json_build_object(
    'reference', p_reference,
    'entries', (
      select coalesce(json_agg(row_to_json(t)), '[]'::json) from (
        select wt.direction, wt.amount, wt.description, wt.created_at, p.full_name, p.phone
        from wallet_transactions wt
        join profiles p on p.id = wt.user_id
        where wt.reference = p_reference
        order by wt.direction desc
      ) t
    )
  ) into v_result;

  return v_result;
end;
$$;
