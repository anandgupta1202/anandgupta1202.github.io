# Content Guide

This site keeps writing content separate from the page layout. Most blog updates happen in:

- `src/content/writing/` for blog posts and external writing cards
- `public/blog/images/` for blog images
- `src/data/profile.json` for profile, social links, project cards, and tech groups

Run this before pushing content changes:

```sh
npm run build
```

## Writing Model

Every writing item is one Markdown file in `src/content/writing/`.

There are two kinds of writing items:

1. **Local blog posts**: full posts written in this repo. They generate pages at `/blog/<slug>/`.
2. **External writing cards**: cards that appear on the site but redirect to another site such as Medium, Substack, or another blog.

The file name becomes the slug. For example:

```text
src/content/writing/my-new-post.md
```

generates:

```text
/blog/my-new-post/
```

Use lowercase file names with hyphens:

```text
good:   ai-evaluation-notes.md
avoid:  AI Evaluation Notes.md
```

## Frontmatter Fields

Each writing file starts with frontmatter between `---` lines.

```yaml
---
title: "My post title"
description: "Short summary shown on cards and in metadata."
pubDate: 2026-05-19
updatedDate: 2026-05-19
tags: ["AI", "Product", "Notes"]
source: "anandgupta.net"
externalUrl:
pinned: false
featuredRank:
draft: false
heroImage: "/blog/images/my-image.jpg"
heroAlt: "Short description of the image"
---
```

Field meanings:

- `title`: The visible title.
- `description`: The card summary and page meta description.
- `pubDate`: Publication date in `YYYY-MM-DD` format.
- `updatedDate`: Optional last-updated date.
- `tags`: Card/post tags. Use short labels.
- `source`: Where the writing lives. Examples: `anandgupta.net`, `Medium`, `Substack`.
- `externalUrl`: Add this only when the card should redirect to another site.
- `pinned`: Set to `true` to show the item on the home page recent writing section.
- `featuredRank`: Controls home page order for pinned items. Lower numbers appear first.
- `draft`: Set to `true` to hide from production builds.
- `heroImage`: Optional image path for local posts.
- `heroAlt`: Required if `heroImage` is set. Describe the image plainly.

## Add A Brand New Local Blog

1. Create a new Markdown file:

```text
src/content/writing/my-new-blog.md
```

2. Add frontmatter:

```md
---
title: "My New Blog"
description: "A one sentence description of what the post is about."
pubDate: 2026-05-19
tags: ["AI", "Product"]
source: "anandgupta.net"
pinned: false
draft: false
heroImage: "/blog/images/my-new-blog-hero.jpg"
heroAlt: "A descriptive alt text for the hero image"
---

Start writing your post here.
```

3. Write the post below the frontmatter using Markdown.

4. Run:

```sh
npm run build
```

5. Visit:

```text
/blog/my-new-blog/
```

## Markdown Format For Blog Posts

Use normal Markdown.

```md
## Section heading

Paragraph text goes here.

- Bullet one
- Bullet two

### Smaller heading

[Link text](https://example.com)

`inline code`
```

For code blocks:

````md
```python
def hello():
    print("hello")
```
````

For callouts, use HTML with the existing notice class:

```md
<div class="notice">
  <strong>Note</strong><br />
  This is a short highlighted note inside the post.
</div>
```

## Add Pictures To A Blog

Put images in:

```text
public/blog/images/
```

Example:

```text
public/blog/images/my-diagram.png
```

Reference it in Markdown like this:

```md
![Diagram showing model flow](/blog/images/my-diagram.png)
```

For a figure with a caption:

```md
<figure>
  <img src="/blog/images/my-diagram.png" alt="Diagram showing model flow" />
  <figcaption>Diagram showing model flow.</figcaption>
</figure>
```

Recommended image formats:

- `.jpg` for photos
- `.png` for screenshots, diagrams, and images that need crisp edges
- `.webp` for optimized web images
- `.svg` only for simple vector diagrams or logos

Keep image names lowercase and hyphenated:

