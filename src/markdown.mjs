import { basename, extname } from 'node:path';

export function slugify(value) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[''`"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function extFromUrl(url) {
  try {
    const parsed = new URL(url);
    const ext = extname(parsed.pathname).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif'].includes(ext)) {
      return ext;
    }
  } catch {
    // Keep the default below for malformed or relative image URLs.
  }
  return '.jpg';
}

export function decodeEntities(value) {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&hellip;/g, '...');
}

export function stripTags(html) {
  return decodeEntities(html.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
}

export function plainTextFromHtml(html) {
  let value = html.replace(/<\/(p|div|li|h[1-6]|blockquote|ul|ol)>/gi, ' ');
  value = value.replace(/<br\s*\/?>/gi, ' ');
  return stripTags(value);
}

export function htmlToMarkdown(html, ctx = createDefaultContext()) {
  const source = html.replace(/\r\n?/g, '\n');
  const out = [];
  const blockRe = /<(p|h[1-6]|ul|ol|blockquote|div)([^>]*)>([\s\S]*?)<\/\1>/gi;

  let cursor = 0;
  let match;
  while ((match = blockRe.exec(source)) !== null) {
    if (match.index > cursor) {
      const stray = source.slice(cursor, match.index).trim();
      if (stray && !/^<\/?(br)\s*\/?>$/i.test(stray)) {
        const md = inlineToMarkdown(stray, ctx).trim();
        if (md) out.push(md);
      }
    }
    cursor = match.index + match[0].length;

    const tag = match[1].toLowerCase();
    const inner = match[3];

    if (tag === 'p') {
      const md = paragraphToMarkdown(inner, ctx);
      if (md) out.push(md);
    } else if (/^h[1-6]$/.test(tag)) {
      const level = Number(tag.slice(1));
      const text = inlineToMarkdown(inner, ctx).replace(/\*\*/g, '').replace(/\*/g, '').trim();
      if (text) out.push(`${'#'.repeat(level)} ${text}`);
    } else if (tag === 'blockquote') {
      const innerMd = htmlToMarkdown(inner, ctx).trim();
      if (innerMd) {
        out.push(innerMd.split('\n').map((line) => (line.trim() ? `> ${line}` : '>')).join('\n'));
      }
    } else if (tag === 'ul' || tag === 'ol') {
      const list = listToMarkdown(tag, inner, ctx);
      if (list) out.push(list);
    } else if (tag === 'div') {
      const md = htmlToMarkdown(inner, ctx).trim();
      if (md) out.push(md);
    }
  }

  if (cursor < source.length) {
    const trail = source.slice(cursor).trim();
    if (trail) {
      const md = inlineToMarkdown(trail, ctx).trim();
      if (md) out.push(md);
    }
  }

  return out
    .join('\n\n')
    .replace(/@@YT::([A-Za-z0-9_-]+)::([^@]+)@@/g, (_, id, label) => {
      const cleanLabel = label.trim().replace(/"/g, '\\"');
      return `\n![${cleanLabel}](https://www.youtube.com/watch?v=${id})\n`;
    })
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function paragraphToMarkdown(inner, ctx) {
  const normalized = inner
    .replace(/^\s*(<br\s*\/?>\s*)+/i, '')
    .replace(/<(strong|b|em|i|u)>\s*(<br\s*\/?>\s*)*<\/\1>/gi, '');
  const fauxHeading = normalized.match(/^\s*<strong>([^<]{1,60})<\/strong>\s*(<br\s*\/?>\s*)?([\s\S]+)$/);

  if (
    fauxHeading &&
    !/[.!?]\s*$/.test(fauxHeading[1].trim()) &&
    stripTags(fauxHeading[3]).length > 40
  ) {
    const rest = inlineToMarkdown(fauxHeading[3], ctx).trim();
    return [`### ${stripTags(fauxHeading[1])}`, rest].filter(Boolean).join('\n\n');
  }

  const md = inlineToMarkdown(inner, ctx).trim();
  return md === '**' ? '' : md;
}

