// scripts/hr-send.mjs
// Send a Telegram message with inline buttons — robust, no shell quoting.
// Usage: node hr-send.mjs [payloadPath] [--dry-run]
// Default payload path: state/outbox.json
// Payload shape:
//   { "target": "-5368977850", "text": "...",
//     "buttons": [{ "label": "Compose a draft", "value": "compose_draft" }, ...],
//     "replyTo": <messageId|null> }
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKSPACE = join(__dirname, '..');
const OPENCLAW_CLI = 'C:\\Users\\markmb\\AppData\\Roaming\\npm\\node_modules\\openclaw\\openclaw.mjs';
const DEFAULT_PAYLOAD = join(WORKSPACE, 'state', 'outbox.json');

function main() {
  const argsIn = process.argv.slice(2);
  const dryRun = argsIn.includes('--dry-run');
  const path = argsIn.find((a) => !a.startsWith('--')) || DEFAULT_PAYLOAD;

  const payload = JSON.parse(readFileSync(path, 'utf8'));
  const { target, text, buttons, replyTo } = payload;

  const cliArgs = [
    OPENCLAW_CLI, 'message', 'send',
    '--channel', 'telegram',
    '--account', 'hr-assistant',
    '--target', String(target),
    '--message', text,
    '--json',
  ];
  if (buttons && buttons.length) {
    const presentation = JSON.stringify({
      blocks: [{
        type: 'buttons',
        // Use a plain callback value, not an `action` object.  OpenClaw encodes
        // action objects as plugin-owned opaque callbacks; without a registered
        // interactive handler, those are intentionally rejected as unavailable.
        // Plain values are delivered to the HR agent as `callback_data: <value>`.
        buttons: buttons.map((b) => ({ label: b.label, value: b.value })),
      }],
    });
    cliArgs.push('--presentation', presentation);
  }
  if (replyTo) cliArgs.push('--reply-to', String(replyTo));
  if (dryRun) cliArgs.push('--dry-run');

  const res = spawnSync(process.execPath, cliArgs, { encoding: 'utf8', timeout: 45000 });
  const out = (res.stdout || '').trim();
  const err = (res.stderr || '').trim();
  if (res.status !== 0) {
    process.stderr.write(JSON.stringify({ ok: false, error: `send failed (exit ${res.status}): ${err || out}` }));
    process.exit(1);
  }
  let messageId = null;
  try {
    const j = JSON.parse(out);
    messageId = j.messageId ?? j.id ?? j?.result?.messageId ?? j?.result?.id ?? null;
  } catch { /* keep raw */ }

  console.log(JSON.stringify({ ok: true, dryRun, messageId, raw: out }));
}

main();
