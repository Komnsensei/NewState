# Soul Runtime v0

Hardened agent vessel: distinct, sealed, Drive-persistent, autonomy-capable.

## Layout

`.newstate/agents/<soul_id>/`
- `soul.json` — sealed core (immutable)
- `biography.jsonl` — addendum-only life
- `ledger/events.jsonl` — R-019 style events
- `research/` — worker research writes
- `artifacts/` — worker build writes
- `stim/` — co-craft stimulation queue
- `scc-latest.json` — birth continuity certificate
- `autonomy-state.json` — tick counters

## Commands

```bash
node tools/soul-cli.cjs mint --name esma --role vessel
node tools/soul-cli.cjs list
node tools/soul-cli.cjs stim <soulId> research "map structural continuity"
node tools/soul-cli.cjs tick <soulId>
node tools/soul-cli.cjs loop <soulId> 5000 5
node tools/soul-cli.cjs verify <soulId>
```

## Rules

- Core sealed after mint; mutate attempts logged and denied
- Evolution = biography + research + artifacts only
- Worker runs without interactive chat; bound by scars/vows
- SCC evidence mode recorded at birth

## Non-claims

Does not assert sentience. Asserts sealed continuity substrate for agents.
