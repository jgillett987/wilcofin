import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { SITE } from '../consts';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const articles = (await getCollection('articles', ({ data }) => !data.draft))
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());

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
