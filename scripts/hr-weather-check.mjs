// scripts/hr-weather-check.mjs
// HR weather advisory — deterministic scheduled check.
//
// Modes (argv):
//   node hr-weather-check.mjs            -> full run: fetch, decide, send advisory, update state
//   node hr-weather-check.mjs --dry-run  -> full run but do NOT send and do NOT write state
//   node hr-weather-check.mjs --report   -> fetch weather only; print severity; no state/send
//
// Exit 0 on success, non-zero on error (so a command payload records ok/error).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKSPACE = join(__dirname, '..');
const STATE_PATH = join(WORKSPACE, 'state', 'hr-weather.json');
const OPENCLAW_CLI = 'C:\\Users\\markmb\\AppData\\Roaming\\npm\\node_modules\\openclaw\\openclaw.mjs';

const LOCATION = {
  name: 'Metro Manila, Philippines',
  lat: 14.5995,
  lon: 120.9842,
  tz: 'Asia/Manila',
};

const HR_DRAFTS = '-1003702195046';      // HR Weather Drafts (supergroup)
const ABC_EMPLOYEES = '-1004452958432';  // ABC Employee Announcement (supergroup)
const SEND_THRESHOLD = 2;             // advisory fires when severity >= 2

// WMO weather code -> [description, base severity]
const WMO = {
  0: ['Clear sky', 0],
  1: ['Mainly clear', 0],
  2: ['Partly cloudy', 0],
  3: ['Overcast', 0],
  45: ['Fog', 0],
  48: ['Depositing rime fog', 0],
  51: ['Light drizzle', 1],
  53: ['Moderate drizzle', 1],
  55: ['Dense drizzle', 1],
  56: ['Light freezing drizzle', 1],
  57: ['Dense freezing drizzle', 2],
  61: ['Slight rain', 1],
  63: ['Moderate rain', 2],
  65: ['Heavy rain', 3],
  66: ['Light freezing rain', 2],
  67: ['Heavy freezing rain', 3],
  71: ['Slight snow', 1],
  73: ['Moderate snow', 2],
  75: ['Heavy snow', 3],
  77: ['Snow grains', 1],
  80: ['Slight rain showers', 1],
  81: ['Moderate rain showers', 2],
  82: ['Violent rain showers', 3],
  85: ['Slight snow showers', 1],
  86: ['Heavy snow showers', 3],
  95: ['Thunderstorm', 3],
  96: ['Thunderstorm with slight hail', 3],
  99: ['Thunderstorm with heavy hail', 3],
};

function localDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: LOCATION.tz }).format(new Date());
}

function defaultState() {
  return {
    location: LOCATION,
    sendThreshold: SEND_THRESHOLD,
    monitoring: true,
    monitoringDate: localDate(),
    lastSentLevel: 0,
    lastSentAt: null,
    lastAdvisoryMessageId: null,
    draft: null,
    awaitingEdit: false,
  };
}

function readState() {
  try {
    return JSON.parse(readFileSync(STATE_PATH, 'utf8'));
  } catch {
    return defaultState();
  }
}

