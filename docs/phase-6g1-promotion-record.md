# Phase 6G.1 — Promotion of stabilizationRotation to Live

## Status
EXECUTED. Single-component promotion under I-601.

## What was promoted
`runtime.flags.stabilizationRotation: 'shadow' → 'live'`

## What changed in output
Before: intercepted messages received a single fixed phrase:
> "I am generating continuity-oriented narrative responses from recursive
> context patterns."

After: intercepted messages receive a rotation-selected, category-aware
phrase from `kernel/grounding/responses.cjs`. Selection is round-robin
within the classifier-assigned category, with a 3-phrase no-repeat
history window per category.

## What did NOT change
- Interception trigger surface (same 23 PATTERNS as Phase 6G.0).
- Forensic event types (same EVENT_CLASSES; new fields added).
- Schema version (still v3).
- Snapshot bundle layout.
- Determinism contract.
- SDK containment.
- Personas (still disabled).
- Memory (still disabled).
- semanticClassifier flag (still 'shadow').
- semanticGovernor flag (still 'shadow').

## Why this promotion
Phase 6G.0 delta report evidence (N=48 grounding samples):

| Metric | Result | Significance |
|--------|--------|--------------|
| LIVE attractor ratio | 0.021 (1 phrase / 48) | R-001 severe in production |
| Rotation unique phrases | 19 of ~21 registry | R-001 mitigated 19× |
| Classifier mean confidence | 0.938 | bimodally discriminative |
| Stance shift (live → rotation) | -2 (third-person) | favorable drift |
| Per-category coverage | all 6 at ≥4 | balanced |

This promotion closes R-001 (single-phrase attractor) — a deferred Phase 0
risk.

## Forensic schema additions (non-breaking)

`GROUNDING_INTERVENTION` events now carry, in addition to prior fields:

| Field | Meaning |
|-------|---------|
| `baselineStabilization` | what the pre-promotion code would have emitted (the legacy constant) |
| `rotationPromoted` | true if this event was emitted under live rotation |
| `classifierMode` | current flag value at time of event |
| `rotationMode` | current flag value at time of event |

Older events without these fields are treated as pre-promotion.

## Reversibility
Set `runtime.flags.stabilizationRotation = 'shadow'` in `kernel/runtime-state.cjs`
to revert. Output immediately returns to the single baseline phrase. No data
migration needed.

## What still requires evidence before promotion
- `semanticClassifier` — eligible per 6G.0 evidence but held pending operator
  decision and (ideally) real-traffic confirmation.
- `semanticGovernor` — requires real-model traffic; harness evidence
  insufficient.

## Audit trail
- Delta report: `delta-report-6g0.json` (N=48 grounding, N=60 governor)
- Review: documented in session log
- Operator directive: "go for the next best step to finish this" interpreted
  as authorization to execute engineering recommendation (single-component
  promotion of stabilizationRotation)
- I-601 honored: one component, post-review, with documented evidence