function listToMarkdown(tag, inner, ctx) {
  const items = [];
  const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let match;
  let index = 1;

  while ((match = liRe.exec(inner)) !== null) {
    let liHtml = match[1];
    liHtml = liHtml.replace(/^\s*<p[^>]*>/i, '').replace(/<\/p>\s*$/i, '');
    liHtml = liHtml.replace(/<\/p>\s*<p[^>]*>/gi, '\n\n');

    const liMd = inlineToMarkdown(liHtml, ctx).trim();
    if (!liMd) continue;

    const bullet = tag === 'ol' ? `${index}.` : '-';
    items.push(`${bullet} ${liMd.replace(/\n/g, '\n  ')}`);
    index += 1;
  }

  return items.join('\n');
}

function inlineToMarkdown(html, ctx) {
  let value = html;

  value = value.replace(/<(strong|b|em|i|u)>\s*(<br\s*\/?>\s*)*<\/\1>/gi, '');
  value = value.replace(/<\/(strong|b|em|i|u)>\s*<\1>/gi, '');
  value = value.replace(/<br\s*\/?>/gi, '\n');

  value = value.replace(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, label) => {
    const youtubeId = extractYouTubeId(href);
    if (youtubeId) {
      ctx.youtubeIds.add(youtubeId);
      const labelText = stripTags(label) || `YouTube video ${youtubeId}`;
      return `@@YT::${youtubeId}::${labelText.replace(/::/g, ':')}@@`;
    }
    const text = stripTags(label) || href;
    return `[${text}](${href})`;
  });

  value = value.replace(/<img[^>]*src="([^"]+)"[^>]*>/gi, (_, src) => {
    const cleanUrl = decodeEntities(src);
    const local = ctx.registerImage(cleanUrl);
    return `![${ctx.altFor(local)}](${local})`;
  });

  value = value.replace(/<\s*strong[^>]*>([\s\S]*?)<\s*\/\s*strong\s*>/gi, '**$1**');
  value = value.replace(/<\s*b[^>]*>([\s\S]*?)<\s*\/\s*b\s*>/gi, '**$1**');
  value = value.replace(/<\s*em[^>]*>([\s\S]*?)<\s*\/\s*em\s*>/gi, '*$1*');
  value = value.replace(/<\s*i[^>]*>([\s\S]*?)<\s*\/\s*i\s*>/gi, '*$1*');
  value = value.replace(/<\s*u[^>]*>([\s\S]*?)<\s*\/\s*u\s*>/gi, '**$1**');
  value = value.replace(/<\s*code[^>]*>([\s\S]*?)<\s*\/\s*code\s*>/gi, '`$1`');
  value = value.replace(/\*\*\*\*/g, '');
  value = value.replace(/<\s*\/?\s*(span|div|section|article|figure|figcaption)[^>]*>/gi, '');

  return decodeEntities(value);
}

export function extractYouTubeId(url) {
  const fromWatch = url.match(/(?:youtube\.com\/watch\?[^"]*[?&]?v=)([A-Za-z0-9_-]{6,})/);
  if (fromWatch) return fromWatch[1];

  const fromShort = url.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/);
  if (fromShort) return fromShort[1];

  const fromEmbed = url.match(/youtube\.com\/embed\/([A-Za-z0-9_-]{6,})/);
  if (fromEmbed) return fromEmbed[1];

  return null;
}

export function createDefaultContext(assetsDir = './assets') {
  let sequence = 0;
  const imageMap = [];
  const youtubeIds = new Set();

  return {
    imageMap,
    youtubeIds,
    registerImage(originalUrl) {
      sequence += 1;
      const filename = `image-${sequence}${extFromUrl(originalUrl)}`;
      const localPath = `${assetsDir.replace(/\/$/, '')}/${filename}`;
      imageMap.push({ originalUrl, localPath, filename });
      return localPath;
    },
    altFor(localPath) {
      return basename(localPath, extname(localPath)).replace(/-/g, ' ');
    },
  };
}

export function makeDescription(plainText, maxLength = 200) {
  const trimmed = plainText.replace(/\s+/g, ' ').trim();
  if (!trimmed) return '';

  const dot = trimmed.indexOf('. ');
  if (dot > 40 && dot < maxLength) {
    return trimmed.slice(0, dot + 1);
  }

  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength - 3).trimEnd()}...`;
}
