import * as cheerio from 'cheerio';
import type { Vacancy } from '../types.js';
import { fetchHtml, guessCountryCode, truncate } from './utils.js';

interface ProviderParams {
  search: string;
  countryCode: string;
}

const COUNTRY_CODE_TO_LOCATION: Record<string, string> = {
  UA: 'Ukraine',
  PL: 'Poland',
  DE: 'Germany',
  GB: 'United Kingdom',
  US: 'United States',
  NL: 'Netherlands',
  CA: 'Canada',
};

/**
 * Використовує публічну (без логіну) сторінку гостьового пошуку LinkedIn Jobs.
 * Це офіційно доступний без автентифікації маршрут, але LinkedIn може
 * обмежувати частоту запитів — тому результат кешується на бекенді.
 */
export async function fetchLinkedInVacancies({ search, countryCode }: ProviderParams): Promise<Vacancy[]> {
  const params = new URLSearchParams({ keywords: search || 'developer' });
  const location = COUNTRY_CODE_TO_LOCATION[countryCode];
  if (location) params.set('location', location);

  const html = await fetchHtml(`https://www.linkedin.com/jobs/search?${params.toString()}`);
  if (!html) return [];

  const $ = cheerio.load(html);
  const vacancies: Vacancy[] = [];

  $('li > div.base-card').each((_, el) => {
    const node = $(el);
    const link = node.find('a.base-card__full-link').first();
    const href = link.attr('href')?.split('?')[0];
    if (!href) return;

    const title = truncate(node.find('.base-search-card__title').text(), 200);
    const company = truncate(node.find('.base-search-card__subtitle').text(), 120);
    const locationText = truncate(node.find('.job-search-card__location').text(), 120);
    const dateAttr = node.find('time').attr('datetime');
    const urn = node.attr('data-entity-urn')?.match(/(\d+)$/)?.[1];

    vacancies.push({
      id: `linkedin-${urn ?? href}`,
      title,
      company: company || 'Компанія не вказана',
      location: locationText || 'Не вказано',
      countryCode: guessCountryCode(locationText) || countryCode || '',
      description: 'Повний опис вакансії доступний на сторінці LinkedIn.',
      tags: [],
      employmentType: 'full-time',
      remote: /remote|віддалено/i.test(locationText),
      postedAt: dateAttr ? new Date(dateAttr).toISOString() : new Date().toISOString(),
      source: 'linkedin',
      url: href,
    });
  });

  return vacancies;
}
