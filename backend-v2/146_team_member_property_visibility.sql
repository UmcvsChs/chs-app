-- Real, new extension — a genuine team member can now see everything
-- about the properties their parent agent/manager actually manages,
-- not just what's publicly visible, matching the real point of a
-- mini admin dashboard.
create policy "properties_team_member_view" on properties for select using (
  is_team_member_of(managing_agent_id)
);
