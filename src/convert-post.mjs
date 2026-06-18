import { htmlToMarkdown, plainTextFromHtml, slugify, createDefaultContext, makeDescription } from './markdown.mjs';

export function convertPost(json, options = {}) {
  const attrs = json.attributes || {};
  const title = attrs.title || `Untitled ${json.id}`;
  const html = attrs.content || '';
  const publishDate = attrs.published_at
    ? attrs.published_at.slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  const slug = slugify(title) || `post-${json.id}`;

  const ctx = createDefaultContext(options.assetsDir || './assets');
  const markdown = htmlToMarkdown(html, ctx);
  const plainText = plainTextFromHtml(html);
  const description = makeDescription(plainText);
  const coverImage = ctx.imageMap[0]?.localPath || null;
  const tags = options.tags || ['patreon'];
  const format = options.format || 'astro';
  const draft = options.draft ?? true;

  const body = format === 'plain'
    ? buildPlainMarkdown({ title, markdown, sourceUrl: attrs.url })
    : buildAstroMarkdown({
        title,
        description,
        publishDate,
        sourceUrl: attrs.url,
        id: json.id,
        isPublic: attrs.is_public,
        isPaid: attrs.is_paid,
        coverImage,
        tags,
        draft,
        markdown,
      });

  const [year, month, day] = publishDate.split('-');
  const articleDir = `${year}/${month}-${day}`;

  return {
    id: json.id,
    title,
    slug,
    publishDate,
    articleDir,
    filename: `${articleDir}/${slug}.md`,
    body,
    description,
    coverImage,
    imageMap: ctx.imageMap,
    youtubeIds: [...ctx.youtubeIds],
  };
}

function buildPlainMarkdown({ title, markdown, sourceUrl }) {
  const lines = [`# ${title}`];
  if (sourceUrl) lines.push('', `Original Patreon post: ${sourceUrl}`);
  if (markdown) lines.push('', markdown);
  return `${lines.join('\n')}\n`;
}

function buildAstroMarkdown(input) {
  const lines = ['---'];
  lines.push(`title: "${escapeYamlString(input.title)}"`);
  lines.push(`description: "${escapeYamlString(input.description)}"`);
  lines.push(`publishDate: ${input.publishDate}`);
  if (input.sourceUrl) lines.push(`originalUrl: "${escapeYamlString(input.sourceUrl)}"`);
  if (input.coverImage) lines.push(`coverImage: "${escapeYamlString(input.coverImage)}"`);
  lines.push(`tags: [${input.tags.map((tag) => `"${escapeYamlString(tag)}"`).join(', ')}]`);
  lines.push(`draft: ${input.draft ? 'true' : 'false'}`);
  lines.push('patreon:');
  lines.push(`  id: "${escapeYamlString(input.id)}"`);
  lines.push(`  isPublic: ${Boolean(input.isPublic)}`);
  lines.push(`  isPaid: ${Boolean(input.isPaid)}`);
  lines.push('---');
  lines.push('');
  if (input.markdown) lines.push(input.markdown, '');
  return lines.join('\n');
}

function escapeYamlString(value) {
  return String(value ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
