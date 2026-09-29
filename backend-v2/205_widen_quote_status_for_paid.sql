alter table service_quote_requests drop constraint service_quote_requests_status_check;
alter table service_quote_requests add constraint service_quote_requests_status_check
  check (status = ANY (ARRAY['pending', 'responded', 'paid', 'closed']));
