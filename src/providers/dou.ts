import * as cheerio from 'cheerio';
import type { Vacancy } from '../types.js';
import { fetchHtml, parseUkrainianRelativeDate, truncate } from './utils.js';

interface ProviderParams {
  search: string;
  countryCode: string;
}

/** DOU — україноцентрична дошка вакансій, релевантна лише для UA. */
export async function fetchDouVacancies({ search, countryCode }: ProviderParams): Promise<Vacancy[]> {
  if (countryCode && countryCode !== 'UA') return [];

  const url = `https://jobs.dou.ua/vacancies/?search=${encodeURIComponent(search)}`;
  const html = await fetchHtml(url);
  if (!html) return [];

  const $ = cheerio.load(html);
  const vacancies: Vacancy[] = [];

  $('li.l-vacancy').each((_, el) => {
    const node = $(el);
    const link = node.find('a.vt');
    const href = link.attr('href');
    if (!href) return;

    const title = truncate(link.text(), 200);
    const company = truncate(node.find('a.company').text(), 120);
    const location = truncate(node.find('.cities').text(), 120) || 'Не вказано';
    const description = truncate(node.find('.sh-info').text(), 320);
    const dateText = node.find('.date').text();
    const salaryText = node.find('.salary').text();

    const salaryMatch = salaryText.match(/(\d[\d\s]*)\s*[–-]?\s*(\d[\d\s]*)?/);
    const salaryFrom = salaryMatch?.[1] ? Number(salaryMatch[1].replace(/\s/g, '')) : undefined;
    const salaryTo = salaryMatch?.[2] ? Number(salaryMatch[2].replace(/\s/g, '')) : undefined;

    const idMatch = href.match(/vacancies\/(\d+)/);

    vacancies.push({
      id: `dou-${idMatch?.[1] ?? Buffer.from(href).toString('base64url')}`,
      title,
      company,
      location,
      countryCode: 'UA',
      description: description || 'Опис доступний на сторінці оголошення.',
      tags: [],
      salaryFrom,
      salaryTo,
      currency: salaryFrom || salaryTo ? 'USD' : undefined,
      employmentType: 'full-time',
      remote: /віддалено|remote/i.test(location),
      postedAt: parseUkrainianRelativeDate(dateText),
      source: 'dou',
      url: href,
    });
  });

  return vacancies;
}
