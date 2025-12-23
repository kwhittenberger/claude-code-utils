#!/usr/bin/env node

/**
 * Export Claude Code session history to CSV for time tracking
 * 
 * Parses ~/.claude/history.jsonl to extract session information
 * 
 * Usage: node export-sessions.js [options]
 * 
 * Options:
 *   --repo <name>     Filter by repository name (e.g., personal-finances)
 *   --output <file>   Output file (default: claude-sessions.csv)
 *   --format <fmt>    Output format: csv, json, tsv (default: csv)
 *   --from <date>     Start date filter (YYYY-MM-DD)
 *   --to <date>       End date filter (YYYY-MM-DD)
 *   --all             Include all projects
 *   --config <file>   Config file for repo mappings (default: ./config.json)
 *   --verbose, -v     Show debug information
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Script directory for finding config
const scriptDir = __dirname;

// Claude Code stores data in ~/.claude
const claudeDir = path.join(os.homedir(), '.claude');
const historyFile = path.join(claudeDir, 'history.jsonl');
const projectsDir = path.join(claudeDir, 'projects');
const stateFile = path.join(claudeDir, 'export-state.json');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  project: process.cwd(),
  repo: null,
  output: 'claude-sessions.csv',
  format: 'csv',
  from: null,
  to: null,
  all: false,
  config: null,
  verbose: false,
  new: false,
  exportProfile: null,
  runExports: false
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--project' && args[i + 1]) {
    options.project = args[++i];
  } else if (args[i] === '--output' && args[i + 1]) {
    options.output = args[++i];
  } else if (args[i] === '--format' && args[i + 1]) {
    options.format = args[++i].toLowerCase();
  } else if (args[i] === '--from' && args[i + 1]) {
    options.from = new Date(args[++i] + 'T00:00:00');
  } else if (args[i] === '--to' && args[i + 1]) {
    options.to = new Date(args[++i] + 'T23:59:59');
  } else if (args[i] === '--repo' && args[i + 1]) {
    options.repo = args[++i];
  } else if (args[i] === '--all') {
    options.all = true;
  } else if (args[i] === '--new') {
    options.new = true;
  } else if (args[i] === '--config' && args[i + 1]) {
    options.config = args[++i];
  } else if (args[i] === '--verbose' || args[i] === '-v') {
    options.verbose = true;
  } else if (args[i] === '--export-profile' && args[i + 1]) {
    options.exportProfile = args[++i];
  } else if (args[i] === '--run-exports') {
    options.runExports = true;
  } else if (args[i] === '--generate-config') {
    generateConfig();
    process.exit(0);
  } else if (args[i] === '--help') {
    console.log(`
Export Claude Code session history for time tracking

Usage: node export-sessions.js [options]

Options:
  --repo <name>     Filter by repository name (e.g., personal-finances)
  --output <file>   Output file (default: claude-sessions.csv)
  --format <fmt>    Output format: csv, json, tsv (default: csv)
  --from <date>     Start date filter (YYYY-MM-DD)
  --to <date>       End date filter (YYYY-MM-DD)
  --all             Include all projects
  --new             Export only sessions since last export
  --config <file>   Config file for repo→client mappings (default: ./config.json)
  --generate-config Generate a config file from discovered projects
  --export-profile <name>  Run a specific export profile from config
  --run-exports     Run all export profiles defined in config
  --verbose, -v     Show debug information
  --help            Show this help message

Config file format (JSON):
  {
    "mappings": {
      "personal-finances": { "client": "Personal", "project": "Finance App" },
      "notebook-ui": { "client": "Internal", "project": "UI Library" }
    },
    "defaultClient": "Development",
    "hourlyRate": 150,
    "exports": {
      "client-a": {
        "repositories": ["personal-finances", "notebook-ui"],
        "output": "client-a-sessions.csv",
        "format": "csv"
      },
      "client-b": {
        "repositories": ["other-repo"],
        "output": "exports/client-b.json",
        "format": "json"
      }
    }
  }

Examples:
  node export-sessions.js --all --from 2025-12-01 --to 2025-12-08
  node export-sessions.js --repo personal-finances
  node export-sessions.js --format json --output sessions.json
  node export-sessions.js --generate-config > config.json
  node export-sessions.js --all --new  # Export only new sessions since last export
  node export-sessions.js --export-profile client-a --new  # Run single profile
  node export-sessions.js --run-exports --new  # Run all export profiles
`);
    process.exit(0);
  }
}

// Auto-detect format from output filename if not specified
if (options.output !== 'claude-sessions.csv') {
  const ext = path.extname(options.output).toLowerCase();
  if (ext === '.json') options.format = 'json';
  else if (ext === '.tsv') options.format = 'tsv';
}

/**
 * Generate a config file based on discovered projects from history
 */
