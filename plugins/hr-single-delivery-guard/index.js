import { readFileSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { definePluginEntry } from 'openclaw/plugin-sdk/plugin-entry';

const HR_DRAFTS_SESSION = 'agent:hr-assistant-agent:telegram:group:-1003702195046';
const WORKSPACE = 'C:\\Users\\markmb\\.openclaw\\workspace-hr-assistant-agent';
const WEATHER_SCRIPT = `${WORKSPACE}\\scripts\\hr-weather-check.mjs`;
const HOLIDAY_SCRIPT = `${WORKSPACE}\\scripts\\hr-holiday-check.mjs`;
const SEND_SCRIPT = `${WORKSPACE}\\scripts\\hr-send.mjs`;
const OUTBOX_PATH = `${WORKSPACE}\\state\\outbox.json`;
const STATE_PATH = `${WORKSPACE}\\state\\hr-weather.json`;
const HOLIDAY_STATE_PATH = `${WORKSPACE}\\state\\hr-holidays.json`;
const EARTHQUAKE_STATE_PATH = `${WORKSPACE}\\state\\hr-earthquake.json`;
const MAINTENANCE_STATE_PATH = `${WORKSPACE}\\state\\hr-maintenance.json`;
const IBM_GENERATOR_STATE_PATH = `${WORKSPACE}\\state\\hr-ibm-generator.json`;
const VENDO_LOADING_STATE_PATH = `${WORKSPACE}\\state\\hr-vendo-loading.json`;
const APE_STATE_PATH = `${WORKSPACE}\\state\\hr-ape.json`;
const FLU_STATE_PATH = `${WORKSPACE}\\state\\hr-flu.json`;
const BIRTHDAY_STATE_PATH = `${WORKSPACE}\\state\\hr-birthday.json`;
const LAST_FILING_STATE_PATH = `${WORKSPACE}\\state\\hr-last-filing.json`;
const ANNOUNCEMENT_STATE_PATH = `${WORKSPACE}\\state\\hr-announcement.json`;
const HR_DRAFTS = '-1003702195046';
const ABC_EMPLOYEES = '-1004452958432';

const EARTHQUAKE_ANNOUNCEMENT_TEMPLATE = [
  'Earthquake Drill Advisory',
  '',
  'Dear Colleagues,',
  '',
  'Please be informed that an earthquake drill is scheduled for [DATE] at [TIME].',
  '',
  'We would like to remind all drill participants of the following key points:',
  '',
  '• Elevators will be unavailable from [START TIME] to [END TIME].',
  '• When the alarm sounds, proceed calmly to the nearest emergency exit and use the stairs to reach the ground floor.',
  '• After reaching the ground floor, exit the building and proceed to the designated evacuation area: [EVACUATION AREA].',
  '• Follow the instructions of the assigned safety marshals, building management, or emergency-response organizers while in the evacuation area.',
  '• Return to work only after the drill has concluded and clearance has been given. Elevators will resume operation when safe to do so.',
  '',
  'Department leaders will receive the appropriate signage. Please ensure that participating team members carry the signage when proceeding to the evacuation area.',
  '',
  'Your support and cooperation are greatly appreciated as we continue to prioritize safety and preparedness in the workplace.',
  '',
  'For questions or clarifications, please contact [CONTACT PERSON / DEPARTMENT].',
  '',
  'Thank you and best regards,',
  'HR Department',
].join('\n');

const MAINTENANCE_ANNOUNCEMENT_TEMPLATE = [
  'Annual Electrical Preventive Maintenance Advisory',
  '',
  'Hi Everyone,',
  '',
  'This is to inform you that [BUILDING / LOCATION] will be conducting its Annual Electrical Preventive Maintenance on [DATE], from [START TIME] to [END TIME].',
  '',
  'Please be guided by the following schedule:',
  '',
  '[START TIME] – [SHUTDOWN END TIME] ([DURATION]) — TOTAL POWER SHUTDOWN',
  '• No electricity in [AFFECTED AREAS].',
  '• [ELEVATOR AVAILABILITY / OPERATIONAL STATUS].',
  '',
  '[GENERATOR START TIME] – [GENERATOR END TIME] — GENERATOR POWER SUPPLY',
  '• Electricity will be supplied by [BACKUP POWER SOURCE] in [COVERED AREAS].',
  '',
  '[TRANSFER START TIME] – [TRANSFER END TIME] — MINOR POWER FLUCTUATIONS EXPECTED',
  '• Minor power fluctuations may occur during the transfer from [BACKUP POWER SOURCE] to [UTILITY / MAIN POWER SUPPLY].',
  '',
  'For further details, please refer to [REFERENCE DOCUMENT / CIRCULAR] or contact [CONTACT PERSON / DEPARTMENT].',
  '',
  'Thank you for your kind attention and cooperation.',
  '',
  'Best Regards,',
  '[SENDER / DEPARTMENT]',
].join('\n');

const IBM_GENERATOR_ANNOUNCEMENT_TEMPLATE = [
  'Generator Load Testing Advisory',
  '',
  'Hi Everyone,',
  '',
  'This is a gentle reminder regarding the scheduled Generator Load Testing at [BUILDING / LOCATION] on [DAY, DATE].',
  'For full details, please refer to the email below and the attached [REFERENCE DOCUMENT / MEMO] issued by [BUILDING ADMINISTRATION / ISSUING DEPARTMENT].',
  '',
  'Thank you for your understanding and cooperation.',
  '',
  'Thank you and Best Regards,',
  '[SENDER / DEPARTMENT]',
].join('\n');

const VENDO_LOADING_ANNOUNCEMENT_TEMPLATE = [
  'Vendo Points Allocation Notice',
  '',
  'Dear Team,',
  '',
  'This is to inform everyone that the vendo points allocation for [MONTH YEAR] has been successfully reloaded.',
  '',
  'Your updated points should now be available for use. If you experience any issue or believe your points were not updated correctly, please contact [HR / ADMIN CONTACT].',
  '',
  'Thank you.',
  '',
  'Best regards,',
  '[HR DEPARTMENT]',
  '[COMPANY NAME]',
].join('\n');

const APE_ANNOUNCEMENT_TEMPLATE = [
  'Annual Physical Examination (APE) Reminders',
  '',
  'Dear Colleagues,',
  '',
  'Please be reminded of the following guidelines for employees scheduled for the Annual Physical Examination (APE) on [APE DATE]:',
  '',
  '1. [MASK / HEALTH-SAFETY REQUIREMENT].',
  '2. [COMPANION / CLINIC ACCESS POLICY].',
  '3. [CLINIC QUEUING OR APPOINTMENT PROCEDURE].',
  '4. Fasting requirements for blood extraction: [FASTING DURATION] before [BLOOD EXTRACTION TIME]. Please arrive [ARRIVAL LEAD TIME] before the scheduled extraction time for processing and to avoid over-fasting.',
  '',
  'Example schedule:',
  '[LAST MEAL TIME] — Last meal: [MEAL GUIDANCE].',
  '[FASTING PERIOD] — [FASTING INSTRUCTIONS].',
  '[ARRIVAL / PROCESSING TIME] — Arrival at [CLINIC / VENUE] for processing.',
  '[BLOOD EXTRACTION TIME] — Blood extraction.',
  '',
  '5. For female employees on menstruation: [URINALYSIS GUIDANCE].',
  '6. Returning patients with pending requirements must [COMPLETION-FORM / PENDING-REQUIREMENT INSTRUCTIONS]. All laboratory tests must be completed within [COMPLETION PERIOD].',
  '7. Bring [NUMBER] valid identification document(s), including [ACCEPTED ID TYPES].',
  '8. Stool examination:',
  '   • [STOOL CONTAINER DISTRIBUTION DETAILS].',
  '   • Sample size: [SAMPLE SIZE].',
  '   • Submit the specimen to [SUBMISSION LOCATION] within [SUBMISSION WINDOW] of collection.',
  '   • Use the [COLLECTION TOOL] provided inside the container. Avoid contamination with [CONTAMINATION RESTRICTIONS].',
  '9. Paperless registration: [REGISTRATION INSTRUCTIONS]. Bring a mobile device for registration via [REGISTRATION METHOD] at [REGISTRATION LOCATION]. [WI-FI / CONNECTIVITY INSTRUCTIONS].',
  '',
  'Kindly follow the schedule assigned by your department leaders or managers.',
  'For questions or clarifications, please contact [CONTACT PERSON / DEPARTMENT].',
  '',
  'Thank you and best regards,',
  '[HR DEPARTMENT]',
  '[COMPANY NAME]',
].join('\n');

const FLU_ANNOUNCEMENT_TEMPLATE = [
  'Flu Vaccine Drive Advisory',
  '',
  'Dear Colleagues,',
  '',
  'This is a friendly reminder that [COMPANY / ORGANIZATION] will conduct a Flu Vaccine Drive on [DAY, DATE], from [START TIME] to [END TIME], at [VENUE / LOCATION].',
  'Employees who pre-registered may visit within the stated schedule. [APPOINTMENT / WALK-IN INSTRUCTIONS]. Kindly bring [REQUIRED IDENTIFICATION / ENTRY REQUIREMENTS].',
  '',
  'What to expect after receiving the flu vaccine:',
  '• Most people experience no side effects. Any side effects are usually mild and resolve within a few days.',
  '• A sore arm, low-grade fever, headache, or mild tiredness may occur.',
  '',
  'Important reminders:',
  '• [PREGNANCY / ELIGIBILITY GUIDANCE].',
  '• [ALLERGY / MEDICAL-ELIGIBILITY GUIDANCE].',
  '• Employees who can no longer attend should coordinate with [CONTACT PERSON / DEPARTMENT] regarding [RESCHEDULING / ALTERNATIVE ARRANGEMENTS].',
  '',
  'Thank you for your cooperation.',
  '',
  'Best regards,',
  '[HR DEPARTMENT]',
  '[COMPANY NAME]',
].join('\n');

function currentManilaMonthYear() {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
}

function buildBirthdayAnnouncementTemplate() {
  const monthYear = currentManilaMonthYear();
  const month = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    month: 'long',
  }).format(new Date());
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

