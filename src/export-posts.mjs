import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const API = 'https://www.patreon.com/api/oauth2/v2';

const POST_FIELDS = [
  'title',
  'content',
  'published_at',
  'url',
  'is_public',
  'is_paid',
  'embed_data',
  'embed_url',
].join(',');

export async function exportPosts(options) {
  const token = options.token || process.env.PATREON_TOKEN;
  if (!token) {
    throw new Error('Set PATREON_TOKEN or pass --token.');
  }

  const outDir = resolve(options.out || 'patreon-export');
  const userAgent = options.userAgent || 'patreon-exporter/0.1.0';
  const pageSize = parsePositiveInt(options.pageSize || '50', 'page-size');

  await mkdir(outDir, { recursive: true });
  console.log(`Output: ${outDir}`);

  const client = createPatreonClient({ token, userAgent });
  const campaignId = options.campaignId || await getCampaignId(client);

  console.log(`Fetching posts for campaign ${campaignId}...`);
  const posts = await fetchAllPosts(client, campaignId, pageSize);

  console.log(`Writing ${posts.length} post files...`);
  for (const post of posts) {
    await writeFile(resolve(outDir, `${post.id}.json`), JSON.stringify(post, null, 2), 'utf8');
  }

  const manifest = posts.map((post) => ({
    id: post.id,
    title: post.attributes?.title || null,
    published_at: post.attributes?.published_at || null,
    url: post.attributes?.url || null,
    is_public: post.attributes?.is_public ?? null,
    is_paid: post.attributes?.is_paid ?? null,
  }));
  await writeFile(resolve(outDir, '_index.json'), JSON.stringify(manifest, null, 2), 'utf8');

  console.log(`Done. Wrote ${posts.length} posts and _index.json.`);
}

export function createPatreonClient({ token, userAgent, fetchImpl = fetch }) {
  return {
    async get(path) {
      return apiGet({ path, token, userAgent, fetchImpl });
    },
  };
}

async function apiGet({ path, token, userAgent, fetchImpl }) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const res = await fetchImpl(`${API}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': userAgent,
      },
    });

    if (res.status === 429 && attempt < 3) {
      await delay(retryDelayMs(res, attempt));
      continue;
    }

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Patreon API ${res.status} on ${path}: ${body.slice(0, 500)}`);
    }

    return res.json();
  }

  throw new Error(`Patreon API kept returning 429 on ${path}.`);
}

export async function getCampaignId(client) {
  const data = await client.get('/identity?include=campaign&fields%5Bcampaign%5D=creation_name');
  const campaign = (data.included || []).find((item) => item.type === 'campaign');
  if (!campaign) {
    throw new Error('No campaign found for this token. Use a Patreon creator access token or pass --campaign-id.');
  }

  const name = campaign.attributes?.creation_name || '(unnamed)';
  console.log(`Campaign: ${name} id=${campaign.id}`);
  return campaign.id;
}

export async function fetchAllPosts(client, campaignId, pageSize = 50) {
  const posts = [];
  let cursor = null;
  let page = 0;

  while (true) {
    page += 1;
    const qs = new URLSearchParams({
      'fields[post]': POST_FIELDS,
      'page[count]': String(pageSize),
    });
    if (cursor) qs.set('page[cursor]', cursor);

    const data = await client.get(`/campaigns/${campaignId}/posts?${qs.toString()}`);
    const pagePosts = data.data || [];
    for (const post of pagePosts) posts.push(post);

    console.log(`  page ${page}: +${pagePosts.length} posts (total ${posts.length})`);
    cursor = data.meta?.pagination?.cursors?.next || null;
    if (!cursor) break;
  }

  return posts;
}

function parsePositiveInt(value, name) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number) || number < 1) {
    throw new Error(`--${name} must be a positive integer.`);
  }
  return number;
}

function retryDelayMs(res, attempt) {
  const retryAfter = Number.parseInt(res.headers.get('retry-after') || '', 10);
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return retryAfter * 1000;
  }
  return 500 * 2 ** attempt;
}

function delay(ms) {
  return new Promise((resolveDelay) => {
    setTimeout(resolveDelay, ms);
  });
}
