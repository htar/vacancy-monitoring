import * as cheerio from 'cheerio';
import type { EmploymentType, Vacancy } from '../types.js';
import { fetchHtml, truncate } from './utils.js';

interface ProviderParams {
  search: string;
  countryCode: string;
}

const EMPLOYMENT_TYPE_MAP: Record<string, EmploymentType> = {
  'Повна зайнятість': 'full-time',
  'Часткова зайнятість': 'part-time',
  Контракт: 'contract',
  Тимчасова: 'contract',
  Стажування: 'internship',
};

function mapEmploymentType(badgeTexts: string[]): EmploymentType {
  for (const text of badgeTexts) {
    if (EMPLOYMENT_TYPE_MAP[text]) return EMPLOYMENT_TYPE_MAP[text];
  }
  return 'full-time';
}

/** Парсить відносні дати BeBee: "Сьогодні", "Вчора", "3 дні тому", "2 тижні тому" тощо. */
function parseBebeeRelativeDate(text: string, now = new Date()): string {
  const normalized = text.trim().toLowerCase();
  if (!normalized || normalized.includes('сьогодні')) return now.toISOString();
  if (normalized.includes('вчора')) {
    return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  }

  const match = normalized.match(/(\d+)\s*(хвилин|год|дн|тижд|тижн|міс)/);
  if (!match) return now.toISOString();

  const amount = Number(match[1]);
  const unit = match[2]!;
  const unitMs: Record<string, number> = {
    хвилин: 60 * 1000,
    год: 60 * 60 * 1000,
    дн: 24 * 60 * 60 * 1000,
    тижд: 7 * 24 * 60 * 60 * 1000,
    тижн: 7 * 24 * 60 * 60 * 1000,
    міс: 30 * 24 * 60 * 60 * 1000,
  };

  return new Date(now.getTime() - amount * (unitMs[unit] ?? 0)).toISOString();
}

/** BeBee — україноцентричний джоб-борд, релевантний лише для UA (розділ /ua/jobs). */
export async function fetchBebeeVacancies({ search, countryCode }: ProviderParams): Promise<Vacancy[]> {
  if (countryCode && countryCode !== 'UA') return [];

  const url = `https://bebee.com/ua/jobs?q=${encodeURIComponent(search)}`;
  const html = await fetchHtml(url);
  if (!html) return [];

  const $ = cheerio.load(html);
  const vacancies: Vacancy[] = [];

  $('article').each((_, el) => {
    const node = $(el);
    const link = node.find('h3 a[href^="/ua/jobs/"]').first();
    const href = link.attr('href');
    if (!href) return;

    const title = truncate(link.text(), 200);
    const location = truncate(node.find('svg.lucide-map-pin').parent().text(), 120) || 'Не вказано';
    const company =
      truncate(node.find('svg.lucide-building-2').parent().find('.truncate').text(), 120) ||
      'Компанія не вказана';
    const description = truncate(node.find('p.line-clamp-2').text(), 320);

    const badgeTexts = node
      .find('div.flex-wrap span')
      .map((__, badge) => $(badge).text().trim())
      .get()
      .filter(Boolean);

    const dateText = node.find('svg.lucide-clock').parent().text();

    vacancies.push({
      id: `bebee-${href.split('--').pop() ?? href}`,
      title,
      company,
      location,
      countryCode: 'UA',
      description: description || 'Опис доступний на сторінці оголошення.',
      tags: [],
      employmentType: mapEmploymentType(badgeTexts),
      remote: badgeTexts.some((text) => /віддалено|гібрид/i.test(text)),
      postedAt: parseBebeeRelativeDate(dateText),
      source: 'bebee',
      url: `https://bebee.com${href}`,
    });
  });

  return vacancies;
}
