-- The application does not use Supabase GraphQL. Keep the GraphQL schemas private
-- so anon/authenticated users cannot inspect exposed objects through GraphQL.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'graphql') THEN
    REVOKE USAGE ON SCHEMA graphql FROM anon, authenticated;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'graphql_public') THEN
    REVOKE USAGE ON SCHEMA graphql_public FROM anon, authenticated;
  END IF;
END $$;
