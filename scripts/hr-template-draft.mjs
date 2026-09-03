// Post a reusable HR announcement template to HR Drafts.
// Usage: node hr-template-draft.mjs <birthday|last-filing> [--dry-run]
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKSPACE = join(__dirname, '..');
const HR_DRAFTS = '-1003702195046';
const SEND_SCRIPT = join(__dirname, 'hr-send.mjs');

function manilaMonthYear() {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila', month: 'long', year: 'numeric',
  }).format(new Date());
}

function manilaMonth() {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila', month: 'long',
  }).format(new Date());
}

function birthdayTemplate() {
  const monthYear = manilaMonthYear();
  const month = manilaMonth();
  return [
    `Birthday Gift Certificate Claim – ${monthYear}`,
    '',
    'Dear All,',
    '',
    `Employees celebrating their birthday in ${month} may now claim their [GIFT CERTIFICATE / BENEFIT] worth [AMOUNT].`,
    '',
    'Please visit [CLAIMING DEPARTMENT / LOCATION] during [CLAIMING HOURS] on [WORKING DAYS], starting [CLAIM START DATE].',
    '',
    'Deadline to claim: [CLAIM DEADLINE].',
    '',
    'Please note that unclaimed gift certificates after the stated deadline will be [UNCLAIMED BENEFIT POLICY].',
    '',
    'Happy Birthday, and enjoy your treat!',
    '',
    'Sincerely,',
    '[HR DEPARTMENT]',
    '[COMPANY NAME]',
  ].join('\n');
}

const LAST_FILING_TEMPLATE = [
  'Vacation Leave Filing Deadline',
  '',
  'Dear Colleagues,',
  '',
  'To ensure accurate computation of vacation leave balances, kindly file and submit the following leave requests to [HR DEPARTMENT / SYSTEM] no later than [FILING DEADLINE]:',
  '',
  '• Vacation leave to be taken until [CURRENT-YEAR LEAVE END DATE].',
  '• Carry-over vacation leave to be taken from [CURRENT YEAR] to [NEXT YEAR].',
  '',
  'Key Guidelines for Carry-Over Vacation Leave:',
  '',
  '1. Maximum Carry-Over Limit',
  '[MAXIMUM CARRY-OVER LIMIT].',
  '',
  '2. Conditions',
  '• Carry-over requests must be submitted before [CARRY-OVER REQUEST DEADLINE].',
  '• Carry-over leave must be used by or before [CARRY-OVER USE DEADLINE].',
  '• [CANCELLATION / LEAVE ENCASHMENT POLICY].',
  '• [OPERATIONAL-NEEDS CANCELLATION POLICY].',
  '• [LEAVE-DEDUCTION ORDER POLICY].',
  '• Follow the leave-request process through [LEAVE SYSTEM / APPROVAL PROCESS].',
  '',
  'For questions or clarifications, please contact [HR DEPARTMENT / CONTACT PERSON].',
  '',
  'Thank you and best regards,',
  '[HR DEPARTMENT]',
  '[COMPANY NAME]',
].join('\n');

const workflows = {
  birthday: {
    statePath: join(WORKSPACE, 'state', 'hr-birthday.json'),
    template: birthdayTemplate,
    callback: 'compose_birthday_draft',
  },
  'last-filing': {
    statePath: join(WORKSPACE, 'state', 'hr-last-filing.json'),
    template: () => LAST_FILING_TEMPLATE,
    callback: 'compose_last_filing_draft',
  },
};

const [workflowKey] = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const dryRun = process.argv.includes('--dry-run');
const workflow = workflows[workflowKey];
if (!workflow) {
  process.stderr.write('Usage: node hr-template-draft.mjs <birthday|last-filing> [--dry-run]\n');
  process.exit(2);
}

const payload = {
  target: HR_DRAFTS,
  text: workflow.template(),
  buttons: [{ label: 'Compose Draft', value: workflow.callback }],
};

if (dryRun) {
  process.stdout.write(JSON.stringify({ ok: true, dryRun: true, payload }) + '\n');
  process.exit(0);
}

const currentState = JSON.parse(readFileSync(workflow.statePath, 'utf8').replace(/^\uFEFF/, ''));
writeFileSync(workflow.statePath, JSON.stringify({ ...currentState, draft: null, awaitingEdit: false }, null, 2) + '\n', 'utf8');

const outboxPath = join(WORKSPACE, 'state', 'outbox.json');
writeFileSync(outboxPath, JSON.stringify(payload) + '\n', 'utf8');

const result = spawnSync(process.execPath, [SEND_SCRIPT], { encoding: 'utf8', timeout: 60000 });
if (result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout || `Template send failed (exit ${result.status}).`);
  process.exit(result.status || 1);
}
process.stdout.write(result.stdout);
