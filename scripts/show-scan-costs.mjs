#!/usr/bin/env node
import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Locate SQLite database
function resolveDbPath() {
  if (process.env.DB_PATH && fs.existsSync(process.env.DB_PATH)) {
    return process.env.DB_PATH;
  }
  const candidates = [
    path.resolve(process.cwd(), 'apps/server/data/dossiers.db'),
    path.resolve(__dirname, '../apps/server/data/dossiers.db'),
    path.resolve(process.cwd(), 'data/dossiers.db'),
    path.resolve(__dirname, '../data/dossiers.db'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0];
}

const dbPath = resolveDbPath();
if (!fs.existsSync(dbPath)) {
  console.error(`\x1b[31m[ERROR] Database not found at: ${dbPath}\x1b[0m`);
  console.error('Run at least one scan to initialize the database.');
  process.exit(1);
}

const db = new DatabaseSync(dbPath);

const limitArg = parseInt(process.argv[2], 10);
const limit = isNaN(limitArg) || limitArg <= 0 ? 10 : limitArg;

// Fetch dossiers
const dossiers = db
  .prepare(
    `SELECT id, created_at, caste, biocarbon_ratio, honorific_title, headline
     FROM dossiers
     ORDER BY created_at DESC
     LIMIT ?`
  )
  .all(limit);

const logStmt = db.prepare(
  `SELECT id, call_type, provider, model, prompt_tokens, candidates_tokens, thoughts_tokens,
          total_tokens, cost_usd, duration_ms, status, error_message, created_at
   FROM scan_api_logs
   WHERE dossier_id = ?
   ORDER BY created_at ASC`
);

console.log('\n\x1b[1m\x1b[36m================================================================================================\x1b[0m');
console.log('\x1b[1m\x1b[35m                      ECOCIDE // SCAN COST AUDIT LOG                          \x1b[0m');
console.log('\x1b[1m\x1b[36m================================================================================================\x1b[0m');
console.log(`\x1b[90mDatabase:\x1b[0m ${dbPath}`);
console.log(`\x1b[90mAudit Timestamp:\x1b[0m ${new Date().toISOString()}`);
console.log(`\x1b[90mDisplaying latest \x1b[1m${dossiers.length}\x1b[0m\x1b[90m audit records...\x1b[0m\n`);

if (dossiers.length === 0) {
  console.log('\x1b[33mNo audit records found in database.\x1b[0m\n');
  process.exit(0);
}

let grandTotalCalls = 0;
let grandTotalCost = 0;
let grandTotalPromptTokens = 0;
let grandTotalOutputTokens = 0;
let grandTotalTokens = 0;
let grandTotalDurationMs = 0;

dossiers.forEach((dossier, idx) => {
  const logs = logStmt.all(dossier.id);
  const scanIndex = idx + 1;

  const scanTotalCost = logs.reduce((sum, l) => sum + (l.cost_usd || 0), 0);
  const scanPromptTokens = logs.reduce((sum, l) => sum + (l.prompt_tokens || 0), 0);
  const scanOutputTokens = logs.reduce((sum, l) => sum + (l.candidates_tokens || 0), 0);
  const scanTotalTokens = logs.reduce((sum, l) => sum + (l.total_tokens || 0), 0);
  const scanDurationMs = logs.reduce((sum, l) => sum + (l.duration_ms || 0), 0);

  grandTotalCalls += logs.length;
  grandTotalCost += scanTotalCost;
  grandTotalPromptTokens += scanPromptTokens;
  grandTotalOutputTokens += scanOutputTokens;
  grandTotalTokens += scanTotalTokens;
  grandTotalDurationMs += scanDurationMs;

  const dateFormatted = new Date(dossier.created_at).toLocaleString();

  console.log(`\x1b[1m\x1b[33m[${scanIndex}]\x1b[0m \x1b[1mSCAN ID:\x1b[0m \x1b[36m${dossier.id}\x1b[0m  |  \x1b[90m${dateFormatted} (${dossier.created_at})\x1b[0m`);
  console.log(`    \x1b[90mSubject:\x1b[0m \x1b[1m${dossier.honorific_title}\x1b[0m`);
  console.log(
    `    \x1b[90mTier:\x1b[0m \x1b[35m${dossier.caste.toUpperCase()}\x1b[0m  |  \x1b[90mSustainability Index:\x1b[0m \x1b[32m${dossier.biocarbon_ratio}%\x1b[0m`
  );

  console.log('    \x1b[90m' + '─'.repeat(88) + '\x1b[0m');
  console.log(
    '    \x1b[1m\x1b[37m' +
      'CALL TYPE'.padEnd(19) +
      'MODEL'.padEnd(25) +
      'LATENCY'.padStart(10) +
      'PROMPT'.padStart(9) +
      'OUTPUT'.padStart(9) +
      'TOTAL'.padStart(8) +
      'COST (USD)'.padStart(12) +
      '\x1b[0m'
  );
  console.log('    \x1b[90m' + '─'.repeat(88) + '\x1b[0m');

  if (logs.length === 0) {
    console.log('    \x1b[90m(No individual API call logs recorded for this audit)\x1b[0m');
  } else {
    for (const log of logs) {
      const typeStr = log.call_type;
      const modelStr = log.model;
      const latencyStr = `${log.duration_ms.toLocaleString()}ms`;
      const promptStr = log.prompt_tokens.toLocaleString();
      const outputStr = (log.candidates_tokens + (log.thoughts_tokens || 0)).toLocaleString();
      const totalStr = log.total_tokens.toLocaleString();
      const costStr = `$${log.cost_usd.toFixed(6)}`;

      const statusColor = log.status === 'error' ? '\x1b[31m' : '\x1b[0m';
      console.log(
        `    ${statusColor}` +
          typeStr.padEnd(19) +
          modelStr.padEnd(25) +
          latencyStr.padStart(10) +
          promptStr.padStart(9) +
          outputStr.padStart(9) +
          totalStr.padStart(8) +
          costStr.padStart(12) +
          `\x1b[0m`
      );
      if (log.error_message) {
        console.log(`      \x1b[31m└─ Error: ${log.error_message}\x1b[0m`);
      }
    }
  }

  console.log('    \x1b[90m' + '─'.repeat(88) + '\x1b[0m');
  const scanCostStr = `$${scanTotalCost.toFixed(6)}`;
  console.log(
    `    \x1b[1m\x1b[32mSCAN TOTAL:\x1b[0m        ` +
      `${logs.length} API call${logs.length === 1 ? '' : 's'}`.padEnd(25) +
      `${scanDurationMs.toLocaleString()}ms`.padStart(10) +
      `${scanPromptTokens.toLocaleString()}`.padStart(9) +
      `${scanOutputTokens.toLocaleString()}`.padStart(9) +
      `${scanTotalTokens.toLocaleString()}`.padStart(8) +
      `  \x1b[1m\x1b[33m${scanCostStr.padStart(10)}\x1b[0m`
  );
  console.log('');
});

// Grand total summary
console.log('\x1b[1m\x1b[36m================================================================================================\x1b[0m');
console.log('\x1b[1m\x1b[35m                                    AUDIT SUMMARY STATISTICS                                     \x1b[0m');
console.log('\x1b[1m\x1b[36m================================================================================================\x1b[0m');
console.log(`  \x1b[1mScans Audited:\x1b[0m       ${dossiers.length}`);
console.log(`  \x1b[1mTotal API Calls:\x1b[0m     ${grandTotalCalls}`);
console.log(
  `  \x1b[1mTotal Tokens:\x1b[0m        ${grandTotalTokens.toLocaleString()} ` +
    `\x1b[90m(Prompt: ${grandTotalPromptTokens.toLocaleString()} | Output: ${grandTotalOutputTokens.toLocaleString()})\x1b[0m`
);
console.log(`  \x1b[1mTotal Duration:\x1b[0m      ${(grandTotalDurationMs / 1000).toFixed(2)}s`);
console.log(`  \x1b[1mGrand Total Cost:\x1b[0m    \x1b[1m\x1b[32m$${grandTotalCost.toFixed(6)} USD\x1b[0m`);
const avgCost = dossiers.length > 0 ? grandTotalCost / dossiers.length : 0;
console.log(`  \x1b[1mAverage Cost / Scan:\x1b[0m \x1b[1m\x1b[33m$${avgCost.toFixed(6)} USD\x1b[0m`);
console.log('\x1b[1m\x1b[36m================================================================================================\x1b[0m\n');
