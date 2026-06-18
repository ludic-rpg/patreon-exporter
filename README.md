# Patreon Exporter

Export your own Patreon creator posts to local JSON, then convert that archive
to Markdown for a static site, blog, or personal backup.

This tool is for creators migrating their own work. It is not a scraper and it
does not bypass Patreon access controls. Keep your access token, exported paid
posts, patron data, and downloaded media private unless you are certain you have
the right to publish them.

## Requirements

- Node.js 20 or newer
- A Patreon creator access token

Create a Patreon API client from the Patreon developer portal, then copy the
creator access token for your own account. You do not need to paste it into a
file. Pass it to the CLI as an environment variable when you run the export:

```bash
PATREON_TOKEN="paste-token-here" \
  node bin/patreon-exporter.mjs export --out ./patreon-export
```

You can also pass it directly with `--token`:

```bash
node bin/patreon-exporter.mjs export \
  --token "paste-token-here" \
  --out ./patreon-export
```

## Install

For local development from this folder:

```bash
npm install
npm test
```

Run the CLI directly:

```bash
node bin/patreon-exporter.mjs --help
```

## Export Patreon Posts

```bash
PATREON_TOKEN="paste-token-here" \
  node bin/patreon-exporter.mjs export --out ./patreon-export
```

`PATREON_TOKEN` is read only for that command. The CLI does not create or read a
`.env` file by default.

The exporter writes:

- one JSON file per post
- `_index.json`, a small manifest of exported posts

Useful options:

```bash
node bin/patreon-exporter.mjs export \
  --out ./patreon-export \
  --campaign-id 123456 \
  --page-size 50 \
  --user-agent "my-site-migration/1.0"
```

If `--campaign-id` is omitted, the CLI asks Patreon for the campaign linked to
the authenticated creator account.

## Convert To Markdown

```bash
node bin/patreon-exporter.mjs convert \
  --in ./patreon-export \
  --out ./content/blog \
  --format astro
```

By default, converted files are written as:

```text
YYYY/MM-DD/article-slug.md
```

The Astro format emits YAML frontmatter with `draft: true` by default. You can
override that when you are ready:

```bash
node bin/patreon-exporter.mjs convert \
  --in ./patreon-export \
  --out ./content/blog \
  --format astro \
  --draft false
```

Use `--format plain` for Markdown without frontmatter:

```bash
node bin/patreon-exporter.mjs convert \
  --in ./patreon-export \
  --out ./markdown \
  --format plain
```

## Images

The converter rewrites image references to local paths and writes:

- `_image-manifest.json`
- `_image-download.sh`
- `_conversion-summary.json`

Run the generated shell script only after reviewing it:

```bash
bash ./patreon-export/_image-download.sh
```

Downloaded images can include private or paid content. 

## Options

```text
patreon-exporter export
  --out <dir>             Output directory for JSON files
  --token <token>         Patreon token, defaults to PATREON_TOKEN
  --campaign-id <id>      Skip campaign discovery
  --page-size <number>    Patreon page size, default 50
  --user-agent <value>    User-Agent header

patreon-exporter convert
  --in <dir>              Directory containing exported JSON files
  --out <dir>             Markdown output directory
  --format <astro|plain>  Output format, default astro
  --assets-dir <path>     Markdown image path, default ./assets
  --draft <true|false>    Astro draft value, default true
  --dry-run               Preview writes without touching files
```

## Notes

- Patreon API responses can change. Keep a raw JSON backup before converting.
- The HTML to Markdown converter is intentionally conservative and focused on
  the post HTML Patreon commonly emits.
- If a conversion is imperfect, edit the Markdown directly.