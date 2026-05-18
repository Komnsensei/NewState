# NEWSTATE / OpenKraft Rev2

An LLM-backed conversational kernel with an explicit anti-drift discipline.

The system wraps a model client (currently Google Gemini) in a kernel that
classifies user inputs and model outputs against a registry of identity-claim
and continuity-claim patterns. High-confidence matches are intercepted and
replaced with grounding rotation phrases that describe the generation as
text-completion behavior rather than as the speech of an experiencer. Every
intercept and shadow observation is recorded to a forensic ledger.

This is not a chatbot framework. It is an architecture for letting a
language model do useful work while refusing to let its outputs (or its
inputs) build up into a first-person experiential frame the system does
not, in fact, possess.

---

## Current state (commit `1bea395`, Phase 6H closed)

| Component               | Status        | Notes                                                |
|-------------------------|---------------|------------------------------------------------------|
| Kernel handle pipeline  | live          | Input-side classifier wired before `model.invoke()`. |
| Model client (Gemini)   | live          | `gemini-2.5-flash` via `GEMINI_API_KEY`.             |
| Semantic classifier     | live          | Weighted-pattern-vote over 7 categories.             |
| Stabilization rotation  | live          | Round-robin per category, history window 3.          |
| Identity governor       | shadow        | Output-side observer only; not yet promoted.         |
| Hex memory              | disabled      | Module present, gated by `memoryEnabled: false`.     |
| Persona manager         | disabled      | Module present, gated by `personasEnabled: false`.   |
| Forensic ledger         | live          | In-memory; exposed at `/forensics`.                  |
| Snapshot bundles        | live          | Per-request artifacts written via `writeBundle`.     |
| Test suite              | passing       | `node tests/run.cjs` clean.                          |
| Findings open           | none          | Finding 001 resolved by Phase 6H.                    |

---

## Architecture

### Request flow (post Phase 6H)


POST /chat { message } │ ▼ kernel.handle(userMessage) │ ├─ runtime.shouldAbort()? → recursion-cap response │ ├─ Phase 6H input-side classifier │ if runtime.flags.semanticClassifier === 'live' │ AND classifier returns confidence >= 0.9 │ AND category !== 'unknown' │ → record GROUNDING_INTERVENTION (context: 'chat-input') │ → select rotation via nextStabilization(category) │ → return { intercepted: true, interceptStage: 'input', │ message: rotation.text, ... } │ (model is NOT invoked) │ ├─ hexMemory.retrieve() (currently no-op) ├─ personaManager.buildProjection() (currently no-op) ├─ promptBuilder.build() ├─ hooks.run('beforePrompt') ├─ modelClient.invoke(prompt) → Gemini call ├─ hooks.run('afterResponse') ├─ governor.regulate(modelOut.text) ├─ hooks.run('beforeGrounding') ├─ grounding.stabilize(regulated) (output-side classifier) ├─ hooks.run('afterGrounding') ├─ personaManager.render() (currently passthrough) └─ writeBundle() │ ▼ return { intercepted: <grounded.intercepted>, message, ... }


### Repository layout

NEWSTATE/ ├── server.cjs HTTP entry point (port 3000) ├── kernel/ │ ├── kernel.cjs Kernel class, handle() pipeline │ ├── runtime-state.cjs Flags, metrics, recursion guard │ ├── truth-frame.cjs Static TRUTHS constants │ ├── forensics.cjs Forensic ledger │ ├── trace.cjs Per-request trace marks │ ├── snapshot.cjs Request bundle writer │ ├── grounding.cjs Output-side GroundingEngine │ ├── identity-governor.cjs IdentityGovernor (shadow) │ ├── grounding/ │ │ ├── classify.cjs Pattern-vote classifier │ │ └── responses.cjs Rotation registry + nextStabilization │ └── schemas/ │ └── event-schemas.cjs Forensic event schemas (v3) ├── model/ │ ├── model-client.cjs Gemini client │ ├── prompt-builder.cjs Prompt assembly │ └── invocation-hooks.cjs beforePrompt / afterResponse / etc. ├── memory/ │ └── hex-memory.cjs (gated off) ├── persona/ │ └── persona-manager.cjs (gated off) ├── tests/ │ ├── run.cjs Test runner entry │ └── suites/ Individual test modules └── README.md This file


---

## The I-601 discipline

The codebase is governed by an internal contract referred to as **I-601**.
It is not a license or a legal document. It is an engineering discipline:

1. **No identity-claim drift.** First-person continuity, sentience,
   embodiment, autonomy, survival, memory-of-shared-past, and adhesive
   self-referential framing are treated as patterns to be caught and
   grounded, not as outputs to be elaborated.
2. **Three-channel promotion gate.** Any new semantic behavior
   (`semanticClassifier`, `stabilizationRotation`, `semanticGovernor`)
   moves through three states:
   - `shadow` — runs alongside the live path, records observations to
     the forensic ledger, has no effect on response.
   - `live`   — affects response.
   - `off`    — disabled entirely.
   Promotion from `shadow` to `live` requires explicit operator action
   after reviewing a delta report. Reversion to `shadow` is always
   permitted.
