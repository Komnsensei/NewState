# Schema Governance

## Status
ARCHITECTURAL CONTRACT.

## Versioning

- `SCHEMA_VERSION` lives in `kernel/schemas/event-schemas.cjs`.
- Every recorded event carries `schemaVersion`.
- Historical events without `schemaVersion` are treated as v1.

## Current version: 3

| Version | Changes |
|---------|---------|
| v1 (Phase 1) | initial schema, no version field on events |
| v2 (Phase 3) | added `channel` derivation; `schemaVersion` stamped on entries |
| v3 (Phase 6G) | added `SHADOW_OBSERVATION` and `SHADOW_BYPASS` event classes; extended `GROUNDING_INTERVENTION` with shadow fields |

## Change protocol

1. Propose schema delta in a docs note.
2. Bump `SCHEMA_VERSION`.
3. Add a migration in `MIGRATIONS` from previous → new version.
4. Add a test in `tests/suites/schema-migration.test.cjs` that:
   - feeds an old-version event,
   - runs `migrate()`,
   - asserts new shape + `migratedFrom` lineage.
5. Verify `npm run verify` passes.

## Anti-patterns
- Renaming required fields without a migration.
- Deleting an EVENT_CLASS without archiving historical logs.
- Silent field reinterpretation (e.g. changing meaning of `pattern`).
- Adding new EVENT_CLASS without also updating `EVENT_CLASSES` set
  in `kernel/forensics.cjs` (would cause silent UNKNOWN downgrade).