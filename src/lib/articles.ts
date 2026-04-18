// Shared helpers for querying articles.
// Articles with a future pubDate are treated as scheduled drafts:
// they don't appear on the live site until the daily build runs after
// their pubDate has arrived.

import { getCollection, type CollectionEntry } from 'astro:content';

export const isPublished = (a: CollectionEntry<'articles'>) => {
  if (a.data.draft) return false;
  return a.data.pubDate.valueOf() <= Date.now();
};

export const getPublishedArticles = async () => {
  const all = await getCollection('articles');
  return all
    .filter(isPublished)
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
};
