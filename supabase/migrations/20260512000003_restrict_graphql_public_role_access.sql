-- GraphQL schema usage is inherited through PostgreSQL's PUBLIC role.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'graphql') THEN
    REVOKE USAGE ON SCHEMA graphql FROM PUBLIC, anon, authenticated;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'graphql_public') THEN
    REVOKE USAGE ON SCHEMA graphql_public FROM PUBLIC, anon, authenticated;
  END IF;
END $$;