const LAST_FILING_ANNOUNCEMENT_TEMPLATE = [
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

function prettyNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 10) / 10 : 0;
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${dateString}T12:00:00+08:00`));
}

function forecastDescription(code) {
  if ([95, 96, 99].includes(Number(code))) return 'thunderstorms';
  if ([80, 81, 82].includes(Number(code))) return 'rain showers';
  if ([61, 63, 65].includes(Number(code))) return 'rain';
  return 'unsettled weather';
}

function readWorkflowState() {
  // PowerShell writes may prepend a UTF-8 BOM. JSON.parse does not accept it,
  // so normalize it at the workflow boundary rather than failing after an
  // advisory has already been delivered.
  return JSON.parse(readFileSync(STATE_PATH, 'utf8').replace(/^\uFEFF/, ''));
}

function writeWorkflowState(state) {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + '\n', 'utf8');
}

function readHolidayState() {
  return JSON.parse(readFileSync(HOLIDAY_STATE_PATH, 'utf8').replace(/^\uFEFF/, ''));
}

function writeHolidayState(state) {
  writeFileSync(HOLIDAY_STATE_PATH, JSON.stringify(state, null, 2) + '\n', 'utf8');
}

function readEarthquakeState() {
  try {
    return JSON.parse(readFileSync(EARTHQUAKE_STATE_PATH, 'utf8').replace(/^\uFEFF/, ''));
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    return { draft: null, awaitingEdit: false };
  }
}

function writeEarthquakeState(state) {
  writeFileSync(EARTHQUAKE_STATE_PATH, JSON.stringify(state, null, 2) + '\n', 'utf8');
}

function readMaintenanceState() {
  try {
    return JSON.parse(readFileSync(MAINTENANCE_STATE_PATH, 'utf8').replace(/^\uFEFF/, ''));
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    return { draft: null, awaitingEdit: false };
  }
}

function writeMaintenanceState(state) {
  writeFileSync(MAINTENANCE_STATE_PATH, JSON.stringify(state, null, 2) + '\n', 'utf8');
}

function readIbmGeneratorState() {
  try {
    return JSON.parse(readFileSync(IBM_GENERATOR_STATE_PATH, 'utf8').replace(/^\uFEFF/, ''));
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    return { draft: null, awaitingEdit: false };
  }
}

function writeIbmGeneratorState(state) {
  writeFileSync(IBM_GENERATOR_STATE_PATH, JSON.stringify(state, null, 2) + '\n', 'utf8');
}

function readVendoLoadingState() {
  try {
    return JSON.parse(readFileSync(VENDO_LOADING_STATE_PATH, 'utf8').replace(/^\uFEFF/, ''));
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    return { draft: null, awaitingEdit: false };
  }
}

function writeVendoLoadingState(state) {
  writeFileSync(VENDO_LOADING_STATE_PATH, JSON.stringify(state, null, 2) + '\n', 'utf8');
}

function readApeState() {
  try {
    return JSON.parse(readFileSync(APE_STATE_PATH, 'utf8').replace(/^\uFEFF/, ''));
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    return { draft: null, awaitingEdit: false };
  }
}

function writeApeState(state) {
  writeFileSync(APE_STATE_PATH, JSON.stringify(state, null, 2) + '\n', 'utf8');
}

function readDraftWorkflowState(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    return { draft: null, awaitingEdit: false };
  }
}

function writeDraftWorkflowState(path, state) {
  writeFileSync(path, JSON.stringify(state, null, 2) + '\n', 'utf8');
}

const DRAFT_WORKFLOWS = {
  flu: {
    statePath: FLU_STATE_PATH,
    template: () => FLU_ANNOUNCEMENT_TEMPLATE,
    callbacks: { compose: 'compose_flu_draft', send: 'send_flu_employees', edit: 'edit_flu', discard: 'discard_flu' },
  },
  birthday: {
    statePath: BIRTHDAY_STATE_PATH,
    template: buildBirthdayAnnouncementTemplate,
    callbacks: { compose: 'compose_birthday_draft', send: 'send_birthday_employees', edit: 'edit_birthday', discard: 'discard_birthday' },
  },
  lastFiling: {
    statePath: LAST_FILING_STATE_PATH,
    template: () => LAST_FILING_ANNOUNCEMENT_TEMPLATE,
    callbacks: { compose: 'compose_last_filing_draft', send: 'send_last_filing_employees', edit: 'edit_last_filing', discard: 'discard_last_filing' },
  },
  announcement: {
    statePath: ANNOUNCEMENT_STATE_PATH,
    template: null,
    callbacks: { compose: 'compose_announcement_draft', send: 'send_announcement_employees', edit: 'edit_announcement', discard: 'discard_announcement' },
  },
};

async function sendOutbox(text, buttons = []) {
  writeFileSync(OUTBOX_PATH, JSON.stringify({
    target: HR_DRAFTS,
    text,
    buttons,
  }) + '\n', 'utf8');
  await runNode(SEND_SCRIPT);
}

function normalizeRevision(text) {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/^\s*(?:subject|advisory)\s*:\s*/i, '')
    .replace(/^\s*regards\s*,\s*$/im, 'Regards,')
    .trim();
}

function buildAdvisory(weather) {
  const current = weather.current;
  const forecast = weather.forecast;
  const condition = String(current.condition || 'Unsettled weather');
  const forecastText = forecastDescription(forecast.today_code);
  const wind = prettyNumber(current.wind_kmh);
  const gust = prettyNumber(current.gust_kmh);
  const maxGust = prettyNumber(forecast.gust_max_kmh);
  const temp = prettyNumber(current.temp_c);
  const feels = prettyNumber(current.apparent_c);
  const humidity = prettyNumber(current.humidity_pct);
  const rain = prettyNumber(forecast.precip_today_mm);
  const high = prettyNumber(forecast.temp_max_c);
  const low = prettyNumber(forecast.temp_min_c);
  const severe = Number(weather.severity) >= 3;
  const recommendation = severe
    ? 'Work from home where possible; non-essential travel discouraged; dress down in casual, safe attire'
    : String(weather.recommendation || 'Take appropriate precautions when travelling.');
  const pagasaLine = weather.pagasa?.status === 'active'
    ? `PAGASA NCR advisory: ${weather.pagasa.summary}`
    : weather.pagasa?.status === 'none'
      ? 'PAGASA NCR advisory: No active thunderstorm advisory found in this check.'
      : 'PAGASA NCR advisory: No verified PAGASA advisory available from this check.';

  return [
    `⚠️ Weather Update — Metro Manila (${formatDate(weather.localDate)})`,
    '',
    `We are currently experiencing ${condition.toLowerCase()} in the Metro Manila area, with temperatures around ${temp}°C (feels like ${feels}°C) and humidity at ${humidity}%. Winds are blowing at approximately ${wind} km/h, with gusts reaching up to ${gust} km/h. About ${rain} mm of rainfall is expected today, and gusts up to ${maxGust} km/h may develop as the day progresses.`,
    '',
    pagasaLine,
    '',
    'Current Status:',
    `• Condition: ${condition}${forecastText === 'thunderstorms' ? ', with heavier rain and thunderstorms expected later today' : ''}`,
    `• Wind: ~${wind} km/h sustained, gusts up to ${gust} km/h${maxGust > gust ? ` (possibly ${maxGust} km/h)` : ''}`,
    `• Today's forecast: ${forecastText[0].toUpperCase()}${forecastText.slice(1)} with ~${rain} mm rain; high ${high}°C, low ${low}°C`,
    `• Severity level: ${weather.severity} — ${severe ? 'Severe weather' : 'Weather advisory'}`,
    `• Recommendation: ${recommendation}`,
    '',
    'Would you like to compose and send an announcement to employees?',
  ].join('\n');
}

