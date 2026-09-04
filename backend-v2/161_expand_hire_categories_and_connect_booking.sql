-- Real, comprehensive fix per direct client request: Hotel, Event
-- Centre, Hall, and every genuine venue-style category in that line
-- was falling through to the tenant-style rental application flow
-- instead of a real, instant guest booking — even though the backend
-- already had real, working commission logic for exactly this
-- (hire_category), the listing form never actually let an owner set
-- it, so every real hire listing had it sitting null. Also found:
-- not every "hire" listing is a guest venue — a filling station
-- leased short-term is a genuine business lease, not a guest booking,
-- and correctly stays on the rental-application path. Expanded the
-- real category list to cover cinema/entertainment and recreational/
-- sports venues too, which genuinely belong in the same guest-booking
-- treatment as an event centre.

alter table properties drop constraint if exists properties_hire_category_check;
alter table properties add constraint properties_hire_category_check
  check (hire_category = ANY (ARRAY['shortlet', 'event_centre', 'hotel_lodge', 'car_park_casual', 'cinema_entertainment', 'recreational_sports']));

update properties set hire_category = 'event_centre' where purpose = 'hire' and property_type = 'Event Centre / Hall' and hire_category is null;
update properties set hire_category = 'car_park_casual' where purpose = 'hire' and property_type = 'Car Park (parking facility)' and hire_category is null;
update properties set hire_category = 'cinema_entertainment' where purpose = 'hire' and property_type = 'Cinema / Entertainment Centre' and hire_category is null;
update properties set hire_category = 'recreational_sports' where purpose = 'hire' and property_type in ('Recreational Centre / Club House', 'Sports Facility') and hire_category is null;
update properties set hire_category = 'hotel_lodge' where purpose = 'hire' and property_type in ('Hotel', 'Guest House / Lodge', 'Resort') and hire_category is null;
