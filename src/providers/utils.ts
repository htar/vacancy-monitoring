const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const DEFAULT_TIMEOUT_MS = 8000;

/**
 * Легкий агрегатор публічних оголошень: не логінимось і не обходимо
 * анти-бот захист — якщо джерело відповідає помилкою чи блокує запит,
 * провайдер просто повертає порожній список.
 */
export async function fetchHtml(url: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': BROWSER_USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'uk-UA,uk;q=0.9,en;q=0.8',
      },
    });

    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

const UA_MONTHS: Record<string, number> = {
  січня: 0,
  лютого: 1,
  березня: 2,
  квітня: 3,
  травня: 4,
  червня: 5,
  липня: 6,
  серпня: 7,
  вересня: 8,
  жовтня: 9,
  листопада: 10,
  грудня: 11,
};

/** Парсить дати у форматі DOU/Djinni на кшталт "31 липня" (без року). */
export function parseUkrainianRelativeDate(text: string, now = new Date()): string {
  const match = text.trim().match(/(\d{1,2})\s+([а-яіїєґ]+)/iu);
  if (!match) return now.toISOString();

  const day = Number(match[1]);
  const month = UA_MONTHS[match[2]!.toLowerCase()];
  if (month === undefined) return now.toISOString();

  // Дата — лише день+місяць, без часового поясу; будуємо в UTC, щоб результат не залежав
  // від того, де фізично запущено сервер (dev-машина в Києві vs UTC на serverless-хостингу
  // дали б різні дні для того самого "1 серпня", якби рахувати в локальному часі).
  let candidate = Date.UTC(now.getUTCFullYear(), month, day);
  // Дати вакансій завжди в минулому — якщо вийшло "у майбутньому", беремо торішній рік.
  if (candidate > now.getTime() + 24 * 60 * 60 * 1000) {
    candidate = Date.UTC(now.getUTCFullYear() - 1, month, day);
  }
  return new Date(candidate).toISOString();
}

const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  україна: 'UA',
  ukraine: 'UA',
  poland: 'PL',
  польща: 'PL',
  germany: 'DE',
  німеччина: 'DE',
  uk: 'GB',
  'united kingdom': 'GB',
  'велика британія': 'GB',
  us: 'US',
  usa: 'US',
  'united states': 'US',
  сша: 'US',
  netherlands: 'NL',
  нідерланди: 'NL',
  canada: 'CA',
  канада: 'CA',
  // Решта Європи — потрібно переважно для міжнародних джерел (Levels.fyi, Greenhouse).
  france: 'FR',
  франція: 'FR',
  spain: 'ES',
  іспанія: 'ES',
  italy: 'IT',
  італія: 'IT',
  portugal: 'PT',
  португалія: 'PT',
  ireland: 'IE',
  ірландія: 'IE',
  sweden: 'SE',
  швеція: 'SE',
  austria: 'AT',
  австрія: 'AT',
  switzerland: 'CH',
  швейцарія: 'CH',
  belgium: 'BE',
  бельгія: 'BE',
  czechia: 'CZ',
  'czech republic': 'CZ',
  чехія: 'CZ',
  romania: 'RO',
  румунія: 'RO',
  denmark: 'DK',
  данія: 'DK',
  finland: 'FI',
  фінляндія: 'FI',
  norway: 'NO',
  норвегія: 'NO',
  hungary: 'HU',
  угорщина: 'HU',
  greece: 'GR',
  греція: 'GR',
  bulgaria: 'BG',
  болгарія: 'BG',
  estonia: 'EE',
  естонія: 'EE',
  lithuania: 'LT',
  литва: 'LT',
  latvia: 'LV',
  латвія: 'LV',
  luxembourg: 'LU',
  люксембург: 'LU',
};

// JS-регекс \b орієнтується лише на латинські [A-Za-z0-9_] — з кириличним текстом він
// поводиться непередбачувано (не бачить меж навколо кириличних літер узагалі). Тому межі
// слова власноруч перевіряємо лише для КОРОТКИХ абревіатур (us/uk/usa), де без цього
// підрядок хибно збігався б усередині випадкових слів (наприклад, "us" — підрядок у
// "focus", "campus", "bonus"). Довгі назви країн (з 4+ символів) лишаємо як простий
// підрядок — там випадковий колізійний збіг практично неможливий.
const SHORT_NAME_MAX_LENGTH = 3;
const LETTER_CLASS = 'a-zа-яіїєґ';

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchesWithBoundary(normalized: string, name: string): boolean {
  if (name.length > SHORT_NAME_MAX_LENGTH) return normalized.includes(name);
  const pattern = new RegExp(`(?:^|[^${LETTER_CLASS}])${escapeRegExp(name)}(?:$|[^${LETTER_CLASS}])`);
  return pattern.test(normalized);
}

export function guessCountryCode(text: string | null | undefined): string {
  if (!text) return '';
  const normalized = text.trim().toLowerCase();
  for (const [name, code] of Object.entries(COUNTRY_NAME_TO_CODE)) {
    if (matchesWithBoundary(normalized, name)) return code;
  }
  return '';
}

const GENERIC_REMOTE_LABELS = new Set([
  'remote',
  'worldwide',
  'global',
  'anywhere',
  'remote worldwide',
  'fully remote',
  'віддалено',
]);

/**
 * true лише коли рядок локації НЕ називає жодної конкретної країни — просто "Remote"/
 * "Worldwide" тощо. "Remote - Singapore" чи "Remote, Germany" — це НЕ глобально відкрита
 * вакансія, а прив'язана до конкретної (можливо, нерозпізнаної нашою мапою) країни, тож
 * не повинна огинати фільтр країни лише через слово "remote" десь у рядку.
 */
export function isGenericallyRemoteLabel(location: string): boolean {
  const stripped = location
    .trim()
    .toLowerCase()
    .replace(/[-–—,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return GENERIC_REMOTE_LABELS.has(stripped);
}

/** Англійська назва країни за кодом — потрібна для побудови URL міжнародних джерел. */
const COUNTRY_CODE_TO_ENGLISH_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(COUNTRY_NAME_TO_CODE)
    .filter(([name]) => /^[a-z\s]+$/.test(name))
    .map(([name, code]) => [code, name])
);

export function countryCodeToEnglishName(code: string): string | undefined {
  return COUNTRY_CODE_TO_ENGLISH_NAME[code.toUpperCase()];
}

export function stripHtmlWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function truncate(text: string, maxLength: number): string {
  const clean = stripHtmlWhitespace(text);
  return clean.length > maxLength ? `${clean.slice(0, maxLength - 1)}…` : clean;
}