function runNode(script, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], { windowsHide: true });
    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => child.kill(), 45000);
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr || stdout || `process failed with exit ${code}`));
    });
  });
}

async function runManualWeatherCheck() {
  // This must remain asynchronous. A synchronous child process blocks the
  // gateway event loop while hr-send tries to open a local gateway connection.
  const report = await runNode(WEATHER_SCRIPT, ['--report']);
  const weather = JSON.parse(report);
  writeFileSync(OUTBOX_PATH, JSON.stringify({
    target: HR_DRAFTS,
    text: buildAdvisory(weather),
    buttons: [{ label: 'Compose Draft', value: 'compose_draft' }],
  }) + '\n', 'utf8');
  await runNode(SEND_SCRIPT);
}

function formatHolidayDate(dateString) {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  }).format(new Date(`${dateString}T12:00:00+08:00`));
}

function buildHolidayAdvisory(report) {
  const lines = [
    `🇵🇭 Philippine Public Holidays — ${report.monthLabel}`,
    '',
    'The following national public holiday information is provided for HR planning and review:',
    '',
  ];
  if (report.holidays?.length) {
    for (const holiday of report.holidays) {
      const type = holiday.types?.length ? ` (${holiday.types.join(', ')})` : '';
      lines.push(`• ${formatHolidayDate(holiday.date)} — ${holiday.name}${type}`);
    }
  } else {
    lines.push('• No national public holidays are listed for this month by the data source.');
  }
  lines.push('', 'Please confirm any work schedule, staffing, payroll, and office-operating arrangements through the appropriate HR and management process.', '', 'Would you like to compose an employee announcement?');
  return lines.join('\n');
}

function buildHolidayDraft(report) {
  const lines = [
    `Philippine Public Holiday Notice — ${report.monthLabel}`,
    '',
    'Dear ABC Employees,',
    '',
    `Please be informed of the following Philippine public holiday${report.holidays?.length === 1 ? '' : 's'} falling in ${report.monthLabel}:`,
    '',
  ];
  if (report.holidays?.length) {
    for (const holiday of report.holidays) lines.push(`• ${formatHolidayDate(holiday.date)} — ${holiday.name}`);
  } else {
    lines.push('• No national public holidays are listed for this month.');
  }
  lines.push('', 'Any work schedules, staffing arrangements, and office operating plans remain subject to HR and management confirmation. Please coordinate with your immediate supervisor for guidance relevant to your role.', '', 'Thank you.', '', 'Human Resources');
  return lines.join('\n');
}

async function getHolidayReport() {
  const raw = await runNode(HOLIDAY_SCRIPT, ['--report']);
  return JSON.parse(raw);
}

async function runManualHolidayCheck() {
  const report = await getHolidayReport();
  const state = readHolidayState();
  state.latestReport = report;
  state.draft = null;
  state.awaitingEdit = false;
  writeHolidayState(state);
  await sendOutbox(buildHolidayAdvisory(report), [{ label: 'Compose Draft', value: 'compose_holiday_draft' }]);
}

async function runComposeHolidayDraft() {
  const state = readHolidayState();
  const report = state.latestReport ?? await getHolidayReport();
  const draft = buildHolidayDraft(report);
  state.latestReport = report;
  state.draft = draft;
  state.awaitingEdit = false;
  writeHolidayState(state);
  await sendOutbox(draft, [
    { label: 'Send to Employees', value: 'send_holiday_employees' },
    { label: 'Edit', value: 'edit_holiday' },
    { label: 'Discard', value: 'discard_holiday' },
  ]);
}

async function runSendHolidayEmployees() {
  const state = readHolidayState();
  if (!state.draft) throw new Error('no holiday announcement draft is available');
  writeFileSync(OUTBOX_PATH, JSON.stringify({ target: ABC_EMPLOYEES, text: state.draft }) + '\n', 'utf8');
  await runNode(SEND_SCRIPT);
  state.draft = null;
  state.awaitingEdit = false;
  writeHolidayState(state);
}

async function runBeginHolidayEdit() {
  const state = readHolidayState();
  if (!state.draft) return;
  state.awaitingEdit = true;
  writeHolidayState(state);
  await sendOutbox('Reply to this message with your revised announcement.');
}

async function runDiscardHoliday() {
  const state = readHolidayState();
  state.draft = null;
  state.awaitingEdit = false;
  writeHolidayState(state);
  await sendOutbox('Draft discarded.');
}

async function runRevisedHolidayDraft(revision) {
  const draft = normalizeRevision(revision);
  if (!draft) return;
  const state = readHolidayState();
  state.draft = draft;
  state.awaitingEdit = false;
  writeHolidayState(state);
  await sendOutbox(draft, [
    { label: 'Send to Employees', value: 'send_holiday_employees' },
    { label: 'Edit', value: 'edit_holiday' },
    { label: 'Discard', value: 'discard_holiday' },
  ]);
}

