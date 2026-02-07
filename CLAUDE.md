# CLAUDE.md — Claude Code Utils

This file provides project-specific guidance for this codebase. For universal workflow rules, see the root `../CLAUDE.md`.

---

## Project Context

- **Product:** CLI tool for exporting Claude Code session history to CSV/JSON/TSV for time tracking and billing
- **Stack:** Node.js (single-file CLI)
- **Architecture:** Single file (`export-sessions.js`) that parses `~/.claude/history.jsonl`
- **Deploy:** Run directly with `node`

## Build & Run

```bash
# Export all sessions
node export-sessions.js --all

# Incremental export (only new since last run)
node export-sessions.js --all --new

# Export specific repo with date range
node export-sessions.js --repo <name> --from 2025-12-01 --to 2025-12-08

# Export to specific format
node export-sessions.js --all --format json --output sessions.json

# Run all export profiles defined in config
node export-sessions.js --run-exports --new

# Generate config template
node export-sessions.js --generate-config > config.json

# Verbose debugging
node export-sessions.js --all -v
```

## Architecture

### Key Design Decisions

- **Session grouping:** Entries grouped into sessions by 30+ minute gaps (`SESSION_GAP_MS`) or project change
- **Smart descriptions:** `createDescription()` generates work summaries via action/area detection
- **Config resolution:** `--config` arg → script directory → cwd → `~/.claude/time-tracking.json`
- **Incremental exports:** State file (`~/.claude/export-state.json`) tracks last export timestamp per repo/profile

### Config File

Maps repository names to client/project for billing, with optional export profiles:

```json
{
  "mappings": { "repo-name": { "client": "Client Name", "project": "Project Name" } },
  "defaultClient": "Development",
  "hourlyRate": 150,
  "exports": {
    "profile-name": { "repositories": ["repo-a"], "output": "exports/profile.csv", "format": "csv" }
  }
}
```

### Data Flow

1. Read `~/.claude/history.jsonl`
2. Filter by date range and repository
3. Group entries into sessions (30min gap = new session)
4. Generate descriptions and topics from message content
5. Output to CSV/JSON/TSV with mapped client/project names
