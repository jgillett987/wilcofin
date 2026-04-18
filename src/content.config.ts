import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const articles = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/articles' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    // pubDate controls publication. Articles with a future pubDate are
    // hidden from the live site until the date has arrived (the daily
    // scheduled rebuild picks them up automatically).
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    author: z.string().default('Wilco Financial'),
    tags: z.array(z.string()).default([]),
    heroImage: z.string().optional(),
    heroVideo: z.string().optional(),
    draft: z.boolean().default(false),
    featured: z.boolean().default(false),
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