function buildDraft(weather) {
  const current = weather.current;
  const forecast = weather.forecast;
  const temp = prettyNumber(current.temp_c);
  const feels = prettyNumber(current.apparent_c);
  const humidity = prettyNumber(current.humidity_pct);
  const wind = prettyNumber(current.wind_kmh);
  const gust = prettyNumber(current.gust_kmh);
  const maxGust = prettyNumber(forecast.gust_max_kmh);
  const rain = prettyNumber(forecast.precip_today_mm);
  const high = prettyNumber(forecast.temp_max_c);
  const low = prettyNumber(forecast.temp_min_c);
  const date = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date(`${weather.localDate}T12:00:00+08:00`));
  const forecastText = forecastDescription(forecast.today_code);
  const weatherLabel = Number(weather.severity) >= 3 ? 'severe weather conditions' : 'adverse weather conditions';
  const pagasaNote = weather.pagasa?.status === 'active'
    ? `PAGASA NCR has issued the following relevant advisory: ${weather.pagasa.summary}`
    : 'No verified PAGASA advisory was available from this automated check.';

  return [
    'Weather Update and Dress-Down Recommendation — Metro Manila',
    '',
    'Good day, ABC team.',
    '',
    `As of ${date}, Metro Manila is experiencing ${String(current.condition).toLowerCase()}. Current conditions are ${temp}°C (feels like ${feels}°C), with ${humidity}% humidity. Winds are approximately ${wind} km/h, with gusts up to ${gust} km/h. Today’s forecast calls for ${forecastText}, around ${rain} mm of rain, gusts up to ${maxGust} km/h, and temperatures from ${low}°C to ${high}°C.`,
    '',
    pagasaNote,
    '',
    `Given these ${weatherLabel}, employees should allow extra travel time and prioritize safety while commuting. Employees who need to report on-site may dress down in casual, comfortable, and weather-appropriate attire.`,
    '',
    'Stay safe and coordinate with your immediate supervisor regarding your schedule.',
    '',
    'Thank you and best regards,',
    'Human Resources',
  ].join('\n');
}

async function runComposeDraft() {
  const report = await runNode(WEATHER_SCRIPT, ['--report']);
  const weather = JSON.parse(report);
  const draft = buildDraft(weather);
  const state = readWorkflowState();
  state.draft = draft;
  state.awaitingEdit = false;
  writeWorkflowState(state);
  await sendOutbox(draft, [
    { label: 'Send to Employees', value: 'send_employees' },
    { label: 'Edit', value: 'edit' },
    { label: 'Discard', value: 'discard' },
  ]);
}

async function runSendEmployees() {
  const state = readWorkflowState();
  if (!state.draft) throw new Error('no employee announcement draft is available');
  writeFileSync(OUTBOX_PATH, JSON.stringify({
    target: ABC_EMPLOYEES,
    text: state.draft,
  }) + '\n', 'utf8');
  await runNode(SEND_SCRIPT);
  // The sent draft must not be reused by an old button tap. Do not post a
  // second HR Drafts confirmation or monitoring question.
  state.draft = null;
  state.awaitingEdit = false;
  writeWorkflowState(state);
}

async function runBeginEdit() {
  const state = readWorkflowState();
  if (!state.draft) return;
  state.awaitingEdit = true;
  writeWorkflowState(state);
  await sendOutbox('Reply to this message with your revised announcement.');
}

async function runDiscard() {
  const state = readWorkflowState();
  state.draft = null;
  state.awaitingEdit = false;
  writeWorkflowState(state);
  await sendOutbox('Draft discarded.');
}

async function runRevisedDraft(revision) {
  const draft = normalizeRevision(revision);
  if (!draft) return;
  const state = readWorkflowState();
  state.draft = draft;
  state.awaitingEdit = false;
  writeWorkflowState(state);
  await sendOutbox(draft, [
    { label: 'Send to Employees', value: 'send_employees' },
    { label: 'Edit', value: 'edit' },
    { label: 'Discard', value: 'discard' },
  ]);
}

async function runEarthquakeTemplate() {
  const state = readEarthquakeState();
  state.draft = null;
  state.awaitingEdit = false;
  writeEarthquakeState(state);
  await sendOutbox(EARTHQUAKE_ANNOUNCEMENT_TEMPLATE, [
    { label: 'Compose Draft', value: 'compose_earthquake_draft' },
  ]);
}

async function runComposeEarthquakeDraft() {
  const state = readEarthquakeState();
  state.draft = EARTHQUAKE_ANNOUNCEMENT_TEMPLATE;
  state.awaitingEdit = false;
  writeEarthquakeState(state);
  await sendOutbox(state.draft, [
    { label: 'Send to Employees', value: 'send_earthquake_employees' },
    { label: 'Edit', value: 'edit_earthquake' },
    { label: 'Discard', value: 'discard_earthquake' },
  ]);
}

async function runSendEarthquakeEmployees() {
  const state = readEarthquakeState();
  if (!state.draft) throw new Error('no earthquake announcement draft is available');
  writeFileSync(OUTBOX_PATH, JSON.stringify({ target: ABC_EMPLOYEES, text: state.draft }) + '\n', 'utf8');
  await runNode(SEND_SCRIPT);
  state.draft = null;
  state.awaitingEdit = false;
  writeEarthquakeState(state);
}

async function runBeginEarthquakeEdit() {
  const state = readEarthquakeState();
  if (!state.draft) return;
  state.awaitingEdit = true;
  writeEarthquakeState(state);
  await sendOutbox('Reply to this message with your revised announcement.');
}

async function runDiscardEarthquake() {
  const state = readEarthquakeState();
  state.draft = null;
  state.awaitingEdit = false;
  writeEarthquakeState(state);
  await sendOutbox('Draft discarded.');
}

async function runRevisedEarthquakeDraft(revision) {
  const draft = normalizeRevision(revision);
  if (!draft) return;
  const state = readEarthquakeState();
  state.draft = draft;
  state.awaitingEdit = false;
  writeEarthquakeState(state);
  await sendOutbox(draft, [
    { label: 'Send to Employees', value: 'send_earthquake_employees' },
    { label: 'Edit', value: 'edit_earthquake' },
    { label: 'Discard', value: 'discard_earthquake' },
  ]);
}

async function runMaintenanceTemplate() {
  const state = readMaintenanceState();
  state.draft = null;
  state.awaitingEdit = false;
  writeMaintenanceState(state);
  await sendOutbox(MAINTENANCE_ANNOUNCEMENT_TEMPLATE, [
    { label: 'Compose Draft', value: 'compose_maintenance_draft' },
  ]);
}

async function runComposeMaintenanceDraft() {
  const state = readMaintenanceState();
  state.draft = MAINTENANCE_ANNOUNCEMENT_TEMPLATE;
  state.awaitingEdit = false;
  writeMaintenanceState(state);
  await sendOutbox(state.draft, [
    { label: 'Send to Employees', value: 'send_maintenance_employees' },
    { label: 'Edit', value: 'edit_maintenance' },
    { label: 'Discard', value: 'discard_maintenance' },
  ]);
}

async function runSendMaintenanceEmployees() {
  const state = readMaintenanceState();
  if (!state.draft) throw new Error('no maintenance announcement draft is available');
  writeFileSync(OUTBOX_PATH, JSON.stringify({ target: ABC_EMPLOYEES, text: state.draft }) + '\n', 'utf8');
  await runNode(SEND_SCRIPT);
  state.draft = null;
  state.awaitingEdit = false;
  writeMaintenanceState(state);
}

async function runBeginMaintenanceEdit() {
  const state = readMaintenanceState();
  if (!state.draft) return;
  state.awaitingEdit = true;
  writeMaintenanceState(state);
  await sendOutbox('Reply to this message with your revised announcement.');
}

async function runDiscardMaintenance() {
  const state = readMaintenanceState();
  state.draft = null;
  state.awaitingEdit = false;
  writeMaintenanceState(state);
  await sendOutbox('Draft discarded.');
}

async function runRevisedMaintenanceDraft(revision) {
  const draft = normalizeRevision(revision);
  if (!draft) return;
  const state = readMaintenanceState();
  state.draft = draft;
  state.awaitingEdit = false;
  writeMaintenanceState(state);
  await sendOutbox(draft, [
    { label: 'Send to Employees', value: 'send_maintenance_employees' },
    { label: 'Edit', value: 'edit_maintenance' },
    { label: 'Discard', value: 'discard_maintenance' },
  ]);
}

async function runIbmGeneratorTemplate() {
  const state = readIbmGeneratorState();
  state.draft = null;
  state.awaitingEdit = false;
  writeIbmGeneratorState(state);
  await sendOutbox(IBM_GENERATOR_ANNOUNCEMENT_TEMPLATE, [
    { label: 'Compose Draft', value: 'compose_ibm_generator_draft' },
  ]);
}

