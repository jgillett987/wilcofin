import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const articles = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/articles' }),
  schema: z
    .object({
      title: z.string(),
      description: z.string(),
      // Either hard-code pubDate OR use daysAgo (offset from build date).
      // daysAgo is preferred — the date auto-advances with each build.
      pubDate: z.coerce.date().optional(),
      daysAgo: z.number().int().nonnegative().optional(),
      updatedDate: z.coerce.date().optional(),
      author: z.string().default('Wilco Financial'),
      tags: z.array(z.string()).default([]),
      heroImage: z.string().optional(),
      heroVideo: z.string().optional(),
      draft: z.boolean().default(false),
      featured: z.boolean().default(false),
    })
    .transform((data) => {
      if (data.daysAgo !== undefined) {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - data.daysAgo);
        return { ...data, pubDate: d };
      }
      if (!data.pubDate) {
        throw new Error('Article must have either pubDate or daysAgo in frontmatter.');
      }
      return { ...data, pubDate: data.pubDate };
    }),
});

const faqs = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/faqs' }),
  schema: z.object({
    question: z.string(),
    category: z.string().default('General'),
    order: z.number().default(100),
  }),
});

export const collections = { articles, faqs };
