import { getCollection, type CollectionEntry } from "astro:content";

export type WritingEntry = CollectionEntry<"writing">;

export async function getPublishedWriting() {
  const entries = await getCollection("writing", ({ data }) => {
    return !data.draft;
  });

  return entries.sort((a, b) => {
    return b.data.pubDate.valueOf() - a.data.pubDate.valueOf();
  });
}

export function sortFeaturedWriting(entries: WritingEntry[]) {
  return [...entries]
    .filter((entry) => entry.data.pinned)
    .sort((a, b) => {
      const rankA = a.data.featuredRank ?? 999;
      const rankB = b.data.featuredRank ?? 999;

      if (rankA !== rankB) return rankA - rankB;
      return b.data.pubDate.valueOf() - a.data.pubDate.valueOf();
    });
}

export function getWritingUrl(entry: WritingEntry) {
  return entry.data.externalUrl ?? `/blog/${entry.id}/`;
}

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    year: "numeric"
  }).format(date);
}

export function formatFullDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(date);
}