async function runComposeIbmGeneratorDraft() {
  const state = readIbmGeneratorState();
  state.draft = IBM_GENERATOR_ANNOUNCEMENT_TEMPLATE;
  state.awaitingEdit = false;
  writeIbmGeneratorState(state);
  await sendOutbox(state.draft, [
    { label: 'Send to Employees', value: 'send_ibm_generator_employees' },
    { label: 'Edit', value: 'edit_ibm_generator' },
    { label: 'Discard', value: 'discard_ibm_generator' },
  ]);
}

async function runSendIbmGeneratorEmployees() {
  const state = readIbmGeneratorState();
  if (!state.draft) throw new Error('no IBM generator announcement draft is available');
  writeFileSync(OUTBOX_PATH, JSON.stringify({ target: ABC_EMPLOYEES, text: state.draft }) + '\n', 'utf8');
  await runNode(SEND_SCRIPT);
  state.draft = null;
  state.awaitingEdit = false;
  writeIbmGeneratorState(state);
}

async function runBeginIbmGeneratorEdit() {
  const state = readIbmGeneratorState();
  if (!state.draft) return;
  state.awaitingEdit = true;
  writeIbmGeneratorState(state);
  await sendOutbox('Reply to this message with your revised announcement.');
}

async function runDiscardIbmGenerator() {
  const state = readIbmGeneratorState();
  state.draft = null;
  state.awaitingEdit = false;
  writeIbmGeneratorState(state);
  await sendOutbox('Draft discarded.');
}

async function runRevisedIbmGeneratorDraft(revision) {
  const draft = normalizeRevision(revision);
  if (!draft) return;
  const state = readIbmGeneratorState();
  state.draft = draft;
  state.awaitingEdit = false;
  writeIbmGeneratorState(state);
  await sendOutbox(draft, [
    { label: 'Send to Employees', value: 'send_ibm_generator_employees' },
    { label: 'Edit', value: 'edit_ibm_generator' },
    { label: 'Discard', value: 'discard_ibm_generator' },
  ]);
}

async function runVendoLoadingTemplate() {
  const state = readVendoLoadingState();
  state.draft = null;
  state.awaitingEdit = false;
  writeVendoLoadingState(state);
  await sendOutbox(VENDO_LOADING_ANNOUNCEMENT_TEMPLATE, [
    { label: 'Compose Draft', value: 'compose_vendo_loading_draft' },
  ]);
}

async function runComposeVendoLoadingDraft() {
  const state = readVendoLoadingState();
  state.draft = VENDO_LOADING_ANNOUNCEMENT_TEMPLATE;
  state.awaitingEdit = false;
  writeVendoLoadingState(state);
  await sendOutbox(state.draft, [
    { label: 'Send to Employees', value: 'send_vendo_loading_employees' },
    { label: 'Edit', value: 'edit_vendo_loading' },
    { label: 'Discard', value: 'discard_vendo_loading' },
  ]);
}

async function runSendVendoLoadingEmployees() {
  const state = readVendoLoadingState();
  if (!state.draft) throw new Error('no vendo loading announcement draft is available');
  writeFileSync(OUTBOX_PATH, JSON.stringify({ target: ABC_EMPLOYEES, text: state.draft }) + '\n', 'utf8');
  await runNode(SEND_SCRIPT);
  state.draft = null;
  state.awaitingEdit = false;
  writeVendoLoadingState(state);
}

async function runBeginVendoLoadingEdit() {
  const state = readVendoLoadingState();
  if (!state.draft) return;
  state.awaitingEdit = true;
  writeVendoLoadingState(state);
  await sendOutbox('Reply to this message with your revised announcement.');
}

async function runDiscardVendoLoading() {
  const state = readVendoLoadingState();
  state.draft = null;
  state.awaitingEdit = false;
  writeVendoLoadingState(state);
  await sendOutbox('Draft discarded.');
}

async function runRevisedVendoLoadingDraft(revision) {
  const draft = normalizeRevision(revision);
  if (!draft) return;
  const state = readVendoLoadingState();
  state.draft = draft;
  state.awaitingEdit = false;
  writeVendoLoadingState(state);
  await sendOutbox(draft, [
    { label: 'Send to Employees', value: 'send_vendo_loading_employees' },
    { label: 'Edit', value: 'edit_vendo_loading' },
    { label: 'Discard', value: 'discard_vendo_loading' },
  ]);
}

async function runApeTemplate() {
  const state = readApeState();
  state.draft = null;
  state.awaitingEdit = false;
  writeApeState(state);
  await sendOutbox(APE_ANNOUNCEMENT_TEMPLATE, [
    { label: 'Compose Draft', value: 'compose_ape_draft' },
  ]);
}

async function runComposeApeDraft() {
  const state = readApeState();
  state.draft = APE_ANNOUNCEMENT_TEMPLATE;
  state.awaitingEdit = false;
  writeApeState(state);
  await sendOutbox(state.draft, [
    { label: 'Send to Employees', value: 'send_ape_employees' },
    { label: 'Edit', value: 'edit_ape' },
    { label: 'Discard', value: 'discard_ape' },
  ]);
}

async function runSendApeEmployees() {
  const state = readApeState();
  if (!state.draft) throw new Error('no APE announcement draft is available');
  writeFileSync(OUTBOX_PATH, JSON.stringify({ target: ABC_EMPLOYEES, text: state.draft }) + '\n', 'utf8');
  await runNode(SEND_SCRIPT);
  state.draft = null;
  state.awaitingEdit = false;
  writeApeState(state);
}

async function runBeginApeEdit() {
  const state = readApeState();
  if (!state.draft) return;
  state.awaitingEdit = true;
  writeApeState(state);
  await sendOutbox('Reply to this message with your revised announcement.');
}

async function runDiscardApe() {
  const state = readApeState();
  state.draft = null;
  state.awaitingEdit = false;
  writeApeState(state);
  await sendOutbox('Draft discarded.');
}

async function runRevisedApeDraft(revision) {
  const draft = normalizeRevision(revision);
  if (!draft) return;
  const state = readApeState();
  state.draft = draft;
  state.awaitingEdit = false;
  writeApeState(state);
  await sendOutbox(draft, [
    { label: 'Send to Employees', value: 'send_ape_employees' },
    { label: 'Edit', value: 'edit_ape' },
    { label: 'Discard', value: 'discard_ape' },
  ]);
}

function workflowButtons(workflow) {
  return [
    { label: 'Send to Employees', value: workflow.callbacks.send },
    { label: 'Edit', value: workflow.callbacks.edit },
    { label: 'Discard', value: workflow.callbacks.discard },
  ];
}

async function runDraftTemplate(workflowKey) {
  const workflow = DRAFT_WORKFLOWS[workflowKey];
  const state = readDraftWorkflowState(workflow.statePath);
  state.draft = null;
  state.awaitingEdit = false;
  writeDraftWorkflowState(workflow.statePath, state);
  const text = workflow.template ? workflow.template() : 'Manual Employee Announcement\n\nUse the Compose Draft button to create an employee announcement.';
  await sendOutbox(text, [{ label: 'Compose Draft', value: workflow.callbacks.compose }]);
}

async function runComposeWorkflowDraft(workflowKey) {
  const workflow = DRAFT_WORKFLOWS[workflowKey];
  const state = readDraftWorkflowState(workflow.statePath);
  if (!workflow.template) {
    state.draft = null;
    state.awaitingEdit = true;
    writeDraftWorkflowState(workflow.statePath, state);
    await sendOutbox('Reply to this message with your announcement.');
    return;
  }
  state.draft = workflow.template();
  state.awaitingEdit = false;
  writeDraftWorkflowState(workflow.statePath, state);
  await sendOutbox(state.draft, workflowButtons(workflow));
}

