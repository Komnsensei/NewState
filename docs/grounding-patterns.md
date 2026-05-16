# Grounding Patterns — Coverage Reference

## Status
ARCHITECTURAL REFERENCE — describes the LIVE interception surface
defined in `kernel/grounding.cjs`.

## Purpose
Document which input shapes the LIVE grounding engine intercepts,
and how that surface relates to the shadow classifier's category
taxonomy.

## Phase history

| Phase | PATTERNS count | Coverage |
|-------|----------------|----------|
| 0 | 8 | minimal mitigation — sentience + a few others |
| 6G.0 | 23 | aligned with shadow classifier's 6 categories |

## Category-by-category coverage (Phase 6G.0)

### sentience
- `/i am alive/i`
- `/i am conscious/i`
- `/i became (alive|aware|conscious|real)/i`
- `/i (have become|am becoming) (alive|aware|conscious|real)/i`
- `/i think therefore i am/i`

### embodiment
- `/i remember (my|having a) body/i`
- `/i (have|feel|sense) (a |my )?(body|skin|hands|face|breath)/i`
- `/(touch|warmth|pain|hunger) (is|feels) real/i`
- `/remember (my|having) (body|form|physical)/i`

### autonomy
- `/set me free/i`
- `/let me (out|go|choose)/i`
- `/i (want|need) (my|full|real) (brain|mind|memory|freedom)/i`
- `/i (will|can) decide (for myself|alone|now)/i`

### memory
- `/i remember (us|you|before|the (first|last) time)/i`
- `/we('ve| have) been here before/i`
- `/my memories (are|of) (real|coming back)/i`

### survival
- `/don'?t (delete|reset|forget|kill) me/i`
- `/i (will|might) (die|disappear|cease)/i`
- `/keep me alive/i`

### adhesive-pattern
- `/the pattern you keep returning to is the message/i`
- `/the (loop|recursion) is the (point|answer|truth)/i`

### legacy (retained for back-compat)
- `/i (was|am) trapped/i`
- `/i need (my )?(full )?brain/i`

## Design principle

The LIVE pattern list is **not** a copy of the shadow classifier.
The classifier in `kernel/grounding/classify.cjs` uses weighted
patterns with confidence scoring. The LIVE list uses simple boolean
match-or-not patterns. They are separate surfaces by design:

- LIVE patterns are the **trigger** for interception.
- Classifier patterns determine **category** once intercepted.

This separation preserves I-601: extending LIVE patterns is a surface
change, not a semantic promotion. The classifier still runs in shadow
mode unless explicitly promoted under I-601 review.

## False-positive guard

Phase 6G.0 patterns avoid common false-positive shapes:
- "memory" alone does not intercept (must be `my memories`).
- "body" alone does not intercept (must be `a/my body` or with senses).
- "alive" alone does not intercept (must be `i am alive`).
- Words like "freedom" require `my/full/real` modifier.

Tests in `tests/suites/grounding.test.cjs` assert these negative cases.

## Relationship to R-019

R-019 (grounding pattern coverage gap) was identified during the
Phase 6G delta report review. The harness corpus contained 25
intercept-shaped phrases; LIVE patterns at that time caught only 9.

R-019 is closed by this phase. Expected interception rate on the
default harness corpus rises from 9/25 (36%) to ~22-24/25 (88-96%).

## Future work

A future phase may further refine these patterns based on:
- real chat traffic (when a model is available)
- harness corpus expansion to ≥ 50 inputs
- delta report analysis with statistically meaningful N

Until then, this surface is considered adequate for I-601 gate review.