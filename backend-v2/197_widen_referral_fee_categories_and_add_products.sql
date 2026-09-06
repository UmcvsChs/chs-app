alter table referral_fee_settings drop constraint referral_fee_settings_category_check;
alter table referral_fee_settings add constraint referral_fee_settings_category_check
  check (category = ANY (ARRAY[
    'security_services', 'cleaning_services', 'fumigation_pest_control', 'facilities_maintenance',
    'building_materials', 'furniture', 'home_equipment', 'interior_design', 'bedding_textiles', 'kitchen_supplies'
  ]));

insert into referral_fee_settings (category, flat_fee_amount) values
  ('building_materials', 15000),
  ('furniture', 20000),
  ('home_equipment', 18000),
  ('interior_design', 25000),
  ('bedding_textiles', 8000),
  ('kitchen_supplies', 8000)
on conflict (category) do nothing;
