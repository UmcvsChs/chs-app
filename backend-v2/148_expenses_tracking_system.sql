-- Real, new feature per direct client request: agents/managers (and
-- CHS itself) lose track of real expenses — salaries, rent, running
-- costs, transport, logistics — because paper records get lost. One
-- shared, real system covering both audiences: each real user tracks
-- their own expenses and income, scoped to themselves, with CHS
-- admin able to see the platform-wide picture across everyone.

create table expense_entries (
  id uuid primary key default uuid_generate_v4(),
  recorded_by uuid not null references profiles(id),
  direction text not null check (direction in ('income', 'expense')),
  category text not null check (category in ('salary', 'rent', 'utilities', 'transport', 'logistics', 'maintenance', 'marketing', 'commission_income', 'other')),
  description text not null,
  amount numeric not null check (amount > 0),
  entry_date date not null default current_date,
  created_at timestamptz default now()
);

alter table expense_entries enable row level security;
create policy "expense_entries_own" on expense_entries for all using (auth.uid() = recorded_by);
create policy "expense_entries_admin" on expense_entries for all using (staff_can_access('owner_buyer_tenant'));

create or replace function add_expense_entry(p_direction text, p_category text, p_description text, p_amount numeric, p_entry_date date default current_date)
returns uuid
language plpgsql
security definer
as $$
declare
  v_new_id uuid;
begin
  insert into expense_entries (recorded_by, direction, category, description, amount, entry_date)
  values (auth.uid(), p_direction, p_category, p_description, p_amount, p_entry_date)
  returning id into v_new_id;
  return v_new_id;
end;
$$;

create or replace function get_my_expense_summary(p_start_date date, p_end_date date)
returns json
language plpgsql
security definer
as $$
declare
  v_result json;
begin
  select json_build_object(
    'total_income', (select coalesce(sum(amount), 0) from expense_entries where recorded_by = auth.uid() and direction = 'income' and entry_date between p_start_date and p_end_date),
    'total_expense', (select coalesce(sum(amount), 0) from expense_entries where recorded_by = auth.uid() and direction = 'expense' and entry_date between p_start_date and p_end_date),
    'by_category', (
      select coalesce(json_agg(row_to_json(t)), '[]'::json) from (
        select category, direction, sum(amount) as total from expense_entries
        where recorded_by = auth.uid() and entry_date between p_start_date and p_end_date
        group by category, direction order by total desc
      ) t
    )
  ) into v_result;
  return v_result;
end;
$$;
