ALTER TABLE public.prospects
ADD COLUMN IF NOT EXISTS personas jsonb DEFAULT '[]'::jsonb;

UPDATE public.prospects
SET personas = jsonb_build_array(
  jsonb_strip_nulls(
    jsonb_build_object(
      'id', gen_random_uuid()::text,
      'name', contact_name,
      'role', role,
      'linkedin_url', linkedin_url,
      'email', contact_email,
      'phone', contact_phone
    )
  )
)
WHERE (personas IS NULL OR personas = '[]'::jsonb)
  AND contact_name IS NOT NULL
  AND btrim(contact_name) <> '';

ALTER TABLE public.prospects
ALTER COLUMN personas SET DEFAULT '[]'::jsonb;