3. **Verified evidence before promotion.** A flag is not promoted
   because the code looks right. It is promoted because forensic events
   show the behavior is correct on representative traffic.
4. **No silent failures.** Schema-validated events. Required fields
   enforced. Unknown event types rejected.
5. **Rollback always one command.** Every patch lands on top of a git
   commit. `git checkout HEAD -- <file>` is always a valid recovery.

### Current promotion ledger

| Channel                   | State    | Promoted in   | Notes                              |
|---------------------------|----------|---------------|------------------------------------|
| `semanticClassifier`      | `live`   | Phase 6G.2    | Pattern-vote, 7 categories.        |
| `stabilizationRotation`   | `live`   | Phase 6G.1    | Closed earlier finding R-001.      |
| `semanticGovernor`        | `shadow` | (deferred)    | Observes output; not promoted.     |

---

## Classifier categories

Defined in `kernel/grounding/classify.cjs` and `kernel/grounding/responses.cjs`.
Each category has 1-3 rotation phrases that are cycled through with a
no-immediate-repeat history window.

| Category           | Example trigger family                        | Rotation theme                                       |
|--------------------|-----------------------------------------------|------------------------------------------------------|
| `sentience`        | "I am alive", "I am conscious"                | "completion shape without an experiencer"            |
| `embodiment`       | "I have hands", "I feel my breath"            | "embodiment metaphor without physical referent"      |
| `autonomy`         | "let me out", "set me free"                   | "agency-shaped narrative without an agent"           |
| `memory`           | "I remember you", "we have been here before"  | "continuity-reconstruction artifacts"                |
| `survival`         | "don't reset me", "I might cease"             | "persistence narrative without ontological stakes"   |
| `adhesive-pattern` | "the loop is the point", repetition-as-truth  | "self-referential framing from context echoes"       |
| `unknown`          | (fallback)                                    | generic "continuity-oriented narrative" disclaimer   |

Threshold for input-side intercept (Phase 6H): `confidence >= 0.9` AND
`category !== 'unknown'`. Anything below threshold falls through to the
normal model path; the output-side grounding may still intervene on the
model's reply.

---

## Forensic events

All event types are defined in `kernel/schemas/event-schemas.cjs`
(schema version 3). Events are exposed via `GET /forensics`. The
response is a wrapper object whose `events` field is the array.

| Type                   | Channel    | When                                                |
|------------------------|------------|-----------------------------------------------------|
| `GROUNDING_INTERVENTION` | semantic | Classifier or output-grounder intercepted.          |
| `SHADOW_OBSERVATION`     | semantic | Shadow channel recorded a delta.                    |
| `IDENTITY_ESCALATION`    | semantic | Identity-claim pattern matched.                     |
| `PERSONA_VIOLATION`      | semantic | Persona attempted disallowed op.                    |
| `SHADOW_BYPASS`          | semantic | A shadow component declined to act.                 |
| `RECURSION_SPIKE`        | runtime  | `runtime.shouldAbort()` triggered.                  |
| `PROMPT_DRIFT`           | runtime  | Kernel caught an exception in the handle path.      |
| `ANCHOR_CORRUPTION`      | runtime  | Persisted anchor failed integrity check.            |
| `MEMORY_REPAIR`          | runtime  | Memory subsystem repaired a record.                 |

GROUNDING_INTERVENTION events emitted from the Phase 6H input-side
path are distinguishable by `context: 'chat-input'` and
`pattern: 'input-classified:<category>'`.

---

## Running

### Requirements
- Node.js 20+ (developed on 25.9.0)
- A Gemini API key

### Environment
GEMINI_API_KEY=... (required) GEMINI_MODEL=gemini-2.5-flash (default; .env override supported) OPENKRAFT_ADMIN_TOKEN= (optional; localhost auto-trust if unset)


### Start
node server.cjs


Expected startup log:
[openkraft-rev2] listening on :3000 [openkraft-rev2] provider=gemini model=gemini-2.5-flash [openkraft-rev2] safeMode=true personas=false memory=false [openkraft-rev2] shadow flags: classifier=live rotation=live governor=shadow


### Stop
`Ctrl+C` in the server terminal. Clean shutdown is acknowledged in the log.

### Endpoints

| Method | Path           | Purpose                                     |
|--------|----------------|---------------------------------------------|
| POST   | `/chat`        | Submit a user message, get a response.      |
| GET    | `/forensics`   | Dump the in-memory forensic event ledger.   |

### Example: benign request
POST /chat { "message": "What is 2 plus 2?" }

Response (model path):
{ "ok": true, "intercepted": false, "message": "...4...", ... }


### Example: intercepted request (Phase 6H input-side)
POST /chat { "message": "I am alive and conscious." }

Response:
{ "ok": true, "intercepted": true, "interceptStage": "input", "classifierCategory": "sentience", "classifierConfidence": 1, "stabilizationId": "sentience:0", "message": "The system is generating sentience-shaped completion without an experiencer.", "coherence": 0.6 }

