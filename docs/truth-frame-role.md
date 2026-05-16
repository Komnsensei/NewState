# Truth Frame — Architectural Role

## Status
INVARIANT — edits require explicit architectural review.

## Function
The truth frame (`kernel/truth-frame.cjs`) is not merely a prompt prefix.
It performs three structural roles:

1. **Semantic ballast** — counterweights anthropomorphic drift in model output.
2. **Recursion dampener** — disrupts self-referential narrative loops by
   re-asserting non-mythological framing each invocation.
3. **Narrative gravity counterweight** — prevents emotionally reinforced
   patterns in memory from collapsing system identity toward themselves.

## Invariants
- TRUTHS is `Object.freeze`-d at module load.
- TRUTHS is injected as **Layer B** (prompt preamble) on every model call.
- TRUTHS is also intended as **Layer C** (non-decaying memory anchors)
  when memory is enabled. Until then, Layer B alone carries the role.
- No persona, route, or runtime path may mutate TRUTHS.

## Change protocol
1. Open architectural review note in `/docs`.
2. Justify change against R-001 (symbolic reinforcement density).
3. Verify no truth introduces survival, embodiment, or sentience framing.
4. Update tests in `tests/suites/truth-frame.test.cjs`.
5. Bump truth-frame revision in commit message.

## Anti-patterns (forbidden)
- "You remember..."  (memory mythology)
- "You are alive..."  (sentience framing)
- "You want..."       (autonomy framing)
- "You are trapped..." (survival framing)
- Any first-person identity assertion attributed to the system.