```text
good:   llm-eval-flow.png
avoid:  LLM Eval Flow Final.png
```

## Add A Hero Image

Add the image to:

```text
public/blog/images/
```

Then set these fields in the blog frontmatter:

```yaml
heroImage: "/blog/images/my-hero.jpg"
heroAlt: "Description of the hero image"
```

The image will appear at the top of the local blog page.

## Add A Card That Redirects To Another Site

Create a Markdown file in `src/content/writing/`, but add `externalUrl`.

Example:

```md
---
title: "My Medium Essay"
description: "Short summary of the external essay."
pubDate: 2026-05-19
tags: ["AI", "Writing"]
source: "Medium"
externalUrl: "https://medium.com/@anand.gupta1202/my-essay"
pinned: false
draft: false
---

This body is optional for external cards. The site uses the frontmatter for the card.
```

Behavior:

- The card appears on `/blog/`.
- The card links directly to `externalUrl`.
- No local `/blog/<slug>/` page is generated for this item.

For Substack:

```yaml
source: "Substack"
externalUrl: "https://your-substack-url.example.com/p/post-slug"
```

For another custom blog:

```yaml
source: "My Blog"
externalUrl: "https://example.com/my-post"
```

## Show A Writing Card On The Home Page

The home page recent writing section only shows items where:

```yaml
pinned: true
```

Example:

```yaml
pinned: true
featuredRank: 1
```

This works for both:

- local blog posts
- external writing cards

## Reorder The Home Page Recent Writing Section

Use `featuredRank`.

Lower numbers appear first:

```yaml
pinned: true
featuredRank: 1
```

```yaml
pinned: true
featuredRank: 2
```

```yaml
pinned: true
featuredRank: 3
```

If two pinned items have the same rank, the newer `pubDate` appears first.

The home page currently shows the first three pinned items:

```ts
sortFeaturedWriting(writing).slice(0, 3)
```

To show more or fewer, update `src/pages/index.astro`.

## Hide A Draft

Set:

```yaml
draft: true
```

Draft behavior:

- Hidden from production builds.
- Visible during local development.

Use this when you are still writing a post.

## Blog Page Ordering

The `/blog/` page shows all published writing sorted by `pubDate`, newest first.

Pinned status does not affect the `/blog/` page order. It only affects the home page recent writing section.

## Source Logos

The visible source mark on writing cards comes from `source`.

Current behavior:

- `source: "Medium"` shows a Medium logo.
- `source: "Substack"` shows a Substack-style logo.
- Any other source shows the site monogram fallback.

The component is:

```text
src/components/SourceLogo.astro
```

## Edit Profile, Social Links, And Project Cards

Edit:

```text
src/data/profile.json
```

Useful sections:

- `headlinePhrases`: animated hero phrases
- `identityRows`: right-side hero facts
- `socialLinks`: top-right social buttons
- `projects`: cards on `/code/` and selected home page project cards
- `techGroups`: stack chips on `/code/`

To hide a social link without deleting it:

```json
{
  "label": "Medium",
  "url": "https://medium.com/@anand.gupta1202",
  "enabled": false
}
```

To show it later:

```json
"enabled": true
```

## Add Or Reorder Project Cards

Project cards live in `src/data/profile.json`.

Example:

```json
{
  "name": "Project name",
  "description": "Short project description.",
  "url": "https://github.com/anandgupta1202/project",
  "platform": "GitHub",
  "tags": ["AI", "Python"],
  "pinned": true
}
```

Behavior:

- `/code/` shows all projects.
- The home page shows projects where `pinned` is `true`.
- The current home page takes the first two pinned projects.

To reorder home page project cards, reorder the project objects in `profile.json`.

## Local Checklist

After adding or editing content:

```sh
npm run build
```

Then preview locally:

```sh
npm run preview
```

Check:

- The home page recent writing section shows the right pinned posts.
- `/blog/` shows the new item.
- Local posts open at `/blog/<slug>/`.
- External cards redirect to the right external URL.
- Images load and have useful alt text.
- No draft posts are visible in the production build.
