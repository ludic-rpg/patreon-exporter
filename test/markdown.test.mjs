import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultContext, htmlToMarkdown, slugify } from '../src/markdown.mjs';

test('slugify creates static-site friendly slugs', () => {
  assert.equal(slugify('My First Patreon Post!'), 'my-first-patreon-post');
  assert.equal(slugify('Cafe deja vu'), 'cafe-deja-vu');
});

test('htmlToMarkdown converts common Patreon HTML', () => {
  const ctx = createDefaultContext('./assets');
  const md = htmlToMarkdown(
    '<p>Hello <strong>world</strong>.</p><p><img src="https://example.com/photo.webp" /></p>',
    ctx,
  );

  assert.equal(md, 'Hello **world**.\n\n![image 1](./assets/image-1.webp)');
  assert.deepEqual(ctx.imageMap, [
    {
      originalUrl: 'https://example.com/photo.webp',
      localPath: './assets/image-1.webp',
      filename: 'image-1.webp',
    },
  ]);
});
