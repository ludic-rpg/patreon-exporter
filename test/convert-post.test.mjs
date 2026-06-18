import test from 'node:test';
import assert from 'node:assert/strict';
import samplePost from './fixtures/sample-post.json' with { type: 'json' };
import { convertPost } from '../src/convert-post.mjs';

test('convertPost creates Astro markdown with safe defaults', () => {
  const result = convertPost(samplePost, { format: 'astro' });

  assert.equal(result.filename, '2026/05-20/my-first-patreon-post.md');
  assert.equal(result.imageMap.length, 1);
  assert.equal(result.youtubeIds[0], 'abcdef12345');
  assert.match(result.body, /draft: true/);
  assert.match(result.body, /patreon:\n  id: "post_123"/);
  assert.match(result.body, /Hello \*\*supporters\*\* & friends\./);
});

test('convertPost can emit plain markdown', () => {
  const result = convertPost(samplePost, { format: 'plain' });

  assert.match(result.body, /^# My First Patreon Post!/);
  assert.doesNotMatch(result.body, /^---/);
});