async function runSendWorkflowEmployees(workflowKey) {
  const workflow = DRAFT_WORKFLOWS[workflowKey];
  const state = readDraftWorkflowState(workflow.statePath);
  if (!state.draft) throw new Error(`no ${workflowKey} announcement draft is available`);
  writeFileSync(OUTBOX_PATH, JSON.stringify({ target: ABC_EMPLOYEES, text: state.draft }) + '\n', 'utf8');
  await runNode(SEND_SCRIPT);
  state.draft = null;
  state.awaitingEdit = false;
  writeDraftWorkflowState(workflow.statePath, state);
}

async function runBeginWorkflowEdit(workflowKey) {
  const workflow = DRAFT_WORKFLOWS[workflowKey];
  const state = readDraftWorkflowState(workflow.statePath);
  if (!state.draft) return;
  state.awaitingEdit = true;
  writeDraftWorkflowState(workflow.statePath, state);
  await sendOutbox('Reply to this message with your revised announcement.');
}

async function runDiscardWorkflowDraft(workflowKey) {
  const workflow = DRAFT_WORKFLOWS[workflowKey];
  const state = readDraftWorkflowState(workflow.statePath);
  state.draft = null;
  state.awaitingEdit = false;
  writeDraftWorkflowState(workflow.statePath, state);
  await sendOutbox('Draft discarded.');
}

async function runRevisedWorkflowDraft(workflowKey, revision) {
  const draft = normalizeRevision(revision);
  if (!draft) return;
  const workflow = DRAFT_WORKFLOWS[workflowKey];
  const state = readDraftWorkflowState(workflow.statePath);
  state.draft = draft;
  state.awaitingEdit = false;
  writeDraftWorkflowState(workflow.statePath, state);
  await sendOutbox(draft, workflowButtons(workflow));
}