function generateConfig() {
  if (!fs.existsSync(historyFile)) {
    console.error('No history file found in ~/.claude');
    process.exit(1);
  }

  // Read history to get actual project paths
  const content = fs.readFileSync(historyFile, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());
  
  const projectPaths = new Set();
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      if (entry.project) {
        projectPaths.add(entry.project);
      }
    } catch (err) {
      // Skip invalid lines
    }
  }

  // Filter to repos folders and extract repo names
  const repoProjects = [...projectPaths]
    .filter(p => p.toLowerCase().includes('repos'))
    .map(p => ({
      fullPath: p,
      repoName: path.basename(p.replace(/\\\\/g, '\\'))
    }))
    .filter(p => p.repoName.toLowerCase() !== 'repos'); // Exclude bare repos folder

  const mappings = {};
  for (const project of repoProjects) {
    // Create a human-friendly project name from repo name
    const friendlyName = project.repoName
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    mappings[project.repoName] = {
      client: "",  // User fills this in
      project: friendlyName
    };
  }

  const config = {
    mappings,
    defaultClient: "Development",
    hourlyRate: null
  };

  console.log(JSON.stringify(config, null, 2));
}

/**
 * Read the last export timestamp from state file
 * @param {string} repoKey - Repository name or '_all' for all repos
 * @returns {number|null} Timestamp in milliseconds, or null if no previous export
 */
function getLastExportTime(repoKey) {
  try {
    if (fs.existsSync(stateFile)) {
      const state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));

      // Handle old format (single timestamp) - migrate to new format
      if (typeof state.lastExportTime === 'number') {
        return state.lastExportTime;
      }

      // New format: per-repository timestamps
      // Fall back to _all timestamp if repo-specific entry doesn't exist
      if (state.lastExportTime && typeof state.lastExportTime === 'object') {
        return state.lastExportTime[repoKey] || state.lastExportTime['_all'] || null;
      }
    }
  } catch (err) {
    if (options.verbose) {
      console.warn(`Warning: Could not read state file: ${err.message}`);
    }
  }
  return null;
}

/**
 * Save the current export timestamp to state file
 * @param {string} repoKey - Repository name or '_all' for all repos
 * @param {number} timestamp - Timestamp in milliseconds
 */
function saveLastExportTime(repoKey, timestamp) {
  try {
    let state = { lastExportTime: {} };

    // Read existing state if present
    if (fs.existsSync(stateFile)) {
      const existing = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));

      // Migrate old format to new format
      if (typeof existing.lastExportTime === 'number') {
        state.lastExportTime = { '_all': existing.lastExportTime };
      } else if (existing.lastExportTime && typeof existing.lastExportTime === 'object') {
        state.lastExportTime = existing.lastExportTime;
      }
    }

    // Update the specific repo timestamp
    state.lastExportTime[repoKey] = timestamp;

    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
    if (options.verbose) {
      console.log(`Saved export state for '${repoKey}' to: ${stateFile}`);
    }
  } catch (err) {
    console.warn(`Warning: Could not save state file: ${err.message}`);
  }
}

// Load config file if specified or exists
let config = {
  mappings: {},
  defaultClient: '',
  defaultProject: '',
  hourlyRate: null,
  exports: {}  // Export profiles: { profileName: { repositories: [], output: '', format: '' } }
};

const configPaths = [
  options.config,
  path.join(scriptDir, 'config.json'),           // Same directory as script
  path.join(process.cwd(), 'config.json'),       // Current working directory
  path.join(os.homedir(), '.claude', 'time-tracking.json')  // User's .claude folder
].filter(Boolean);

for (const configPath of configPaths) {
  if (fs.existsSync(configPath)) {
    try {
      const configContent = fs.readFileSync(configPath, 'utf-8');
      config = { ...config, ...JSON.parse(configContent) };
      if (options.verbose) {
        console.log(`Loaded config from: ${configPath}`);
      }
      break;
    } catch (err) {
      console.warn(`Warning: Could not parse config file ${configPath}: ${err.message}`);
    }
  }
}

function normalizeProjectPath(projectPath) {
  if (!projectPath) return '';
  return path.normalize(projectPath.replace(/\\\\/g, '\\')).toLowerCase();
}

