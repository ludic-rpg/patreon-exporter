import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { convertPost } from './convert-post.mjs';

export async function convertExport(options) {
  const inputDir = resolve(options.in || 'patreon-export');
  const outputDir = resolve(options.out || 'markdown');
  const format = options.format || 'astro';
  if (!['astro', 'plain'].includes(format)) {
    throw new Error('--format must be either "astro" or "plain".');
  }

  const dryRun = Boolean(options.dryRun);
  const draft = parseBooleanOption(options.draft, true);
  const assetsDir = options.assetsDir || './assets';

  const files = (await readdir(inputDir)).filter((file) => file.endsWith('.json') && !file.startsWith('_'));
  if (files.length === 0) {
    throw new Error(`No post JSON files found in ${inputDir}. Run the export command first.`);
  }

  if (!dryRun) await mkdir(outputDir, { recursive: true });

  const allImages = [];
  const summary = [];

  console.log(`Converting ${files.length} posts...`);
  for (const file of files.sort()) {
    const raw = await readFile(resolve(inputDir, file), 'utf8');
    const result = convertPost(JSON.parse(raw), { format, draft, assetsDir });
    const dest = resolve(outputDir, result.filename);

    summary.push({
      id: result.id,
      title: result.title,
      slug: result.slug,
      publishDate: result.publishDate,
      images: result.imageMap.length,
      youtube: result.youtubeIds.length,
    });

    for (const image of result.imageMap) {
      allImages.push({
        postId: result.id,
        slug: result.slug,
        articleDir: result.articleDir,
        ...image,
      });
    }

    if (dryRun) {
      console.log(`  [dry-run] would write ${dest}`);
    } else {
      await mkdir(dirname(dest), { recursive: true });
      await writeFile(dest, result.body, 'utf8');
      console.log(`  wrote ${result.filename}`);
    }
  }

  if (!dryRun) {
    await writeFile(resolve(inputDir, '_image-manifest.json'), JSON.stringify(allImages, null, 2), 'utf8');
    await writeFile(resolve(inputDir, '_conversion-summary.json'), JSON.stringify(summary, null, 2), 'utf8');
    await writeFile(resolve(inputDir, '_image-download.sh'), buildImageDownloadScript(outputDir, allImages), { mode: 0o755 });
  }

  console.log(`Total images referenced: ${allImages.length}`);
  if (!dryRun) {
    console.log(`Summary: ${resolve(inputDir, '_conversion-summary.json')}`);
    console.log(`Image manifest: ${resolve(inputDir, '_image-manifest.json')}`);
    console.log(`Image download script: ${resolve(inputDir, '_image-download.sh')}`);
  }
}

function buildImageDownloadScript(outputDir, images) {
  const lines = [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    '',
    '# Review this file before running it. Exported media may contain private content.',
  ];

  for (const image of images) {
    const targetDir = resolve(outputDir, image.articleDir, 'assets');
    const targetFile = resolve(targetDir, image.filename);
    const url = image.originalUrl.replace(/"/g, '\\"');
    lines.push(`mkdir -p "${targetDir}"`);
    lines.push(`curl -L --fail --silent --show-error -o "${targetFile}" "${url}"`);
  }

  lines.push(`echo "Downloaded ${images.length} images"`);
  return `${lines.join('\n')}\n`;
}

function parseBooleanOption(value, defaultValue) {
  if (value === undefined) return defaultValue;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  throw new Error('Boolean options must be true or false.');
}
