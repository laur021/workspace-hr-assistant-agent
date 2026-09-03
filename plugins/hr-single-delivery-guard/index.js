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
const HR_DRAFTS = '-1003702195046';
const ABC_EMPLOYEES = '-1004452958432';

const EARTHQUAKE_ANNOUNCEMENT_TEMPLATE = [
  'SUBJECT: Earthquake Drill Advisory',
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
    `SUBJECT: Philippine Public Holiday Notice — ${report.monthLabel}`,
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
    'ADVISORY: Weather Update and Dress-Down Recommendation — Metro Manila',
    '',
    'Good day, ABC team.',
    '',
    `As of ${date}, Metro Manila is experiencing ${String(current.condition).toLowerCase()}. Current conditions are ${temp}°C (feels like ${feels}°C), with ${humidity}% humidity. Winds are approximately ${wind} km/h, with gusts up to ${gust} km/h. Today’s forecast calls for ${forecastText}, around ${rain} mm of rain, gusts up to ${maxGust} km/h, and temperatures from ${low}°C to ${high}°C.`,
    '',
    pagasaNote,
    '',
    `Given these ${weatherLabel}, employees should allow extra travel time and prioritize safety while commuting. Employees who need to report on-site may dress down in casual, comfortable, and weather-appropriate attire.`,
    '',
    'Stay safe and coordinate with your immediate supervisor regarding your schedule. Thank you for your cooperation and understanding.',
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
      const isEarthquakeTemplateCommand = /^\/create_earthquake_announcement(?:@[A-Za-z0-9_]+)?(?:\s|$)/i.test(content);
      const isComposeEarthquakeDraft = /(?:callback_data\s*:\s*)?compose_earthquake_draft\b/i.test(content);
      const isSendEarthquakeEmployees = /(?:callback_data\s*:\s*)?send_earthquake_employees\b/i.test(content);
      const isEarthquakeEdit = /(?:callback_data\s*:\s*)?edit_earthquake\b/i.test(content);
      const isEarthquakeDiscard = /(?:callback_data\s*:\s*)?discard_earthquake\b/i.test(content);
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
      }
      if (!isWeatherCommand && !isEarthquakeTemplateCommand && !isComposeDraft && !isComposeHolidayDraft && !isComposeEarthquakeDraft && !isSendEmployees && !isSendHolidayEmployees && !isSendEarthquakeEmployees && !isEdit && !isHolidayEdit && !isEarthquakeEdit && !isDiscard && !isHolidayDiscard && !isEarthquakeDiscard && !isRevision && !isHolidayRevision && !isEarthquakeRevision) return;
      try {
        if (isWeatherCommand) {
          await runManualWeatherCheck();
          api.logger.info('sent the single /check_weather advisory without model dispatch');
        } else if (isEarthquakeTemplateCommand) {
          await runEarthquakeTemplate();
          api.logger.info('sent earthquake announcement template without model dispatch');
        } else if (isComposeDraft) {
          await runComposeDraft();
          api.logger.info('sent the draft preview without a redundant confirmation');
        } else if (isComposeHolidayDraft) {
          await runComposeHolidayDraft();
          api.logger.info('sent the holiday draft preview without a redundant confirmation');
        } else if (isComposeEarthquakeDraft) {
          await runComposeEarthquakeDraft();
          api.logger.info('sent the earthquake draft preview without a redundant confirmation');
        } else if (isSendEmployees) {
          await runSendEmployees();
          api.logger.info('sent employee announcement without a monitoring prompt');
        } else if (isSendHolidayEmployees) {
          await runSendHolidayEmployees();
          api.logger.info('sent holiday employee announcement without a confirmation');
        } else if (isSendEarthquakeEmployees) {
          await runSendEarthquakeEmployees();
          api.logger.info('sent earthquake employee announcement without a confirmation');
        } else if (isEdit) {
          await runBeginEdit();
          api.logger.info('opened edit mode without model dispatch');
        } else if (isHolidayEdit) {
          await runBeginHolidayEdit();
          api.logger.info('opened holiday edit mode without model dispatch');
        } else if (isEarthquakeEdit) {
          await runBeginEarthquakeEdit();
          api.logger.info('opened earthquake edit mode without model dispatch');
        } else if (isDiscard) {
          await runDiscard();
          api.logger.info('discarded draft without model dispatch');
        } else if (isHolidayDiscard) {
          await runDiscardHoliday();
          api.logger.info('discarded holiday draft without model dispatch');
        } else if (isEarthquakeDiscard) {
          await runDiscardEarthquake();
          api.logger.info('discarded earthquake draft without model dispatch');
        } else if (isHolidayRevision) {
          await runRevisedHolidayDraft(content);
          api.logger.info('sent revised holiday draft preview without a redundant confirmation');
        } else if (isEarthquakeRevision) {
          await runRevisedEarthquakeDraft(content);
          api.logger.info('sent revised earthquake draft preview without a redundant confirmation');
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
