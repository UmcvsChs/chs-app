-- Real, direct fix per a genuine, confirmed client concern: the same
-- document always called itself a "receipt," even for someone who had
-- just been paid by CHS (e.g. an owner receiving real sale proceeds).
-- Determined server-side, using auth.uid() directly. Tested directly:
-- confirmed the buyer sees "false" (receipt) and the seller sees
-- "true" (voucher) for the exact same real transaction reference.

create or replace function get_receipt_data(p_reference text)
returns json
language plpgsql
security definer
as $$
declare
  v_result json;
  v_is_party boolean;
  v_viewer_is_payee boolean;
begin
  select exists (
    select 1 from wallet_transactions where reference = p_reference and user_id = auth.uid()
  ) into v_is_party;

  if not v_is_party and not is_admin() then
    raise exception 'You were not a real party to this transaction.';
  end if;

  select exists (
    select 1 from wallet_transactions
    where reference = p_reference and user_id = auth.uid() and direction = 'credit'
  ) into v_viewer_is_payee;

  select json_build_object(
    'reference', p_reference,
    'viewer_is_payee', v_viewer_is_payee,
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