function getRepositoryName(projectPath) {
  if (!projectPath) return '';
  const normalized = path.normalize(projectPath.replace(/\\\\/g, '\\'));
  return path.basename(normalized);
}

function getMapping(repoName) {
  const mapping = config.mappings[repoName] || {};
  return {
    client: mapping.client || config.defaultClient || '',
    project: mapping.project || repoName,
  };
}

function formatDate(date) {
  if (!date || isNaN(date.getTime())) return '';
  return date.toISOString();
}

function formatDateOnly(date) {
  if (!date || isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
}

function formatLocalDate(date) {
  if (!date || isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString();
}

function calculateDurationMs(startMs, endMs) {
  if (!startMs || !endMs) return 0;
  return endMs - startMs;
}

function formatDurationHours(ms) {
  if (!ms) return '0';
  const hours = ms / 3600000;
  return hours.toFixed(2);
}

function formatDurationMinutes(ms) {
  if (!ms) return '0';
  return Math.round(ms / 60000).toString();
}

function formatDurationHuman(ms) {
  if (!ms) return '<1m';
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

/**
 * Create a summary description from session messages
 * Identifies work areas and action types to generate a clean summary
 */
function createDescription(messages, topics) {
  // Filter out empty messages and common non-descriptive ones
  const meaningfulMessages = messages.filter(m => {
    if (!m || m.length < 3) return false;
    const lower = m.toLowerCase().trim();
    if (['yes', 'no', 'ok', 'y', 'n', '1', '2', '3', '4', '5', 'all', 'done', 'good', 'great', 
         'thanks', 'perfect', 'continue', 'go ahead', 'sounds good', 'looks good',
         '/init', 'commit', 'push', 'moved it', 'that works'].includes(lower)) return false;
    if (lower.length < 10) return false;
    return true;
  });

  if (meaningfulMessages.length === 0) {
    return topics ? `Development: ${topics}` : 'Development work';
  }

  const allText = meaningfulMessages.join(' ').toLowerCase();
  
  // Detect primary action type
  const actionTypes = [];
  if (/\b(fix|fixed|fixing|bug|error|issue|problem|broken|not working|doesn't work)\b/i.test(allText)) {
    actionTypes.push('Bug fixes');
  }
  if (/\b(add|added|adding|implement|implemented|new feature|create|build)\b/i.test(allText)) {
    actionTypes.push('Feature development');
  }
  if (/\b(update|updated|updating|change|changed|modify|modified|improve)\b/i.test(allText)) {
    actionTypes.push('Updates');
  }
  if (/\b(refactor|refactored|cleanup|clean up|reorganize|restructure)\b/i.test(allText)) {
    actionTypes.push('Refactoring');
  }
  if (/\b(test|tests|testing|e2e|playwright|jest|spec)\b/i.test(allText)) {
    actionTypes.push('Testing');
  }
  if (/\b(deploy|deployed|deployment|ci|cd|pipeline|release)\b/i.test(allText)) {
    actionTypes.push('Deployment');
  }
  if (/\b(debug|debugging|investigate|troubleshoot|figure out)\b/i.test(allText)) {
    actionTypes.push('Debugging');
  }
  if (/\b(config|configure|setup|set up|setting|install)\b/i.test(allText)) {
    actionTypes.push('Configuration');
  }
  if (/\b(review|reviewed|pr |pull request|code review)\b/i.test(allText)) {
    actionTypes.push('Code review');
  }
  if (/\b(document|documentation|readme|docs)\b/i.test(allText)) {
    actionTypes.push('Documentation');
  }

  // Detect specific features/areas worked on
  const featureAreas = [];
  const featurePatterns = [
    { pattern: /\b(auth|authentication|login|logout|sign in|sign out|session|jwt|token)\b/gi, name: 'authentication' },
    { pattern: /\b(database|db|schema|migration|query|sql|postgres|table)\b/gi, name: 'database' },
    { pattern: /\b(api|endpoint|route|controller|rest|graphql)\b/gi, name: 'API' },
    { pattern: /\b(ui|component|page|form|modal|button|layout|style|css)\b/gi, name: 'UI' },
    { pattern: /\b(notification|notifications|email|alert|toast|bell)\b/gi, name: 'notifications' },
    { pattern: /\b(dashboard|report|chart|analytics|metrics)\b/gi, name: 'dashboard' },
    { pattern: /\b(user|users|account|profile|settings|preferences)\b/gi, name: 'user management' },
    { pattern: /\b(payment|billing|subscription|invoice|stripe|plaid)\b/gi, name: 'payments' },
    { pattern: /\b(import|export|sync|integration|webhook)\b/gi, name: 'data sync' },
    { pattern: /\b(transaction|transactions|account|accounts|balance)\b/gi, name: 'transactions' },
    { pattern: /\b(tax|taxes|deduction|income|expense)\b/gi, name: 'tax features' },
    { pattern: /\b(property|properties|real estate|rental)\b/gi, name: 'property management' },
    { pattern: /\b(file|files|upload|download|attachment)\b/gi, name: 'file handling' },
    { pattern: /\b(search|filter|sort|pagination)\b/gi, name: 'search/filter' },
    { pattern: /\b(navigation|routing|menu|sidebar|header)\b/gi, name: 'navigation' },
    { pattern: /\b(validation|validate|error handling|error message)\b/gi, name: 'validation' },
  ];

  for (const { pattern, name } of featurePatterns) {
    if (pattern.test(allText)) {
      featureAreas.push(name);
    }
  }

  // Build description
  let description = '';
  
  if (actionTypes.length > 0 && featureAreas.length > 0) {
    // Best case: we know both action and area
    const actions = actionTypes.slice(0, 2).join(' & ');
    const areas = featureAreas.slice(0, 3).join(', ');
    description = `${actions}: ${areas}`;
  } else if (actionTypes.length > 0) {
    // We know the action type but not specific area
    description = actionTypes.slice(0, 3).join(', ');
    if (topics && topics !== 'general') {
      description += ` (${topics})`;
    }
  } else if (featureAreas.length > 0) {
    // We know the area but not the action
    description = `Development: ${featureAreas.slice(0, 3).join(', ')}`;
  } else if (topics && topics !== 'general') {
    // Fall back to topics
    description = `Development: ${topics}`;
  } else {
    // Last resort: use first meaningful message
    let firstMsg = meaningfulMessages[0]
      .replace(/^(please|can you|could you|help me|i need to|i want to|let's|we need to|ok,?|so,?)\s+/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    firstMsg = firstMsg.charAt(0).toUpperCase() + firstMsg.slice(1);
    description = firstMsg.length > 80 ? firstMsg.substring(0, 77) + '...' : firstMsg;
  }

  return description;
}

/**
 * Extract potential topics/keywords from messages
 */
function extractTopics(messages) {
  const text = messages.join(' ').toLowerCase();
  
  const topicPatterns = [
    { pattern: /\b(fix|bug|error|issue|problem)\b/gi, topic: 'bug-fix' },
    { pattern: /\b(test|testing|spec|jest|playwright)\b/gi, topic: 'testing' },
    { pattern: /\b(refactor|cleanup|clean up)\b/gi, topic: 'refactoring' },
    { pattern: /\b(feature|implement|add|create|build)\b/gi, topic: 'feature' },
    { pattern: /\b(review|code review)\b/gi, topic: 'review' },
    { pattern: /\b(deploy|deployment|ci|cd|pipeline)\b/gi, topic: 'deployment' },
    { pattern: /\b(database|db|migration|schema)\b/gi, topic: 'database' },
    { pattern: /\b(api|endpoint|rest|graphql)\b/gi, topic: 'api' },
    { pattern: /\b(ui|frontend|component|react|css)\b/gi, topic: 'frontend' },
    { pattern: /\b(backend|server|service)\b/gi, topic: 'backend' },
    { pattern: /\b(doc|documentation|readme)\b/gi, topic: 'documentation' },
    { pattern: /\b(config|configuration|setup|init)\b/gi, topic: 'configuration' },
    { pattern: /\b(security|auth|authentication|authorization)\b/gi, topic: 'security' },
    { pattern: /\b(performance|optimize|optimization|speed)\b/gi, topic: 'performance' },
    { pattern: /\b(debug|debugging|investigate)\b/gi, topic: 'debugging' },
  ];
  
  const foundTopics = new Set();
  for (const { pattern, topic } of topicPatterns) {
    if (pattern.test(text)) {
      foundTopics.add(topic);
    }
  }
  
  return [...foundTopics].slice(0, 5).join(', ') || 'general';
}

function escapeCSV(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
  }
  return str;
}

function escapeTSV(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\t/g, ' ').replace(/\r?\n/g, ' ');
}

/**
 * Run a single export with the given options
 * @param {Object} exportOpts - Export options
 * @param {string} exportOpts.stateKey - Key for state tracking (e.g., 'profile:client-a' or '_all')
 * @param {string[]} exportOpts.repositories - Array of repository names to include (null = all or use repo option)
 * @param {string} exportOpts.repo - Single repository filter (alternative to repositories)
 * @param {string} exportOpts.output - Output filename
 * @param {string} exportOpts.format - Output format (csv, json, tsv)
 * @param {boolean} exportOpts.useNew - Whether to use --new filtering
 * @param {Date} exportOpts.from - Start date filter
 * @param {Date} exportOpts.to - End date filter
 * @param {boolean} exportOpts.all - Include all repositories
 * @param {boolean} exportOpts.verbose - Show verbose output
 * @param {string} exportOpts.label - Label for console output
 * @returns {Object} Export results { sessions: number, output: string, error: string|null }
 */
function runExport(exportOpts) {
  const {
    stateKey,
    repositories = null,
    repo = null,
    output = 'claude-sessions.csv',
    format = 'csv',
    useNew = false,
    from = null,
    to = null,
    all = false,
    verbose = false,
    label = null
  } = exportOpts;

  const labelPrefix = label ? `[${label}] ` : '';
  
  if (verbose) {
    console.log(`${labelPrefix}Running export...`);
    console.log(`${labelPrefix}State key: ${stateKey}`);
    if (repositories) console.log(`${labelPrefix}Repositories: ${repositories.join(', ')}`);
  }

  // Handle --new option: get last export time
  let lastExportTime = null;
  if (useNew) {
    lastExportTime = getLastExportTime(stateKey);
    if (lastExportTime) {
      console.log(`${labelPrefix}Since last export: ${formatLocalDate(new Date(lastExportTime))}`);
    } else if (verbose) {
      console.log(`${labelPrefix}No previous export found, exporting all matching sessions`);
    }
  }

  if (!fs.existsSync(historyFile)) {
    return { sessions: 0, output: null, error: 'History file not found' };
  }

  // Read and parse history.jsonl
  const content = fs.readFileSync(historyFile, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());

  // Parse all entries
  const entries = [];
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      if (entry.timestamp && entry.project) {
        // Apply date filters
        if (from && entry.timestamp < from.getTime()) continue;
        if (to && entry.timestamp > to.getTime()) continue;
        // Apply --new filter: only entries after last export
        if (lastExportTime && entry.timestamp <= lastExportTime) continue;

        entries.push({
          timestamp: entry.timestamp,
          project: entry.project,
          message: entry.display || '',
        });
      }
    } catch (err) {
      // Skip invalid lines
    }
  }

  // Filter entries by repositories or repo
  let filteredEntries;
  if (all && !repositories) {
    filteredEntries = entries;
  } else if (repositories && repositories.length > 0) {
    // Filter by multiple repositories
    const repoSet = new Set(repositories.map(r => r.toLowerCase()));
    filteredEntries = entries.filter(e => {
      const entryRepoName = getRepositoryName(e.project).toLowerCase();
      return repoSet.has(entryRepoName);
    });
  } else if (repo) {
    // Filter by single repo
    filteredEntries = entries.filter(e => {
      const entryRepoName = getRepositoryName(e.project).toLowerCase();
      return entryRepoName === repo.toLowerCase();
    });
  } else {
    filteredEntries = entries;
  }

  // Group entries into sessions
  const SESSION_GAP_MS = 30 * 60 * 1000;
  filteredEntries.sort((a, b) => a.timestamp - b.timestamp);

  const sessions = [];
  let currentSession = null;

  for (const entry of filteredEntries) {
    if (!currentSession) {
      currentSession = {
        project: entry.project,
        repositoryName: getRepositoryName(entry.project),
        startTime: entry.timestamp,
        endTime: entry.timestamp,
        messages: [entry.message],
      };
    } else if (entry.timestamp - currentSession.endTime > SESSION_GAP_MS || 
               normalizeProjectPath(entry.project) !== normalizeProjectPath(currentSession.project)) {
      sessions.push(currentSession);
      currentSession = {
        project: entry.project,
        repositoryName: getRepositoryName(entry.project),
        startTime: entry.timestamp,
        endTime: entry.timestamp,
        messages: [entry.message],
      };
    } else {
      currentSession.endTime = entry.timestamp;
      currentSession.messages.push(entry.message);
    }
  }

  if (currentSession) {
    sessions.push(currentSession);
  }

  // Sort by start time (most recent first)
  sessions.sort((a, b) => b.startTime - a.startTime);

  // Transform sessions to output format
  const outputData = sessions.map((s) => {
    const durationMs = calculateDurationMs(s.startTime, s.endTime);
    const mapping = getMapping(s.repositoryName);
    const topics = extractTopics(s.messages);
    
    return {
      startDate: formatDateOnly(new Date(s.startTime)),
      endDate: formatDateOnly(new Date(s.endTime)),
      client: mapping.client,
      project: mapping.project,
      repository: s.repositoryName,
      description: createDescription(s.messages, topics),
      startTime: formatDate(new Date(s.startTime)),
      endTime: formatDate(new Date(s.endTime)),
      durationHours: parseFloat(formatDurationHours(durationMs)),
      durationMinutes: parseInt(formatDurationMinutes(durationMs)),
      messageCount: s.messages.length,
      topics: topics,
      projectPath: s.project,
    };
  });

  // Generate output based on format
  let outputContent;
  const headers = ['Start Date', 'End Date', 'Client', 'Project', 'Repository', 'Description', 'Start Time', 'End Time', 'Duration (hours)', 'Duration (minutes)', 'Message Count', 'Topics', 'Project Path'];

  if (format === 'json') {
    outputContent = JSON.stringify(outputData, null, 2);
  } else if (format === 'tsv') {
    const rows = outputData.map(d => [
      d.startDate, d.endDate, d.client, d.project, d.repository, d.description,
      d.startTime, d.endTime, d.durationHours, d.durationMinutes,
      d.messageCount, d.topics, d.projectPath
    ].map(escapeTSV).join('\t'));
    outputContent = [headers.join('\t'), ...rows].join('\n');
  } else {
    // CSV (default)
    const rows = outputData.map(d => [
      d.startDate, d.endDate, d.client, d.project, d.repository, d.description,
      d.startTime, d.endTime, d.durationHours, d.durationMinutes,
      d.messageCount, d.topics, d.projectPath
    ].map(escapeCSV).join(','));
    outputContent = [headers.join(','), ...rows].join('\n');
  }

  // Write output
  fs.writeFileSync(output, outputContent);
  console.log(`${labelPrefix}Exported ${sessions.length} sessions to ${output} (${format.toUpperCase()})`);

  // Save export timestamp
  saveLastExportTime(stateKey, Date.now());

  return {
    sessions: sessions.length,
    output: output,
    error: null,
    data: outputData,
    rawSessions: sessions
  };
}

/**
 * Run a single export profile from config
 * @param {string} profileName - Name of the export profile
 * @param {Object} profileConfig - Profile configuration
 * @returns {Object} Export results
 */
function runExportProfile(profileName, profileConfig) {
  const {
    repositories = [],
    output = `${profileName}-sessions.csv`,
    format = 'csv'
  } = profileConfig;

  console.log(`\n=== Running export profile: ${profileName} ===`);
  console.log(`Repositories: ${repositories.length > 0 ? repositories.join(', ') : 'all'}`);
  console.log(`Output: ${output}`);

  return runExport({
    stateKey: `profile:${profileName}`,
    repositories: repositories.length > 0 ? repositories : null,
    output: output,
    format: format,
    useNew: options.new,
    from: options.from,
    to: options.to,
    all: repositories.length === 0,
    verbose: options.verbose,
    label: profileName
  });
}

/**
 * Run all export profiles defined in config
 * @returns {Object} Combined results from all profiles
 */
function runAllExportProfiles() {
  const profiles = config.exports || {};
  const profileNames = Object.keys(profiles);

  if (profileNames.length === 0) {
    console.error('No export profiles defined in config.');
    console.error('Add an "exports" section to your config.json with profile definitions.');
    process.exit(1);
  }

  console.log(`Running ${profileNames.length} export profile(s)...`);

  const results = {};
  let totalSessions = 0;

  for (const profileName of profileNames) {
    const result = runExportProfile(profileName, profiles[profileName]);
    results[profileName] = result;
    totalSessions += result.sessions;
  }

  console.log(`\n=== Export Summary ===`);
  console.log(`Total profiles: ${profileNames.length}`);
  console.log(`Total sessions: ${totalSessions}`);
  for (const [name, result] of Object.entries(results)) {
    console.log(`  ${name}: ${result.sessions} sessions -> ${result.output}`);
  }

  return results;
}

// Main execution
if (options.runExports) {
  // Run all export profiles
  runAllExportProfiles();
  process.exit(0);
}

if (options.exportProfile) {
  // Run a specific export profile
  const profiles = config.exports || {};
  const profileConfig = profiles[options.exportProfile];

  if (!profileConfig) {
    console.error(`Export profile '${options.exportProfile}' not found in config.`);
    const available = Object.keys(profiles);
    if (available.length > 0) {
      console.error(`Available profiles: ${available.join(', ')}`);
    } else {
      console.error('No export profiles defined in config.');
    }
    process.exit(1);
  }

  runExportProfile(options.exportProfile, profileConfig);
  process.exit(0);
}

// Legacy single-export mode (original behavior)
console.log('Parsing Claude Code history...');
console.log(`History file: ${historyFile}`);

// Determine the repo key for state tracking
const repoKey = options.all ? '_all' : (options.repo || getRepositoryName(options.project));

// Handle --new option: get last export time
let lastExportTime = null;
if (options.new) {
  lastExportTime = getLastExportTime(repoKey);
  if (lastExportTime) {
    const repoLabel = repoKey === '_all' ? 'all repositories' : `'${repoKey}'`;
    console.log(`Since last export (${repoLabel}): ${formatLocalDate(new Date(lastExportTime))}`);
  } else {
    console.log('No previous export found, exporting all matching sessions');
  }
}

if (options.from) console.log(`From: ${formatDateOnly(options.from)}`);
if (options.to) console.log(`To: ${formatDateOnly(options.to)}`);

if (!fs.existsSync(historyFile)) {
  console.error('History file not found. Have you used Claude Code before?');
  process.exit(1);
}

// Read and parse history.jsonl
const content = fs.readFileSync(historyFile, 'utf-8');
const lines = content.split('\n').filter(l => l.trim());

console.log(`Found ${lines.length} history entries`);

// Parse all entries
const entries = [];
for (const line of lines) {
  try {
    const entry = JSON.parse(line);
    if (entry.timestamp && entry.project) {
      // Apply date filters
      if (options.from && entry.timestamp < options.from.getTime()) continue;
      if (options.to && entry.timestamp > options.to.getTime()) continue;
      // Apply --new filter: only entries after last export
      if (lastExportTime && entry.timestamp <= lastExportTime) continue;

      entries.push({
        timestamp: entry.timestamp,
        project: entry.project,
        message: entry.display || '',
      });
    }
  } catch (err) {
    if (options.verbose) {
      console.error(`Failed to parse line: ${err.message}`);
    }
  }
}

console.log(`Parsed ${entries.length} valid entries (after date filter)`);

// Normalize current project path for comparison
const normalizedCurrentProject = normalizeProjectPath(options.project);

if (options.repo) {
  console.log(`Filtering for repository: ${options.repo}`);
} else if (options.verbose) {
  console.log(`\nFiltering for project: ${options.project}`);
  console.log(`Normalized: ${normalizedCurrentProject}`);
}

// Filter entries by project or repo name
const filteredEntries = options.all 
  ? entries 
  : entries.filter(e => {
      // If --repo specified, match by repo name
      if (options.repo) {
        const entryRepoName = getRepositoryName(e.project).toLowerCase();
        return entryRepoName === options.repo.toLowerCase();
      }
      // Otherwise match by full project path
      const normalizedEntryProject = normalizeProjectPath(e.project);
      return normalizedEntryProject === normalizedCurrentProject;
    });

console.log(`${filteredEntries.length} entries match the project filter`);

// Group entries into sessions
const SESSION_GAP_MS = 30 * 60 * 1000; // 30 minutes

// Sort entries by timestamp
filteredEntries.sort((a, b) => a.timestamp - b.timestamp);

const sessions = [];
let currentSession = null;

for (const entry of filteredEntries) {
  if (!currentSession) {
    currentSession = {
      project: entry.project,
      repositoryName: getRepositoryName(entry.project),
      startTime: entry.timestamp,
      endTime: entry.timestamp,
      messages: [entry.message],
    };
  } else if (entry.timestamp - currentSession.endTime > SESSION_GAP_MS || 
             normalizeProjectPath(entry.project) !== normalizeProjectPath(currentSession.project)) {
    sessions.push(currentSession);
    currentSession = {
      project: entry.project,
      repositoryName: getRepositoryName(entry.project),
      startTime: entry.timestamp,
      endTime: entry.timestamp,
      messages: [entry.message],
    };
  } else {
    currentSession.endTime = entry.timestamp;
    currentSession.messages.push(entry.message);
  }
}

if (currentSession) {
  sessions.push(currentSession);
}

// Sort by start time (most recent first)
sessions.sort((a, b) => b.startTime - a.startTime);

console.log(`\nIdentified ${sessions.length} sessions`);

// Transform sessions to output format
const outputData = sessions.map((s) => {
  const durationMs = calculateDurationMs(s.startTime, s.endTime);
  const mapping = getMapping(s.repositoryName);
  const topics = extractTopics(s.messages);
  
  return {
    startDate: formatDateOnly(new Date(s.startTime)),
    endDate: formatDateOnly(new Date(s.endTime)),
    client: mapping.client,
    project: mapping.project,
    repository: s.repositoryName,
    description: createDescription(s.messages, topics),
    startTime: formatDate(new Date(s.startTime)),
    endTime: formatDate(new Date(s.endTime)),
    durationHours: parseFloat(formatDurationHours(durationMs)),
    durationMinutes: parseInt(formatDurationMinutes(durationMs)),
    messageCount: s.messages.length,
    topics: topics,
    projectPath: s.project,
  };
});

// Generate output based on format
let output;
const headers = ['Start Date', 'End Date', 'Client', 'Project', 'Repository', 'Description', 'Start Time', 'End Time', 'Duration (hours)', 'Duration (minutes)', 'Message Count', 'Topics', 'Project Path'];

if (options.format === 'json') {
  output = JSON.stringify(outputData, null, 2);
} else if (options.format === 'tsv') {
  const rows = outputData.map(d => [
    d.startDate, d.endDate, d.client, d.project, d.repository, d.description,
    d.startTime, d.endTime, d.durationHours, d.durationMinutes,
    d.messageCount, d.topics, d.projectPath
  ].map(escapeTSV).join('\t'));
  output = [headers.join('\t'), ...rows].join('\n');
} else {
  // CSV (default)
  const rows = outputData.map(d => [
    d.startDate, d.endDate, d.client, d.project, d.repository, d.description,
    d.startTime, d.endTime, d.durationHours, d.durationMinutes,
    d.messageCount, d.topics, d.projectPath
  ].map(escapeCSV).join(','));
  output = [headers.join(','), ...rows].join('\n');
}

// Write output
fs.writeFileSync(options.output, output);
console.log(`\nExported ${sessions.length} sessions to ${options.output} (${options.format.toUpperCase()})`);

// Save export timestamp for --new option
saveLastExportTime(repoKey, Date.now());

// Print summary
if (sessions.length > 0) {
  console.log('\nRecent sessions (newest first):');
  outputData.slice(0, 10).forEach((s, i) => {
    const duration = formatDurationHuman(s.durationMinutes * 60000);
    const desc = s.description.length > 50 ? s.description.substring(0, 47) + '...' : s.description;
    console.log(`  ${i + 1}. ${s.startDate} | ${s.repository} | ${duration} | ${desc}`);
  });
  
  if (sessions.length > 10) {
    console.log(`  ... and ${sessions.length - 10} more`);
  }
  
  // Total stats
  const totalMessages = sessions.reduce((sum, s) => sum + s.messages.length, 0);
  const totalDurationMs = sessions.reduce((sum, s) => sum + calculateDurationMs(s.startTime, s.endTime), 0);
  const totalHours = (totalDurationMs / 3600000).toFixed(1);
  
  console.log(`\nTotal: ${sessions.length} sessions, ${totalMessages} messages, ${totalHours} hours tracked`);
  
  if (config.hourlyRate) {
    const totalBillable = (totalDurationMs / 3600000) * config.hourlyRate;
    console.log(`Billable amount: $${totalBillable.toFixed(2)} (at $${config.hourlyRate}/hr)`);
  }
  
  // Per-repository breakdown
  if (options.all) {
    console.log('\nBy repository:');
    const byRepo = {};
    for (const s of sessions) {
      if (!byRepo[s.repositoryName]) {
        byRepo[s.repositoryName] = { sessions: 0, messages: 0, durationMs: 0 };
      }
      byRepo[s.repositoryName].sessions++;
      byRepo[s.repositoryName].messages += s.messages.length;
      byRepo[s.repositoryName].durationMs += calculateDurationMs(s.startTime, s.endTime);
    }
    
    Object.entries(byRepo)
      .sort((a, b) => b[1].durationMs - a[1].durationMs)
      .forEach(([repo, stats]) => {
        const hours = (stats.durationMs / 3600000).toFixed(1);
        console.log(`  ${repo}: ${stats.sessions} sessions, ${stats.messages} msgs, ${hours}h`);
      });
  }
}
