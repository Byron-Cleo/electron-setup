-- Multi-role users: keep `role` as the DEFAULT role (landing journey) and add
-- `roles` holding every role the user has. `role` is always a member of `roles`.
ALTER TABLE "User" ADD COLUMN "roles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- One-time backfill: every existing user becomes a single-role user with that
-- role as the default. Also included in the deploy steps for each environment.
UPDATE "User" SET "roles" = ARRAY["role"] WHERE cardinality("roles") = 0;