function writeState(state) {
  mkdirSync(join(WORKSPACE, 'state'), { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + '\n', 'utf8');
}

async function fetchWeather() {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${LOCATION.lat}&longitude=${LOCATION.lon}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_gusts_10m` +
    `&daily=weather_code,precipitation_sum,wind_gusts_10m_max,temperature_2m_max,temperature_2m_min` +
    `&timezone=${encodeURIComponent(LOCATION.tz)}&forecast_days=2`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
  const data = await res.json();

  const c = data.current;
  const d = data.daily;
  const code = c.weather_code;
  const [condition] = WMO[code] || ['Unknown', 0];

  const gust = Number(c.wind_gusts_10m || 0);
  const wind = Number(c.wind_speed_10m || 0);
  const precipNow = Number(c.precipitation || 0);
  const precipToday = Number(d.precipitation_sum?.[0] || 0);

  const severity = computeSeverity(
    code,
    wind,
    gust,
    precipToday,
    d.weather_code?.[0],
    Number(d.wind_gusts_10m_max?.[0] || 0),
  );

  return {
    ok: true,
    location: LOCATION.name,
    tz: LOCATION.tz,
    fetchedAt: new Date().toISOString(),
    localDate: localDate(),
    current: {
      condition,
      code,
      temp_c: c.temperature_2m,
      apparent_c: c.apparent_temperature,
      humidity_pct: c.relative_humidity_2m,
      wind_kmh: wind,
      gust_kmh: gust,
      precip_mm: precipNow,
    },
    forecast: {
      today_code: d.weather_code?.[0],
      precip_today_mm: precipToday,
      gust_max_kmh: d.wind_gusts_10m_max?.[0],
      temp_max_c: d.temperature_2m_max?.[0],
      temp_min_c: d.temperature_2m_min?.[0],
    },
    severity,
    recommendation: recommendation(severity),
    storm: null, // reserved: named-storm detection (best-effort, v2)
  };
}

function computeSeverity(code, wind, gust, precipToday, forecastCode, gustMax) {
  const base = Math.max(WMO[code]?.[1] || 0, WMO[forecastCode]?.[1] || 0);
  let level = base;
  const maxGust = Math.max(Number(gust) || 0, Number(gustMax) || 0);
  if (maxGust >= 80) level = Math.max(level, 3);
  else if (maxGust >= 60) level = Math.max(level, 2);
  else if (maxGust >= 40) level = Math.max(level, 1);
  if (wind >= 50) level = Math.max(level, 2);
  if (precipToday >= 100) level = Math.max(level, 3);
  else if (precipToday >= 50) level = Math.max(level, 2);
  else if (precipToday >= 15) level = Math.max(level, 1);
  return level;
}

function recommendation(level) {
  if (level >= 3) {
    return 'Severe weather — advise employees to work from home where possible; non-essential travel discouraged. Dress down (casual, safe attire).';
  }
  if (level >= 2) {
    return 'Heavy rain / strong wind — dress down recommended (casual, safe attire); allow extra travel time.';
  }
  if (level >= 1) {
    return 'Light rain / wind — bring an umbrella; commute may be slower.';
  }
  return 'No advisory needed.';
}

function buildAdvisoryText(w) {
  const f = w.forecast;
  const fDesc = (WMO[f.today_code] || [null])[0];
  const curLevel = (WMO[w.current.code] || [null, 0])[1];
  const fcLevel = (WMO[f.today_code] || [null, 0])[1];
  const conditionLine =
    fDesc && f.today_code !== w.current.code && fcLevel > curLevel
      ? `${w.current.condition} (${fDesc.toLowerCase()} expected today)`
      : w.current.condition;
  const lines = [
    '🌧️ Weather Advisory',
    '',
    `Location: ${w.location}`,
    `Condition: ${conditionLine}`,
    `Temp: ${w.current.temp_c}°C (feels ${w.current.apparent_c}°C)`,
    `Wind: ${w.current.wind_kmh} km/h, gusts up to ${w.current.gust_kmh} km/h`,
  ];
  if (f.gust_max_kmh != null && f.gust_max_kmh > w.current.gust_kmh) {
    lines.push(`Expected gusts up to ${f.gust_max_kmh} km/h today`);
  }
  lines.push(`Rain today: ${f.precip_today_mm} mm`);
  if (w.storm) lines.push(`Storm: ${w.storm}`);
  lines.push('');
  lines.push(w.recommendation);
  lines.push('');
  lines.push('Choose an action below.');
  return lines.join('\n');
}

function buttonsJson(buttons) {
  // Plain `value` callbacks are routed to the agent as callback_data.  Do not
  // use `action: { type: 'callback' }` here: that reserves the button for a
  // plugin interactive handler and causes an unavailable-action response.
  return JSON.stringify({ blocks: [{ type: 'buttons', buttons }] });
}

function sendTelegram(target, text, presentationJson) {
  const args = [
    OPENCLAW_CLI, 'message', 'send',
    '--channel', 'telegram',
    '--account', 'hr-assistant',
    '--target', target,
    '--message', text,
    '--presentation', presentationJson,
    '--json',
  ];
  const res = spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 45000 });
  const out = (res.stdout || '').trim();
  const err = (res.stderr || '').trim();
  if (res.status !== 0) {
    throw new Error(`message send failed (exit ${res.status}): ${err || out}`);
  }
  let messageId = null;
  try {
    const j = JSON.parse(out);
    messageId = j.messageId ?? j.id ?? j?.result?.messageId ?? j?.result?.id ?? null;
  } catch {
    /* keep raw */
  }
  return { messageId, raw: out };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const reportOnly = args.includes('--report');

  const w = await fetchWeather();

  if (reportOnly) {
    console.log(JSON.stringify(w, null, 2));
    return;
  }

  let state = readState();
  const today = localDate();
  if (!state.monitoringDate || state.monitoringDate !== today) {
    // New day: reset monitoring.
    state.monitoring = true;
    state.monitoringDate = today;
    state.lastSentLevel = 0;
  }

  const level = w.severity;
  const escalated = level > state.lastSentLevel;
  // Send on first detection or escalation (level 2+), never re-spam the same level.
  // Escalation always breaks through, regardless of the stop/continue monitoring flag.
  const sendNow = level >= SEND_THRESHOLD && escalated;

  if (!sendNow) {
    console.log(JSON.stringify({
      sent: false,
      level,
      monitoring: state.monitoring,
      lastSentLevel: state.lastSentLevel,
      reason: level < SEND_THRESHOLD ? 'below advisory threshold' : 'no change or no escalation',
    }));
    // persist the day-rollover reset even when skipping
    writeState(state);
    return;
  }

  const text = buildAdvisoryText(w);
  const presentation = buttonsJson([
    { label: 'Compose a draft', value: 'compose_draft' },
  ]);

  if (dryRun) {
    console.log(JSON.stringify({
      sent: false,
      dryRun: true,
      level,
      wouldSend: { target: HR_DRAFTS, text, presentation },
    }, null, 2));
    return;
  }

  const sent = sendTelegram(HR_DRAFTS, text, presentation);

  state.lastSentLevel = level;
  state.lastSentAt = new Date().toISOString();
  state.lastAdvisoryMessageId = sent.messageId;
  state.draft = null;
  state.awaitingEdit = false;
  writeState(state);

  console.log(JSON.stringify({ sent: true, level, messageId: sent.messageId }));
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: String((e && e.message) || e) }));
  process.exit(1);
});
