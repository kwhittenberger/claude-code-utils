# Claude Code Utils

Utilities for working with Claude Code session data - export sessions for time tracking, analyze development activity, and more.

## Features

- **Session Export**: Export Claude Code sessions to CSV, JSON, or TSV for time tracking import
- **Smart Summaries**: Auto-generate work descriptions from session messages (e.g., "Bug fixes: authentication, API")
- **Client Mapping**: Map repositories to clients/projects for billing
- **Date Filtering**: Export sessions for specific date ranges
- **Per-Repo Stats**: See breakdown of time spent per repository

## Installation

```bash
# Clone the repo
git clone https://github.com/yourusername/claude-code-utils.git
cd claude-code-utils

# Generate your config
node export-sessions.js --generate-config > config.json

# Edit config.json to add client mappings
```

## Usage

### Export Sessions

```bash
# Export all sessions
node export-sessions.js --all

# Export specific repository
node export-sessions.js --repo personal-finances

# Export with date range
node export-sessions.js --all --from 2025-12-01 --to 2025-12-08

# Different output formats
node export-sessions.js --all --format json --output sessions.json
node export-sessions.js --all --format tsv --output sessions.tsv
```

### Generate Config

```bash
# Auto-discover repos and generate config template
node export-sessions.js --generate-config > config.json
```

Then edit `config.json` to add your client names:

```json
{
  "mappings": {
    "personal-finances": { "client": "Personal", "project": "Finance App" },
    "notebook-ui": { "client": "Internal", "project": "UI Library" },
    "client-project": { "client": "Acme Corp", "project": "Website Redesign" }
  },
  "defaultClient": "Development",
  "hourlyRate": 150
}
```

## Output Columns

| Column | Description |
|--------|-------------|
| Date | Session date (YYYY-MM-DD) |
| Client | Mapped client name from config |
| Project | Mapped project name from config |
| Repository | Repository folder name |
| Description | Auto-generated work summary |
| Start Time | ISO timestamp |
| End Time | ISO timestamp |
| Duration (hours) | Decimal hours (e.g., 1.50) |
| Duration (minutes) | Integer minutes |
| Message Count | Number of prompts in session |
| Topics | Detected topics (bug-fix, feature, testing, etc.) |
| Project Path | Full filesystem path |

## How Sessions are Detected

- Sessions are grouped by gaps in activity (30+ minutes = new session)
- Each repository is tracked separately
- Timestamps come from your Claude Code history file (`~/.claude/history.jsonl`)

## Smart Descriptions

The tool analyzes your prompts to generate meaningful descriptions:

- **Action detection**: Bug fixes, Feature development, Testing, Deployment, etc.
- **Area detection**: authentication, database, API, UI, notifications, etc.
- **Combined output**: "Bug fixes & Feature development: database, API, UI"

## Config File Locations

The tool looks for `config.json` in these locations (in order):

1. `--config <path>` argument
2. Same directory as the script
3. Current working directory
4. `~/.claude/time-tracking.json`

## License

MIT
