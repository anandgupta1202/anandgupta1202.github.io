# Anand Gupta Portfolio

Static Astro site for [www.anandgupta.net](https://www.anandgupta.net).

## Local development

```sh
npm install
npm run dev
```

## Content

- Profile, social links, tech groups, and project cards live in `src/data/profile.json`.
- Local and external writing entries live in `src/content/writing`.
- Add `externalUrl` to a writing entry when the card should link to Medium, Substack, or another site.
- Leave `externalUrl` empty for a local page at `/blog/[slug]/`.

For full instructions, see [`docs/content-guide.md`](docs/content-guide.md).

## Build

```sh
npm run build
```
