-- Earlier application code sent JSON.stringify(...) through the Postgres.js
-- JSON encoder, which stored JSONB scalar strings instead of objects/arrays.
update public.studio_projects
set
  document = case
    when jsonb_typeof(document) = 'string'
      then (document #>> '{}')::jsonb
    else document
  end,
  messages = case
    when jsonb_typeof(messages) = 'string'
      then (messages #>> '{}')::jsonb
    else messages
  end
where
  jsonb_typeof(document) = 'string'
  or jsonb_typeof(messages) = 'string';
