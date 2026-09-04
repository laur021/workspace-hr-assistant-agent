// Monthly Philippine public-holiday advisory.
//   node hr-holiday-check.mjs --report  -> fetch only, print JSON
//   node hr-holiday-check.mjs            -> send the monthly HR Drafts advisory
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DIR = dirname(fileURLToPath(import.meta.url));
const WORKSPACE = join(DIR, '..');
const STATE_PATH = join(WORKSPACE, 'state', 'hr-holidays.json');
const OUTBOX_PATH = join(WORKSPACE, 'state', 'outbox.json');
const SEND_SCRIPT = join(WORKSPACE, 'scripts', 'hr-send.mjs');
const HR_DRAFTS = '-5201015104';

function manilaNow() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
}

function readState() {
  try { return JSON.parse(readFileSync(STATE_PATH, 'utf8').replace(/^\uFEFF/, '')); }
  catch { return { lastSentMonth: null, lastSentAt: null, latestReport: null, draft: null, awaitingEdit: false }; }
}

function writeState(state) {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + '\n', 'utf8');
}

function formatDate(date) {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  }).format(new Date(`${date}T12:00:00+08:00`));
}

function buildAdvisory(report) {
  const lines = [
    `🇵🇭 Philippine Public Holidays — ${report.monthLabel}`,
    '',
    'The following national public holiday information is provided for HR planning and review:',
    '',
  ];
  if (report.holidays.length) {
    for (const holiday of report.holidays) {
      const type = holiday.types?.length ? ` (${holiday.types.join(', ')})` : '';
      lines.push(`• ${formatDate(holiday.date)} — ${holiday.name}${type}`);
    }
  } else {
    lines.push('• No national public holidays are listed for this month by the data source.');
  }
  lines.push(
    '',
    'Please confirm any work schedule, staffing, payroll, and office-operating arrangements through the appropriate HR and management process.',
    '',
    'Would you like to compose an employee announcement?'
  );
  return lines.join('\n');
}

async function getReport() {
  const now = manilaNow();
  const year = Number(now.year);
  const month = Number(now.month);
  const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/PH`;
  const response = await fetch(url, { headers: { 'user-agent': 'AblazeHRAssistantBot/1.0' } });
  if (!response.ok) throw new Error(`holiday data request failed (${response.status})`);
  const all = await response.json();
  const monthKey = `${now.year}-${now.month}`;
  const holidays = all
    .filter((holiday) => String(holiday.date).startsWith(`${now.year}-${now.month}-`))
    .map((holiday) => ({ date: holiday.date, name: holiday.name || holiday.localName, localName: holiday.localName, types: holiday.types || [] }));
  const monthLabel = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', month: 'long', year: 'numeric' })
    .format(new Date(`${now.year}-${now.month}-01T12:00:00+08:00`));
  return { country: 'PH', timezone: 'Asia/Manila', year, month, monthKey, monthLabel, fetchedAt: new Date().toISOString(), source: url, holidays };
}

function sendOutbox(payload) {
  writeFileSync(OUTBOX_PATH, JSON.stringify(payload) + '\n', 'utf8');
  const res = spawnSync(process.execPath, [SEND_SCRIPT], { encoding: 'utf8', timeout: 45000, windowsHide: true });
  if (res.status !== 0) throw new Error(res.stderr || res.stdout || 'holiday advisory send failed');
}

const report = await getReport();
if (process.argv.includes('--report')) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const state = readState();
  if (state.lastSentMonth === report.monthKey) {
  console.log(JSON.stringify({ sent: false, reason: 'already-sent-this-month', report }));
  } else {
    sendOutbox({ target: HR_DRAFTS, text: buildAdvisory(report), buttons: [{ label: 'Compose Draft', value: 'compose_holiday_draft' }] });
    state.lastSentMonth = report.monthKey;
    state.lastSentAt = new Date().toISOString();
    state.latestReport = report;
    state.draft = null;
    state.awaitingEdit = false;
    writeState(state);
    console.log(JSON.stringify({ sent: true, report }));
  }
}
