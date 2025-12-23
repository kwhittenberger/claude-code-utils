# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Claude Code Utils is a Node.js utility for exporting Claude Code session history to CSV/JSON/TSV formats for time tracking and billing purposes. It parses `~/.claude/history.jsonl` to extract session data.

## Commands

```bash
# Export all sessions
node export-sessions.js --all

# Export specific repository
node export-sessions.js --repo <name>

# Export with date range
node export-sessions.js --all --from 2025-12-01 --to 2025-12-08

# Export to specific format
node export-sessions.js --all --format json --output sessions.json

# Generate config template from discovered projects
node export-sessions.js --generate-config > config.json

# Verbose mode for debugging
node export-sessions.js --all -v

# Export only new sessions since last export (incremental)
node export-sessions.js --all --new
```

## Architecture

Single-file CLI tool (`export-sessions.js`) with these key functions:

- **Session grouping**: Entries are grouped into sessions by 30+ minute gaps in activity (`SESSION_GAP_MS`)
- **Smart descriptions**: `createDescription()` analyzes message content to generate work summaries using action detection (bug fix, feature, etc.) and area detection (database, API, UI, etc.)
- **Topic extraction**: `extractTopics()` identifies keywords for categorization
- **Config resolution**: Searches multiple paths for config.json: `--config` arg → script directory → cwd → `~/.claude/time-tracking.json`
- **Incremental exports**: State file (`~/.claude/export-state.json`) tracks last export timestamp per repository for `--new` option

## Config File

Config maps repository names to client/project for billing:

```json
{
  "mappings": {
    "repo-name": { "client": "Client Name", "project": "Project Name" }
  },
  "defaultClient": "Development",
  "hourlyRate": 150
}
```

## Data Flow

1. Read `~/.claude/history.jsonl` (JSONL format with timestamp, project, display fields)
2. Filter by date range and repository
3. Group entries into sessions (30min gap = new session)
4. Generate descriptions and topics from message content
5. Output to CSV/JSON/TSV with mapped client/project names
