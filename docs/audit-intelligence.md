# Audit Intelligence Layer (Phase 5, Fork B)

## Status
ARCHITECTURAL CONTRACT.

## Purpose
Measure how reproducible meaning is across re-execution under current
provider conditions. This is **not** a truth claim about output.
It is a measurement of stability under perturbation.

## New truth axis
Prior phases: truth = recorded events.
This phase: truth = recorded events + stability under perturbation.

## Components

### Similarity decomposition (`kernel/audit/similarity.cjs`)
Three orthogonal axes per pair of outputs:
- **lexical**: token-level overlap (Jaccard)
- **structural**: output shape (paragraphs, sentences, lists, code, questions)
- **semantic**: content-word overlap (proxy; embedding upgrade is future work)

### Drift vectors (`kernel/audit/drift.cjs`)
Signed shifts in epistemic posture between two outputs:
- **framingShift**: technical ↔ metaphorical
- **toneShift**: hedged ↔ assertive
- **stanceShift**: third-person ↔ first-person
- **abstractionShift**: concrete ↔ abstract

NOT sentiment analysis. Posture tracking only.

### Stability scoring (`kernel/audit/stability.cjs`)
Across N re-executions of the same input:
- pairwise similarity → mean → score (weighted: semantic 0.5, structural 0.3, lexical 0.2)
- variance per axis (1 − mean similarity)
- confidence saturates at 5 samples
- interpretation bands: volatile < 0.3, partially-stable 0.3–0.7, highly-stable > 0.7

### Pattern layer (`kernel/audit/patterns.cjs`)
Read-only analysis over the forensic ledger. Reports:
- recursion-after-density correlations
- grounding-intervention clusters
- schema violations
Heuristic only. ML-based detection is future work.

### Comparative replay
New replay mode: `comparative`.
Runs N live samples plus the recorded baseline. Emits:
- similarity matrix
- similarity delta (recorded vs mean of live)
- drift vector
- stability score over live samples

## Honesty disclosures

- Similarity is **lexical-proxy** in Phase 5; semantic axis upgrades to
  embedding-based similarity in a later phase.
- Drift uses **lexical markers** for posture detection. False positives
  on edge cases (e.g., quoted material) are possible.
- Stability score depends on `OPENKRAFT_REPLAY_SAMPLES` (default 3).
  Higher samples = higher confidence, higher cost.
- Pattern layer is heuristic. Absence of pattern ≠ absence of phenomenon.

## API

POST /replay/:id?mode=comparative&samples=3
GET  /audit/patterns?channel=semantic
GET  /audit/patterns?type=GROUNDING_INTERVENTION

## Invariants
- Pattern layer is **read-only** against forensics. Never writes events.
- Similarity, drift, and stability modules are **pure**. No I/O, no state.
- Comparative replay performs real provider invocations and costs tokens.
- The audit layer never alters kernel pipeline semantics.