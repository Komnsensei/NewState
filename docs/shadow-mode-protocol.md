# Shadow-Mode Protocol (I-601)

## Status
ARCHITECTURAL INVARIANT — locked at Phase 6G commit.

## Rule
A new semantic component MUST run in shadow mode (computed but not
applied to output) until at least one full baseline + shadow comparison
cycle has been reviewed by the operator.

## Why
Phase 6 carries an upstream risk:
> architecture outpacing observability (R-016)

The Rev 1 failure pattern was not haunted outputs. It was changes
applied to the system before the system could measure whether those
changes helped. Shadow mode prevents that recurrence.

## How it works
- Each semantic component reads a runtime flag:
  `'shadow' | 'live' | 'off'`.
- In Phase 6G the kernel **ignores** `'live'` for shadow components
  and emits a `SHADOW_BYPASS` forensic event if the flag is set to live.
- Live behavior in 6G is byte-identical to Phase 5 close.

## Promotion criteria
Promotion of a component from shadow to live requires:
1. A delta report (`GET /audit/delta-report`) has been generated.
2. The report includes ≥ N samples (operator decides N; suggested ≥ 50).
3. Operator reviews:
   - classifier confidence distribution
   - category distribution
   - repeat-phrase attractor ratio
   - live-vs-shadow similarity
   - generated interpretation lines
4. Operator issues an explicit promotion directive in a new phase.
5. Phase 6G is then closed; a Phase 6G.1 promotes one component.

## Forbidden
- Promoting shadow → live without delta report review.
- Bundling promotion of multiple components in one step.
- Auto-promotion based on internal metric thresholds.
- Reading shadow output and branching kernel pipeline on it during 6G.

## Forensic guarantees
- Every shadow computation records `SHADOW_OBSERVATION`.
- Every attempted bypass records `SHADOW_BYPASS`.
- Both events are queryable via `/forensics?type=...`.

## Components currently in shadow mode (Phase 6G)
| Component | Flag | File |
|-----------|------|------|
| Semantic classifier | `semanticClassifier` | `kernel/grounding/classify.cjs` |
| Stabilization rotation | `stabilizationRotation` | `kernel/grounding/responses.cjs` |
| Semantic governor | `semanticGovernor` | `kernel/governor/semantic.cjs` |

All default to `'shadow'`. None affect output during Phase 6G.

## Delta report
The single authoritative gate for promotion decisions.
Endpoint: `GET /audit/delta-report`
Generated on-demand from forensic ledger.
Read-only over ledger; produces interpretation strings but never auto-acts.

## Relationship to other invariants
- Reinforces I-501 (orthogonal integrity systems): shadow components
  occupy a documented overlap zone that resolves on promotion.
- Reinforces I-401 (SDK containment, by analogy): introduces a
  containment membrane around semantic components, not just provider SDKs.
- Locks R-016 mitigation in code structure, not only in policy.