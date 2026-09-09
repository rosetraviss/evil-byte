// Approximates "local time at the source" for the batch/log-based pipeline,
// where Cloudflare's own cf.timezone (used live by site/src/index.js) isn't
// available — Log Explorer rows carry ClientCountry/ClientRegionCode, not a
// resolved IANA zone. This table is intentionally partial: countries not
// listed fall back to UTC rather than guessing. This is the plan's largest
// documented fidelity loss versus the live worker, concentrated in large
// multi-timezone countries — extend COUNTRY_TZ/REGION_TZ if the dashboard's
// distribution analysis shows it matters.
//
// localTimePartsAt() is the same shape as site/src/index.js's
// localTimeParts() (lines 144-166), adapted to take an explicit event
// timestamp (EdgeStartTimestamp) instead of "now", since this runs well
// after the request itself happened.

const DEFAULT_TZ = "Etc/UTC";

// One representative IANA zone per country (ISO 3166-1 alpha-2).
const COUNTRY_TZ = {
  US: "America/New_York", CA: "America/Toronto", MX: "America/Mexico_City",
  BR: "America/Sao_Paulo", AR: "America/Argentina/Buenos_Aires", CL: "America/Santiago",
  CO: "America/Bogota", PE: "America/Lima", VE: "America/Caracas", EC: "America/Guayaquil",

  GB: "Europe/London", IE: "Europe/Dublin", PT: "Europe/Lisbon",
  FR: "Europe/Paris", DE: "Europe/Berlin", ES: "Europe/Madrid", IT: "Europe/Rome",
  NL: "Europe/Amsterdam", BE: "Europe/Brussels", CH: "Europe/Zurich", AT: "Europe/Vienna",
  SE: "Europe/Stockholm", NO: "Europe/Oslo", DK: "Europe/Copenhagen", FI: "Europe/Helsinki",
  PL: "Europe/Warsaw", CZ: "Europe/Prague", SK: "Europe/Bratislava", HU: "Europe/Budapest",
  RO: "Europe/Bucharest", BG: "Europe/Sofia", GR: "Europe/Athens", UA: "Europe/Kyiv",
  RU: "Europe/Moscow", TR: "Europe/Istanbul", IL: "Asia/Jerusalem",

  CN: "Asia/Shanghai", JP: "Asia/Tokyo", KR: "Asia/Seoul", IN: "Asia/Kolkata",
  ID: "Asia/Jakarta", TH: "Asia/Bangkok", VN: "Asia/Ho_Chi_Minh", PH: "Asia/Manila",
  MY: "Asia/Kuala_Lumpur", SG: "Asia/Singapore", HK: "Asia/Hong_Kong", TW: "Asia/Taipei",
  PK: "Asia/Karachi", BD: "Asia/Dhaka", AE: "Asia/Dubai", SA: "Asia/Riyadh",

  AU: "Australia/Sydney", NZ: "Pacific/Auckland",

  ZA: "Africa/Johannesburg", NG: "Africa/Lagos", EG: "Africa/Cairo", KE: "Africa/Nairobi",
  MA: "Africa/Casablanca",
};

// Regional refinements for the largest multi-timezone countries, keyed by
// `${countryCode}-${ClientRegionCode}`. Unmatched regions fall back to the
// country's primary zone in COUNTRY_TZ above.
const REGION_TZ = {
  "US-AK": "America/Anchorage", "US-HI": "Pacific/Honolulu",
  "US-CA": "America/Los_Angeles", "US-WA": "America/Los_Angeles", "US-OR": "America/Los_Angeles", "US-NV": "America/Los_Angeles",
  "US-AZ": "America/Phoenix",
  "US-CO": "America/Denver", "US-UT": "America/Denver", "US-NM": "America/Denver",
  "US-TX": "America/Chicago", "US-IL": "America/Chicago", "US-MN": "America/Chicago",

  "CA-BC": "America/Vancouver", "CA-AB": "America/Edmonton",
  "CA-ON": "America/Toronto", "CA-QC": "America/Toronto", "CA-NS": "America/Halifax",

  "RU-MOW": "Europe/Moscow", "RU-SPE": "Europe/Moscow",
  "RU-NVS": "Asia/Novosibirsk", "RU-KHA": "Asia/Vladivostok", "RU-PRI": "Asia/Vladivostok",

  "AU-WA": "Australia/Perth", "AU-SA": "Australia/Adelaide", "AU-QLD": "Australia/Brisbane", "AU-NT": "Australia/Darwin",

  "BR-AM": "America/Manaus", "BR-AC": "America/Rio_Branco",
};

export function approximateTimezone(countryCode, regionCode) {
  const cc = (countryCode || "").toUpperCase();
  if (regionCode) {
    const refined = REGION_TZ[`${cc}-${regionCode}`.toUpperCase()];
    if (refined) return refined;
  }
  return COUNTRY_TZ[cc] || DEFAULT_TZ;
}

const formatterCache = new Map();

function getFormatter(tz) {
  if (formatterCache.has(tz)) return formatterCache.get(tz);
  let fmt;
  try {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hour12: false, hour: "2-digit", minute: "2-digit",
      weekday: "short", month: "2-digit", day: "2-digit",
    });
  } catch {
    fmt = null; // invalid/unsupported zone name — caller falls back to UTC
  }
  formatterCache.set(tz, fmt);
  return fmt;
}

export function localTimePartsAt(date, tz) {
  const fmt = getFormatter(tz) || getFormatter(DEFAULT_TZ);
  let parts;
  try {
    parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  } catch {
    parts = { hour: "00", minute: "00", weekday: "Thu", month: "01", day: "01" };
  }
  const hour = Number(parts.hour) % 24;
  const isFriday = parts.weekday === "Fri";
  const isAprilFirst = parts.month === "04" && parts.day === "01";
  const localLabel = `${parts.weekday} ${parts.hour}:${parts.minute}`;
  return { hour, isFriday, isAprilFirst, localLabel };
}
