# Evidence vs Experiment

## Status
ARCHITECTURAL CONTRACT.

## Definitions

- **Evidence (recorded replay):** what the system produced at time T,
  reconstructed without re-invoking the provider.
  Use to: prove what happened.

- **Experiment (live replay):** what the system would produce now under
  current provider/contract conditions.
  Use to: probe behavioral change.

- **Variance envelope (comparative replay):** what the system tends to
  produce, sampled N times, with stability score + drift vector.
  Use to: measure reproducibility of meaning.

## Hash equality semantics

| Mode | Hash match meaning |
|------|---------------------|
| recorded | always true by construction (no re-invocation) |
| live + pinned contract + declaredDeterministic | authoritative |
| live + best-effort | advisory |
| live + none | not meaningful |
| comparative | not used as primary signal; similarity matrix and stability score replace it |

## Rule
Never present `hashMatch` from a non-authoritative live replay as proof
of historical equivalence. The `hashAuthoritative` field exists for
exactly this distinction.

## Phase 5 extension
Comparative replay introduces a third epistemic mode. It must declare:
- mode = "comparative"
- sample count
- similarity matrix
- drift vector
- stability score with confidence band

A comparative replay is neither evidence nor experiment alone — it is
a statistical envelope. Treat it as such.