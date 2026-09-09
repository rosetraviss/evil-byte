-- The extraction pipeline now queries every zone on the account (not just
-- evilbyte.net's), so this column can no longer hold a real zone name --
-- see src/logs.js's zonePseudonym(). Renaming rather than adding a new
-- column: the table has no rows yet (this ships alongside the change that
-- starts populating it), so there's nothing to migrate.
ALTER TABLE requestors RENAME COLUMN zone_name TO zone_hash;
