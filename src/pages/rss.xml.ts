import rss from '@astrojs/rss';
import { SITE } from '../consts';
import type { APIContext } from 'astro';
import { getPublishedArticles } from '../lib/articles';

export async function GET(context: APIContext) {
  const articles = await getPublishedArticles();

  return rss({
    title: `${SITE.name} Articles`,
    description: SITE.shortDescription,
    site: context.site ?? SITE.url,
    items: articles.map((a) => ({
      title: a.data.title,
      pubDate: a.data.pubDate,
      description: a.data.description,
      link: `/articles/${a.id}`,
      categories: a.data.tags,
    })),
    customData: `<language>en-us</language>`,
  });
}
