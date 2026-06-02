UPDATE public.salary_payments sp
SET
  is_test_data = COALESCE(p.is_test_data, false),
  reference_month = date_trunc('month', sp.reference_month::date)::date
FROM public.profiles p
WHERE p.user_id = sp.user_id
  AND COALESCE(sp.is_test_data, false) IS DISTINCT FROM COALESCE(p.is_test_data, false);

UPDATE public.salary_payments sp
SET reference_month = date_trunc('month', sp.reference_month::date)::date
WHERE sp.reference_month::date <> date_trunc('month', sp.reference_month::date)::date;

UPDATE public.salary_payments sp
SET expected_payment_date = (
  date_trunc('month', sp.reference_month::date)
  + interval '1 month'
  + (
    LEAST(
      COALESCE((
        SELECT pds.salary_due_day
        FROM public.payment_due_settings pds
        WHERE COALESCE(pds.is_test_data, false) = COALESCE(sp.is_test_data, false)
        LIMIT 1
      ), 1),
      EXTRACT(
        day FROM (
          date_trunc('month', sp.reference_month::date)
          + interval '2 months'
          - interval '1 day'
        )
      )::int
    ) - 1
  ) * interval '1 day'
)::date;
