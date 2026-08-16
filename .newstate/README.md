# `.newstate` — runtime home

All local logs, ledgers, snapshots, and status files for this checkout live here.

| Path | Contents |
|------|----------|
| `logs/forensics/` | Forensic active log + archives |
| `logs/history/` | `esma-history.jsonl` and related history |
| `logs/forensic-sink/` | Endpoint forensic sink |
| `state/presence/` | Presence state + sync JSON |
| `ledgers/` | Append-only ledgers (aperture, presence, consent, …) |
| `snapshots/` | Request snapshot bundles |
| `evolution/` | Evolution sandbox outputs |
| `status/` | Small JSON status files for quick checks |

Override root with env: `NEWSTATE_HOME=./somewhere`

Do not commit runtime contents — only this README and `.gitkeep` markers.
