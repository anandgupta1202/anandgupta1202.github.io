# anandgupta1202.github.io

Personal website and blog built with [Quartz](https://quartz.jzhao.xyz/) — a fast, batteries-included static site generator that transforms Obsidian markdown into a published website.

<p align="center">
  <a href="https://anandgupta1202.github.io">
    <img src="https://img.shields.io/badge/Visit-My%20site-blue?style=for-the-badge" alt="Website">
  </a>
</p>

## Writing Content

Blog posts and notes are written as standard markdown files in the `content/` directory, fully compatible with [Obsidian](https://obsidian.md/).

- **Home page:** `content/index.md`
- **Blog posts:** `content/blog/`
- **Images:** `content/blog/images/`

### Frontmatter Format

Each markdown file uses YAML frontmatter:

```yaml
---
title: My Blog Post
date: 2024-01-15
tags:
  - tag1
  - tag2
draft: false
description: A short description of the post.
---
```

## Local Development

To preview the site locally:

1. Clone [Quartz](https://github.com/jackyzha0/quartz):
   ```bash
   git clone --depth 1 --branch v4 https://github.com/jackyzha0/quartz.git /tmp/quartz
   ```

2. Copy content and config:
   ```bash
   cp -r content/* /tmp/quartz/content/
   cp quartz.config.ts /tmp/quartz/quartz.config.ts
   cp quartz.layout.ts /tmp/quartz/quartz.layout.ts
   ```

3. Install dependencies and serve:
   ```bash
   cd /tmp/quartz
   npm ci
   npx quartz build --serve
   ```

## Deployment

The site is automatically built and deployed to GitHub Pages via GitHub Actions on every push to `main`.