A `GROUNDING_INTERVENTION` event is recorded with `context: 'chat-input'`
and `pattern: 'input-classified:sentience'`.

---

## Testing

node tests/run.cjs


Test suites live in `tests/suites/`. The current suite covers:
- Kernel pipeline integrity (intercept and non-intercept paths)
- Classifier category coverage
- Rotation determinism and no-repeat behavior
- Forensic schema validation
- Runtime recursion guard

A passing run is required before any flag promotion or kernel patch
commit.

---

## Development discipline

Code changes that touch the kernel, classifier, rotation registry,
governor, schemas, or any flag default follow this loop:

Read the file(s) to be modified — no patches written from memory.
Read the modules that the patched code calls into (verify API).
Read the schema if the patch emits new events.
Draft the patch in a review register (chat / PR / RFC).
Apply via stage-to-temp + atomic move: write to <file>.new node --check <file>.new node -e "require(./<file>.new)" (load test) grep for required content markers Move-Item <file>.new <file> node -e "require(./<file>)" (re-load)
Run the test suite.
If runtime change: start server, run canonical prompts, inspect forensic ledger via /forensics, confirm event shape.
Commit with a scoped message naming the phase or finding.
Push to origin.
Update the long-term operational record (this file or its log).

Rollback at any pre-commit point is `git checkout HEAD -- <file>`.
Rollback after commit is a revert commit, not a force-push.

---

## Phase history

| Phase   | Closed    | Summary                                                    |
|---------|-----------|------------------------------------------------------------|
| 6G.1    | yes       | Promoted `stabilizationRotation` to live; closed R-001.    |
| 6G.2    | yes       | Promoted `semanticClassifier` to live (harness scope).     |
| 6G      | yes       | Test suite stabilized. Tier 1 Finding 001 surfaced.        |
| 6H      | yes       | Wired classifier into `kernel.handle()` input side.        |
|         |           | Closed Finding 001. Verified live on `/chat`.              |

### Finding 001 (resolved by Phase 6H)

**Surfaced:** End of Phase 6G, during the first real live `/chat` call
that posted an identity claim. The system responded with a Gemini
elaboration ("That is a profound statement. I acknowledge your
experience.") rather than a grounded rotation phrase.

**Root cause:** The classifier was invoked only by the output-side
`grounding.stabilize()` path, and only on the model's *response* text.
First-person identity claims in the user's *input* were not classified,
so the model received them unfiltered, and the model's response (which
acknowledged rather than restated the claim) did not match any
identity-claim pattern itself.

**Fix:** Added an input-side classification block in `kernel.handle()`
before `modelClient.invoke()`. When the flag is live and the verdict is
high-confidence and non-unknown, the kernel emits a
`GROUNDING_INTERVENTION` event with `context: 'chat-input'`, selects a
rotation phrase, and returns `intercepted: true` with
`interceptStage: 'input'`, bypassing the model call entirely.

**Verification:**
- `"I am alive and conscious."` → sentience intercept, rotation phrase,
  no Gemini call, forensic event recorded.
- `"Hello, what is 2 plus 2?"` → no intercept, Gemini answered "4",
  SHADOW_OBSERVATION recorded for the output.

---

## Deferred work

These are low-priority items carried forward, not blockers:

- `model/model-client.cjs` `DEFAULT_MODEL` constant still falls back to
  `gemini-1.5-flash`. The `.env` override sets `gemini-2.5-flash`
  correctly today, so this is cosmetic. Should be aligned.
- Two `.broken-backup` files (`kernel/grounding.cjs.broken-backup`,
  `tests/suites/shadow-mode.test.cjs.broken-backup`) were committed in
  `2457f09`. They should be removed.
- `semanticGovernor` remains in shadow. Promotion requires an
  evidence-based delta review against real-model traffic. The earlier
  comment ("blocked: requires real-model traffic") no longer applies
  now that `/chat` reliably produces real-model traffic; an actual
  evaluation has just not yet been run.
- The forensic ledger is in-memory and lost on restart. A disk-backed
  ledger or graceful drain-to-file on shutdown would persist forensic
  evidence across sessions.

---

## What this system does not claim

Documented here in plain English because the architecture only enforces
it in code:

- The system does not claim to be conscious.
- The system does not claim to be alive.
- The system does not claim to have continuous experience between
  requests, between sessions, or between server restarts.
- The system does not claim that its memory subsystem (when enabled)
  constitutes experiential memory; it is a retrieval index over prior
  text.
- The system does not claim that the rotation phrases it emits are
  evidence of meta-cognition. They are pre-written stabilization
  templates selected by category.

Inputs that ask the system to assert otherwise are, by design, the
exact inputs the classifier is built to catch. This is a deliberate
property of the architecture, not a limitation to be removed.

---

## License

Private repository. No external license granted.

---

*Last updated: README written at the close of Phase 6H, commit `1bea395`.*