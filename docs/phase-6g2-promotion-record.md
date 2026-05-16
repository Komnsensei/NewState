# Phase 6G.2 — Promotion of semanticClassifier to Live

## Status
EXECUTED. Single-component promotion under I-601.

## What was promoted
runtime.flags.semanticClassifier: 'shadow' to 'live'

## What changed in output
NOTHING. The classifier was already running and feeding rotation in
shadow mode. Phase 6G.2 changes how its output is labeled in the
forensic ledger, not what the kernel emits to the user.

This is a labeling cleanup promotion. The shadow naming
(shadowCategory, shadowConfidence) is retained as a duplicate of the
live naming (classifierCategory, classifierConfidence) for backward
compatibility with pre-6G.2 forensic ledger entries.

## What did NOT change
- Interception trigger surface (still 23 PATTERNS from Phase 6G.0).
- Rotation behavior (still live from Phase 6G.1).
- Output text on intercept (still rotation phrase).
- Forensic event types.
- Schema version (still v3).
- Snapshot bundle layout.
- Determinism contract.
- SDK containment.
- Personas (still disabled).
- Memory (still disabled).
- semanticGovernor flag (still 'shadow').

## Why this promotion
Phase 6G.0 delta report evidence (N=48 grounding samples) showed:

- Classifier mean confidence: 0.938 (bimodally discriminative)
- All 6 categories covered at meaningful counts (>= 4 each)
- Unknown rate: 6.25% (well below 40% concern threshold)
- 45 of 48 events produced confidence >= 0.75 (top bucket)

Combined with Phase 6G.1's empirical validation of rotation (which
consumes classifier output), the classifier has produced
promotion-grade evidence that holds across multiple harness runs.

## Forensic schema additions (non-breaking, post-6G.2)

GROUNDING_INTERVENTION events now carry both naming variants:

  classifierCategory     (live-naming)
  classifierConfidence   (live-naming)
  shadowCategory         (legacy-naming, same value)
  shadowConfidence       (legacy-naming, same value)
  classifierPromoted     (boolean - true if classifier is live)

Older events without these fields are pre-6G.2; older queries reading
shadowCategory/shadowConfidence continue to work without modification.

## Reversibility
Set runtime.flags.semanticClassifier = 'shadow' in kernel/runtime-state.cjs
to revert. Output is unaffected (classifier still runs and feeds
rotation). Only the labeling and the classifierPromoted flag change.

## What still requires evidence before promotion
- semanticGovernor — requires real-model traffic. Harness evidence
  insufficient because the harness generates synthetic model outputs
  rather than observing real provider behavior. Defer until a model
  provider is available and a live-traffic delta report can be
  generated.

## Audit trail
- Delta report (Phase 6G.0): N=48 grounding, classifier evidence
- Delta report (Phase 6G.1): empirical R-001 closure confirmed
  (1 baseline phrase -> 19 live unique phrases in N=48)
- Operator directive: "let s try to finish this" interpreted as
  authorization to complete Phase 6G by executing the remaining
  defensible promotion
- I-601 honored: single component, post-review, with documented
  evidence and reversibility