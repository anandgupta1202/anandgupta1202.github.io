import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const writing = defineCollection({
  loader: glob({ pattern: "**/*.(md|mdx)", base: "./src/content/writing" }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string(),
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      tags: z.array(z.string()).default([]),
      source: z.string().default("anandgupta.net"),
      externalUrl: z.url().optional(),
      pinned: z.boolean().default(false),
      featuredRank: z.number().int().optional(),
      draft: z.boolean().default(false),
      heroImage: image().optional(),
      heroAlt: z.string().optional()
    })
});

export const collections = { writing };
