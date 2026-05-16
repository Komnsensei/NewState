# Three-Layer Truth Model

## Status
ARCHITECTURAL CONTRACT — changes require explicit review.

## Layers

| Layer | Source | Fidelity | Failure modes |
|-------|--------|----------|---------------|
| Runtime truth | live kernel execution | live | execution errors, recursion spike |
| Recorded truth | snapshots + forensics | historical | storage corruption, schema drift |
| Replay truth | recorded (det.) or live (prob.) | reconstructive | provider drift, unpinned seed |

## Invariants
- Each layer has distinct fidelity and distinct failure modes.
- Runtime truth is never edited retroactively.
- Recorded truth is append-only.
- Replay truth must declare its mode (`recorded` | `live` | `comparative`) and its
  `determinismGuarantee` (`pinned` | `best-effort` | `none`).
- A replay's hash equality with the original is authoritative ONLY when
  guarantee is `pinned` and both contracts match.

## Forbidden conflations
- Treating live replay hash equality as historical proof.
- Editing forensic logs in place.
- Using recorded replay to validate behavioral change (use live).
- Using live replay to validate historical fact (use recorded).
- Treating comparative replay variance as either historical proof or
  pure experiment — it is both, weighted.