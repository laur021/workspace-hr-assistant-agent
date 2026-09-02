import { readFileSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { definePluginEntry } from 'openclaw/plugin-sdk/plugin-entry';

const HR_DRAFTS_SESSION = 'agent:hr-assistant-agent:telegram:group:-1003702195046';
const WORKSPACE = 'C:\\Users\\markmb\\.openclaw\\workspace-hr-assistant-agent';
const WEATHER_SCRIPT = `${WORKSPACE}\\scripts\\hr-weather-check.mjs`;
const SEND_SCRIPT = `${WORKSPACE}\\scripts\\hr-send.mjs`;
const OUTBOX_PATH = `${WORKSPACE}\\state\\outbox.json`;
const STATE_PATH = `${WORKSPACE}\\state\\hr-weather.json`;
const HR_DRAFTS = '-1003702195046';
const ABC_EMPLOYEES = '-1004452958432';

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

export default definePluginEntry({
  id: 'hr-single-delivery-guard',
  name: 'HR Single Delivery Guard',
  description: 'Handles HR weather actions without duplicate confirmations or monitoring prompts.',
  register(api) {
    api.on('before_dispatch', async (event, ctx) => {
      if (ctx.sessionKey !== HR_DRAFTS_SESSION) return;
      const content = event.content.trim();
      const isWeatherCommand = /^\/check_weather(?:@[A-Za-z0-9_]+)?(?:\s|$)/i.test(content);
      const isComposeDraft = /(?:callback_data\s*:\s*)?compose_draft\b/i.test(content);
      const isSendEmployees = /(?:callback_data\s*:\s*)?send_employees\b/i.test(content);
      const isEdit = /(?:callback_data\s*:\s*)?edit\b/i.test(content);
      const isDiscard = /(?:callback_data\s*:\s*)?discard\b/i.test(content);
      const isCallback = /^callback_data\s*:/i.test(content);
      const isPlainText = Boolean(content) && !isCallback && !content.startsWith('/');
      let isRevision = false;
      if (isPlainText) {
        try {
          isRevision = readWorkflowState().awaitingEdit === true;
        } catch {
          isRevision = false;
        }
      }
      if (!isWeatherCommand && !isComposeDraft && !isSendEmployees && !isEdit && !isDiscard && !isRevision) return;
      try {
        if (isWeatherCommand) {
          await runManualWeatherCheck();
          api.logger.info('sent the single /check_weather advisory without model dispatch');
        } else if (isComposeDraft) {
          await runComposeDraft();
          api.logger.info('sent the draft preview without a redundant confirmation');
        } else if (isSendEmployees) {
          await runSendEmployees();
          api.logger.info('sent employee announcement without a monitoring prompt');
        } else if (isEdit) {
          await runBeginEdit();
          api.logger.info('opened edit mode without model dispatch');
        } else if (isDiscard) {
          await runDiscard();
          api.logger.info('discarded draft without model dispatch');
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
