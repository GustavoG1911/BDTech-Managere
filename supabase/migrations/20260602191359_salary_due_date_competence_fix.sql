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
