-- Repair JSONB values that were previously inserted as JSON scalar strings.

update public.credit_ledger
set metadata = (metadata #>> '{}')::jsonb
where jsonb_typeof(metadata) = 'string';

update public.ai_generation_requests
set result = (result #>> '{}')::jsonb
where jsonb_typeof(result) = 'string';

update public.billing_events
set payload = (payload #>> '{}')::jsonb
where jsonb_typeof(payload) = 'string';
