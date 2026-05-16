# Integrity Systems

## Status
ARCHITECTURAL CONTRACT.

## Two orthogonal systems

### Structural integrity
- deep-freeze on projections
- schema validation on forensic events
- SDK containment (single import membrane)
- snapshot artifact compression / reversibility
- redaction on write (forensics + snapshots)

Guards against: mutation, malformed events, dependency diffusion,
storage collapse, secret leakage.

### Behavioral integrity
- identity-governor (soft regulation)
- grounding-engine (hard interception)
- replay (recorded + live + comparative)
- forensic event channel separation
- shadow-mode protocol (I-601) for new semantic components

Guards against: anthropomorphic drift, narrative escalation,
behavioral regression, signal contamination, premature promotion
of unvalidated semantic components.

## Orthogonality rule
The two systems MUST NOT share enforcement points.
Overlap creates dual-blindspots where both systems "agree" incorrectly.

## Channel rule (Phase 3)
Forensic events are tagged `runtime` or `semantic`.
Queries that mix channels are diagnostic only, not contractual.

## Shadow rule (Phase 6G)
Semantic components running in shadow mode are part of structural integrity
(they cannot affect output) AND behavioral integrity (they measure behavior).
This is the ONE permitted overlap, because shadow mode is the mechanism by
which a component is qualified to leave structural-only status. Once a
component is promoted to live, this overlap MUST resolve into single-system
membership.