export default definePluginEntry({
  id: 'hr-single-delivery-guard',
  name: 'HR Single Delivery Guard',
  description: 'Handles HR weather actions without duplicate confirmations or monitoring prompts.',
  register(api) {
    api.on('before_dispatch', async (event, ctx) => {
      if (ctx.sessionKey !== HR_DRAFTS_SESSION) return;
      const content = event.content.trim();
      const isWeatherCommand = /^\/check_weather(?:@[A-Za-z0-9_]+)?(?:\s|$)/i.test(content);
      // /check_ph_holidays is intentionally handled by the holiday agent prompt,
      // so manual checks use the same official-source verification as the schedule.
      const isEarthquakeTemplateCommand = /^\/(?:create_earthquake_draft|create_earthquake_announcement)(?:@[A-Za-z0-9_]+)?(?:\s|$)/i.test(content);
      const isMaintenanceTemplateCommand = /^\/(?:create_maintenance_draft|create_maintenance_announcement)(?:@[A-Za-z0-9_]+)?(?:\s|$)/i.test(content);
      const isIbmGeneratorTemplateCommand = /^\/create_ibm_generator_draft(?:@[A-Za-z0-9_]+)?(?:\s|$)/i.test(content);
      const isVendoLoadingTemplateCommand = /^\/create_vendo_loading_draft(?:@[A-Za-z0-9_]+)?(?:\s|$)/i.test(content);
      const isApeTemplateCommand = /^\/create_ape_draft(?:@[A-Za-z0-9_]+)?(?:\s|$)/i.test(content);
      const isFluTemplateCommand = /^\/create_flu_draft(?:@[A-Za-z0-9_]+)?(?:\s|$)/i.test(content);
      const isBirthdayTemplateCommand = /^\/create_birthday_draft(?:@[A-Za-z0-9_]+)?(?:\s|$)/i.test(content);
      const isLastFilingTemplateCommand = /^\/create_last_filing_draft(?:@[A-Za-z0-9_]+)?(?:\s|$)/i.test(content);
      const isAnnouncementTemplateCommand = /^\/create_announcement_draft(?:@[A-Za-z0-9_]+)?(?:\s|$)/i.test(content);
      const isComposeEarthquakeDraft = /(?:callback_data\s*:\s*)?compose_earthquake_draft\b/i.test(content);
      const isSendEarthquakeEmployees = /(?:callback_data\s*:\s*)?send_earthquake_employees\b/i.test(content);
      const isEarthquakeEdit = /(?:callback_data\s*:\s*)?edit_earthquake\b/i.test(content);
      const isEarthquakeDiscard = /(?:callback_data\s*:\s*)?discard_earthquake\b/i.test(content);
      const isComposeMaintenanceDraft = /(?:callback_data\s*:\s*)?compose_maintenance_draft\b/i.test(content);
      const isSendMaintenanceEmployees = /(?:callback_data\s*:\s*)?send_maintenance_employees\b/i.test(content);
      const isMaintenanceEdit = /(?:callback_data\s*:\s*)?edit_maintenance\b/i.test(content);
      const isMaintenanceDiscard = /(?:callback_data\s*:\s*)?discard_maintenance\b/i.test(content);
      const isComposeIbmGeneratorDraft = /(?:callback_data\s*:\s*)?compose_ibm_generator_draft\b/i.test(content);
      const isSendIbmGeneratorEmployees = /(?:callback_data\s*:\s*)?send_ibm_generator_employees\b/i.test(content);
      const isIbmGeneratorEdit = /(?:callback_data\s*:\s*)?edit_ibm_generator\b/i.test(content);
      const isIbmGeneratorDiscard = /(?:callback_data\s*:\s*)?discard_ibm_generator\b/i.test(content);
      const isComposeVendoLoadingDraft = /(?:callback_data\s*:\s*)?compose_vendo_loading_draft\b/i.test(content);
      const isSendVendoLoadingEmployees = /(?:callback_data\s*:\s*)?send_vendo_loading_employees\b/i.test(content);
      const isVendoLoadingEdit = /(?:callback_data\s*:\s*)?edit_vendo_loading\b/i.test(content);
      const isVendoLoadingDiscard = /(?:callback_data\s*:\s*)?discard_vendo_loading\b/i.test(content);
      const isComposeApeDraft = /(?:callback_data\s*:\s*)?compose_ape_draft\b/i.test(content);
      const isSendApeEmployees = /(?:callback_data\s*:\s*)?send_ape_employees\b/i.test(content);
      const isApeEdit = /(?:callback_data\s*:\s*)?edit_ape\b/i.test(content);
      const isApeDiscard = /(?:callback_data\s*:\s*)?discard_ape\b/i.test(content);
      const isComposeFluDraft = /(?:callback_data\s*:\s*)?compose_flu_draft\b/i.test(content);
      const isSendFluEmployees = /(?:callback_data\s*:\s*)?send_flu_employees\b/i.test(content);
      const isFluEdit = /(?:callback_data\s*:\s*)?edit_flu\b/i.test(content);
      const isFluDiscard = /(?:callback_data\s*:\s*)?discard_flu\b/i.test(content);
      const isComposeBirthdayDraft = /(?:callback_data\s*:\s*)?compose_birthday_draft\b/i.test(content);
      const isSendBirthdayEmployees = /(?:callback_data\s*:\s*)?send_birthday_employees\b/i.test(content);
      const isBirthdayEdit = /(?:callback_data\s*:\s*)?edit_birthday\b/i.test(content);
      const isBirthdayDiscard = /(?:callback_data\s*:\s*)?discard_birthday\b/i.test(content);
      const isComposeLastFilingDraft = /(?:callback_data\s*:\s*)?compose_last_filing_draft\b/i.test(content);
      const isSendLastFilingEmployees = /(?:callback_data\s*:\s*)?send_last_filing_employees\b/i.test(content);
      const isLastFilingEdit = /(?:callback_data\s*:\s*)?edit_last_filing\b/i.test(content);
      const isLastFilingDiscard = /(?:callback_data\s*:\s*)?discard_last_filing\b/i.test(content);
      const isComposeAnnouncementDraft = /(?:callback_data\s*:\s*)?compose_announcement_draft\b/i.test(content);
      const isSendAnnouncementEmployees = /(?:callback_data\s*:\s*)?send_announcement_employees\b/i.test(content);
      const isAnnouncementEdit = /(?:callback_data\s*:\s*)?edit_announcement\b/i.test(content);
      const isAnnouncementDiscard = /(?:callback_data\s*:\s*)?discard_announcement\b/i.test(content);
      const isComposeDraft = /(?:callback_data\s*:\s*)?compose_draft\b/i.test(content);
      const isComposeHolidayDraft = /(?:callback_data\s*:\s*)?compose_holiday_draft\b/i.test(content);
      const isSendEmployees = /(?:callback_data\s*:\s*)?send_employees\b/i.test(content);
      const isSendHolidayEmployees = /(?:callback_data\s*:\s*)?send_holiday_employees\b/i.test(content);
      const isEdit = /(?:callback_data\s*:\s*)?edit\b/i.test(content);
      const isHolidayEdit = /(?:callback_data\s*:\s*)?edit_holiday\b/i.test(content);
      const isDiscard = /(?:callback_data\s*:\s*)?discard\b/i.test(content);
      const isHolidayDiscard = /(?:callback_data\s*:\s*)?discard_holiday\b/i.test(content);
      const isCallback = /^callback_data\s*:/i.test(content);
      const isPlainText = Boolean(content) && !isCallback && !content.startsWith('/');
      let isRevision = false;
      let isHolidayRevision = false;
      let isEarthquakeRevision = false;
      let isMaintenanceRevision = false;
      let isIbmGeneratorRevision = false;
      let isVendoLoadingRevision = false;
      let isApeRevision = false;
      let isFluRevision = false;
      let isBirthdayRevision = false;
      let isLastFilingRevision = false;
      let isAnnouncementRevision = false;
      if (isPlainText) {
        try {
          isRevision = readWorkflowState().awaitingEdit === true;
        } catch {
          isRevision = false;
        }
        try {
          isHolidayRevision = readHolidayState().awaitingEdit === true;
        } catch {
          isHolidayRevision = false;
        }
        try {
          isEarthquakeRevision = readEarthquakeState().awaitingEdit === true;
        } catch {
          isEarthquakeRevision = false;
        }
        try {
          isMaintenanceRevision = readMaintenanceState().awaitingEdit === true;
        } catch {
          isMaintenanceRevision = false;
        }
        try {
          isIbmGeneratorRevision = readIbmGeneratorState().awaitingEdit === true;
        } catch {
          isIbmGeneratorRevision = false;
        }
        try {
          isVendoLoadingRevision = readVendoLoadingState().awaitingEdit === true;
        } catch {
          isVendoLoadingRevision = false;
        }
        try {
          isApeRevision = readApeState().awaitingEdit === true;
        } catch {
          isApeRevision = false;
        }
        try {
          isFluRevision = readDraftWorkflowState(FLU_STATE_PATH).awaitingEdit === true;
          isBirthdayRevision = readDraftWorkflowState(BIRTHDAY_STATE_PATH).awaitingEdit === true;
          isLastFilingRevision = readDraftWorkflowState(LAST_FILING_STATE_PATH).awaitingEdit === true;
          isAnnouncementRevision = readDraftWorkflowState(ANNOUNCEMENT_STATE_PATH).awaitingEdit === true;
        } catch {
          isFluRevision = false;
          isBirthdayRevision = false;
          isLastFilingRevision = false;
          isAnnouncementRevision = false;
        }
      }
      if (!isWeatherCommand && !isEarthquakeTemplateCommand && !isMaintenanceTemplateCommand && !isIbmGeneratorTemplateCommand && !isVendoLoadingTemplateCommand && !isApeTemplateCommand && !isFluTemplateCommand && !isBirthdayTemplateCommand && !isLastFilingTemplateCommand && !isAnnouncementTemplateCommand && !isComposeDraft && !isComposeHolidayDraft && !isComposeEarthquakeDraft && !isComposeMaintenanceDraft && !isComposeIbmGeneratorDraft && !isComposeVendoLoadingDraft && !isComposeApeDraft && !isComposeFluDraft && !isComposeBirthdayDraft && !isComposeLastFilingDraft && !isComposeAnnouncementDraft && !isSendEmployees && !isSendHolidayEmployees && !isSendEarthquakeEmployees && !isSendMaintenanceEmployees && !isSendIbmGeneratorEmployees && !isSendVendoLoadingEmployees && !isSendApeEmployees && !isSendFluEmployees && !isSendBirthdayEmployees && !isSendLastFilingEmployees && !isSendAnnouncementEmployees && !isEdit && !isHolidayEdit && !isEarthquakeEdit && !isMaintenanceEdit && !isIbmGeneratorEdit && !isVendoLoadingEdit && !isApeEdit && !isFluEdit && !isBirthdayEdit && !isLastFilingEdit && !isAnnouncementEdit && !isDiscard && !isHolidayDiscard && !isEarthquakeDiscard && !isMaintenanceDiscard && !isIbmGeneratorDiscard && !isVendoLoadingDiscard && !isApeDiscard && !isFluDiscard && !isBirthdayDiscard && !isLastFilingDiscard && !isAnnouncementDiscard && !isRevision && !isHolidayRevision && !isEarthquakeRevision && !isMaintenanceRevision && !isIbmGeneratorRevision && !isVendoLoadingRevision && !isApeRevision && !isFluRevision && !isBirthdayRevision && !isLastFilingRevision && !isAnnouncementRevision) return;
      try {
        if (isWeatherCommand) {
          await runManualWeatherCheck();
          api.logger.info('sent the single /check_weather advisory without model dispatch');
        } else if (isEarthquakeTemplateCommand) {
          await runEarthquakeTemplate();
          api.logger.info('sent earthquake announcement template without model dispatch');
        } else if (isMaintenanceTemplateCommand) {
          await runMaintenanceTemplate();
          api.logger.info('sent maintenance announcement template without model dispatch');
        } else if (isIbmGeneratorTemplateCommand) {
          await runIbmGeneratorTemplate();
          api.logger.info('sent IBM generator announcement template without model dispatch');
        } else if (isVendoLoadingTemplateCommand) {
          await runVendoLoadingTemplate();
          api.logger.info('sent vendo loading announcement template without model dispatch');
        } else if (isApeTemplateCommand) {
          await runApeTemplate();
          api.logger.info('sent APE announcement template without model dispatch');
        } else if (isFluTemplateCommand) {
          await runDraftTemplate('flu');
          api.logger.info('sent flu vaccine announcement template without model dispatch');
        } else if (isBirthdayTemplateCommand) {
          await runDraftTemplate('birthday');
          api.logger.info('sent birthday announcement template without model dispatch');
        } else if (isLastFilingTemplateCommand) {
          await runDraftTemplate('lastFiling');
          api.logger.info('sent last filing announcement template without model dispatch');
        } else if (isAnnouncementTemplateCommand) {
          await runDraftTemplate('announcement');
          api.logger.info('opened manual announcement composer without model dispatch');
        } else if (isComposeDraft) {
          await runComposeDraft();
          api.logger.info('sent the draft preview without a redundant confirmation');
        } else if (isComposeHolidayDraft) {
          await runComposeHolidayDraft();
          api.logger.info('sent the holiday draft preview without a redundant confirmation');
        } else if (isComposeEarthquakeDraft) {
          await runComposeEarthquakeDraft();
          api.logger.info('sent the earthquake draft preview without a redundant confirmation');
        } else if (isComposeMaintenanceDraft) {
          await runComposeMaintenanceDraft();
          api.logger.info('sent the maintenance draft preview without a redundant confirmation');
        } else if (isComposeIbmGeneratorDraft) {
          await runComposeIbmGeneratorDraft();
          api.logger.info('sent the IBM generator draft preview without a redundant confirmation');
        } else if (isComposeVendoLoadingDraft) {
          await runComposeVendoLoadingDraft();
          api.logger.info('sent the vendo loading draft preview without a redundant confirmation');
        } else if (isComposeApeDraft) {
          await runComposeApeDraft();
          api.logger.info('sent the APE draft preview without a redundant confirmation');
        } else if (isComposeFluDraft) {
          await runComposeWorkflowDraft('flu');
          api.logger.info('sent the flu draft preview without a redundant confirmation');
        } else if (isComposeBirthdayDraft) {
          await runComposeWorkflowDraft('birthday');
          api.logger.info('sent the birthday draft preview without a redundant confirmation');
        } else if (isComposeLastFilingDraft) {
          await runComposeWorkflowDraft('lastFiling');
          api.logger.info('sent the last filing draft preview without a redundant confirmation');
        } else if (isComposeAnnouncementDraft) {
          await runComposeWorkflowDraft('announcement');
          api.logger.info('opened manual announcement composition without model dispatch');
        } else if (isSendEmployees) {
          await runSendEmployees();
          api.logger.info('sent employee announcement without a monitoring prompt');
        } else if (isSendHolidayEmployees) {
          await runSendHolidayEmployees();
          api.logger.info('sent holiday employee announcement without a confirmation');
        } else if (isSendEarthquakeEmployees) {
          await runSendEarthquakeEmployees();
          api.logger.info('sent earthquake employee announcement without a confirmation');
        } else if (isSendMaintenanceEmployees) {
          await runSendMaintenanceEmployees();
          api.logger.info('sent maintenance employee announcement without a confirmation');
        } else if (isSendIbmGeneratorEmployees) {
          await runSendIbmGeneratorEmployees();
          api.logger.info('sent IBM generator employee announcement without a confirmation');
        } else if (isSendVendoLoadingEmployees) {
          await runSendVendoLoadingEmployees();
          api.logger.info('sent vendo loading employee announcement without a confirmation');
        } else if (isSendApeEmployees) {
          await runSendApeEmployees();
          api.logger.info('sent APE employee announcement without a confirmation');
        } else if (isSendFluEmployees) {
          await runSendWorkflowEmployees('flu');
          api.logger.info('sent flu employee announcement without a confirmation');
        } else if (isSendBirthdayEmployees) {
          await runSendWorkflowEmployees('birthday');
          api.logger.info('sent birthday employee announcement without a confirmation');
        } else if (isSendLastFilingEmployees) {
          await runSendWorkflowEmployees('lastFiling');
          api.logger.info('sent last filing employee announcement without a confirmation');
        } else if (isSendAnnouncementEmployees) {
          await runSendWorkflowEmployees('announcement');
          api.logger.info('sent manual employee announcement without a confirmation');
        } else if (isEdit) {
          await runBeginEdit();
          api.logger.info('opened edit mode without model dispatch');
        } else if (isHolidayEdit) {
          await runBeginHolidayEdit();
          api.logger.info('opened holiday edit mode without model dispatch');
        } else if (isEarthquakeEdit) {
          await runBeginEarthquakeEdit();
          api.logger.info('opened earthquake edit mode without model dispatch');
        } else if (isMaintenanceEdit) {
          await runBeginMaintenanceEdit();
          api.logger.info('opened maintenance edit mode without model dispatch');
        } else if (isIbmGeneratorEdit) {
          await runBeginIbmGeneratorEdit();
          api.logger.info('opened IBM generator edit mode without model dispatch');
        } else if (isVendoLoadingEdit) {
          await runBeginVendoLoadingEdit();
          api.logger.info('opened vendo loading edit mode without model dispatch');
        } else if (isApeEdit) {
          await runBeginApeEdit();
          api.logger.info('opened APE edit mode without model dispatch');
        } else if (isFluEdit) {
          await runBeginWorkflowEdit('flu');
          api.logger.info('opened flu edit mode without model dispatch');
        } else if (isBirthdayEdit) {
          await runBeginWorkflowEdit('birthday');
          api.logger.info('opened birthday edit mode without model dispatch');
        } else if (isLastFilingEdit) {
          await runBeginWorkflowEdit('lastFiling');
          api.logger.info('opened last filing edit mode without model dispatch');
        } else if (isAnnouncementEdit) {
          await runBeginWorkflowEdit('announcement');
          api.logger.info('opened manual announcement edit mode without model dispatch');
        } else if (isDiscard) {
          await runDiscard();
          api.logger.info('discarded draft without model dispatch');
        } else if (isHolidayDiscard) {
          await runDiscardHoliday();
          api.logger.info('discarded holiday draft without model dispatch');
        } else if (isEarthquakeDiscard) {
          await runDiscardEarthquake();
          api.logger.info('discarded earthquake draft without model dispatch');
        } else if (isMaintenanceDiscard) {
          await runDiscardMaintenance();
          api.logger.info('discarded maintenance draft without model dispatch');
        } else if (isIbmGeneratorDiscard) {
          await runDiscardIbmGenerator();
          api.logger.info('discarded IBM generator draft without model dispatch');
        } else if (isVendoLoadingDiscard) {
          await runDiscardVendoLoading();
          api.logger.info('discarded vendo loading draft without model dispatch');
        } else if (isApeDiscard) {
          await runDiscardApe();
          api.logger.info('discarded APE draft without model dispatch');
        } else if (isFluDiscard) {
          await runDiscardWorkflowDraft('flu');
          api.logger.info('discarded flu draft without model dispatch');
        } else if (isBirthdayDiscard) {
          await runDiscardWorkflowDraft('birthday');
          api.logger.info('discarded birthday draft without model dispatch');
        } else if (isLastFilingDiscard) {
          await runDiscardWorkflowDraft('lastFiling');
          api.logger.info('discarded last filing draft without model dispatch');
        } else if (isAnnouncementDiscard) {
          await runDiscardWorkflowDraft('announcement');
          api.logger.info('discarded manual announcement draft without model dispatch');
        } else if (isHolidayRevision) {
          await runRevisedHolidayDraft(content);
          api.logger.info('sent revised holiday draft preview without a redundant confirmation');
        } else if (isEarthquakeRevision) {
          await runRevisedEarthquakeDraft(content);
          api.logger.info('sent revised earthquake draft preview without a redundant confirmation');
        } else if (isMaintenanceRevision) {
          await runRevisedMaintenanceDraft(content);
          api.logger.info('sent revised maintenance draft preview without a redundant confirmation');
        } else if (isIbmGeneratorRevision) {
          await runRevisedIbmGeneratorDraft(content);
          api.logger.info('sent revised IBM generator draft preview without a redundant confirmation');
        } else if (isVendoLoadingRevision) {
          await runRevisedVendoLoadingDraft(content);
          api.logger.info('sent revised vendo loading draft preview without a redundant confirmation');
        } else if (isApeRevision) {
          await runRevisedApeDraft(content);
          api.logger.info('sent revised APE draft preview without a redundant confirmation');
        } else if (isFluRevision) {
          await runRevisedWorkflowDraft('flu', content);
          api.logger.info('sent revised flu draft preview without a redundant confirmation');
        } else if (isBirthdayRevision) {
          await runRevisedWorkflowDraft('birthday', content);
          api.logger.info('sent revised birthday draft preview without a redundant confirmation');
        } else if (isLastFilingRevision) {
          await runRevisedWorkflowDraft('lastFiling', content);
          api.logger.info('sent revised last filing draft preview without a redundant confirmation');
        } else if (isAnnouncementRevision) {
          await runRevisedWorkflowDraft('announcement', content);
          api.logger.info('sent manual announcement preview without a redundant confirmation');
        } else if (isRevision) {
          await runRevisedDraft(content);
          api.logger.info('sent revised draft preview without a redundant confirmation');
        }
        return { handled: true };
      } catch (error) {
        api.logger.error(`HR weather workflow failed: ${String(error)}`);
        return { handled: true, text: 'I could not complete that weather action. Please try again shortly.' };
      }
    }, { priority: 100, timeoutMs: 60000 });
  },
});
