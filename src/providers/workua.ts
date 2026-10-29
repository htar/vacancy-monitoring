import * as cheerio from 'cheerio';
import type { Vacancy } from '../types.js';
import { fetchHtml, truncate } from './utils.js';

interface ProviderParams {
  search: string;
  countryCode: string;
}

function buildSearchUrl(search: string): string {
  const slug = search.trim() ? search.trim().replace(/\s+/g, '+') : 'it';
  return `https://www.work.ua/jobs-${encodeURIComponent(slug).replace(/%2B/g, '+')}/`;
}

/** Work.ua — україноцентрична дошка вакансій, релевантна лише для UA. */
export async function fetchWorkUaVacancies({ search, countryCode }: ProviderParams): Promise<Vacancy[]> {
  if (countryCode && countryCode !== 'UA') return [];

  const html = await fetchHtml(buildSearchUrl(search));
  if (!html) return [];

  const $ = cheerio.load(html);
  const vacancies: Vacancy[] = [];

  $('div.card.job-link').each((_, el) => {
    const node = $(el);
    const link = node.find('h2 a[href^="/jobs/"]').first();
    const href = link.attr('href');
    if (!href) return;

    const title = truncate(link.text(), 200);
    const description = truncate(node.find('p.ellipsis').text(), 320);
    const dateAttr = node.find('time[datetime]').attr('datetime');

    // Компанія та локація сидять в одному блоці поряд з іконкою "компанія" —
    // вирізаємо назву компанії (усередині .strong-600), решта тексту лишається локацією.
    const infoBlock = node.find('.text-indent:has(.glyphicon-company)').first().clone();
    infoBlock.find('.glyphicon, ul').remove();
    const company = truncate(infoBlock.find('.strong-600').first().text(), 120);
    infoBlock.find('.strong-600').parent().remove();
    // truncate() спершу нормалізує пробіли/переноси рядків навколо коми — інакше "^,\s*"
    // не спрацює, якщо перед комою лишився текстовий вузол із самим лише переносом рядка.
    const location = truncate(infoBlock.text(), 120).replace(/^,\s*/, '') || 'Не вказано';

    const salaryText = node.find('.text-indent:has(.glyphicon-hryvnia-fill) .strong-600').first().text();
    const salaryNumbers = salaryText
      .replace(/[\s  ]/g, '')
      .match(/\d+/g)
      ?.map(Number)
      .filter((n) => n > 0);

    vacancies.push({
      id: `workua-${href.match(/\/jobs\/(\d+)/)?.[1] ?? href}`,
      title,
      company: company || 'Компанія не вказана',
      location,
      countryCode: 'UA',
      description: description || 'Опис доступний на сторінці оголошення.',
      tags: [],
      salaryFrom: salaryNumbers?.[0],
      salaryTo: salaryNumbers?.[1],
      currency: salaryNumbers?.length ? 'UAH' : undefined,
      employmentType: 'full-time',
      remote: /віддалено|remote/i.test(location + description),
      postedAt: dateAttr ? new Date(dateAttr).toISOString() : new Date().toISOString(),
      source: 'workua',
      url: `https://www.work.ua${href}`,
    });
  });

  return vacancies;
}
