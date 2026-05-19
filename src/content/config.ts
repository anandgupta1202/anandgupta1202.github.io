import { defineCollection, z } from "astro:content";

const writing = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    source: z.string().default("anandgupta.net"),
    externalUrl: z.string().url().optional(),
    pinned: z.boolean().default(false),
    featuredRank: z.number().int().optional(),
    draft: z.boolean().default(false),
    heroImage: z.string().optional(),
    heroAlt: z.string().optional()
  })
});

export const collections = { writing };
