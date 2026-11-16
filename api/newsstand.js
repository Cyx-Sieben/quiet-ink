/**
 * Vercel serverless function: GET /api/newsstand
 * Reads the public RSS/Atom feeds listed in public/data/newsstand_feeds.json and returns
 * recent items (title, link, excerpt, date). It never copies full articles; readers are
 * sent to the original site. Vercel caches the response for one hour.
 */
import { readFile } from 'node:fs/promises';
import { XMLParser } from 'fast-xml-parser';

const MAX_ITEMS_PER_FEED = 6;
const MAX_ITEMS = 120;

function text(v) {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (Array.isArray(v)) return text(v[0]);
  if (typeof v === 'object') return text(v['#text'] ?? v.__cdata ?? '');
  return '';
}

function clean(html, n = 260) {
  const t = text(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#8217;|&rsquo;/g, "'")
    .replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/g, '"')
    .replace(/&#8211;|&#8212;|&ndash;|&mdash;/g, ', ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .trim();
  return t.length > n ? `${t.slice(0, n).replace(/\s+\S*$/, '')}...` : t;
}

function atomLink(link) {
  const links = Array.isArray(link) ? link : [link];
  const alt = links.find((l) => l && (l['@_rel'] === 'alternate' || !l['@_rel'])) || links[0];
  return alt ? alt['@_href'] || text(alt) : '';
}

function safeUrl(u) {
  try {
    const url = new URL(u);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
  } catch (e) {
    return '';
  }
}

export async function readFeed(feed, parser) {
  const res = await fetch(feed.url, {
    headers: { 'User-Agent': 'QuietInkNewsstand/1.0 (+RSS reader)', Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' },
    signal: AbortSignal.timeout(8000)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const xml = parser.parse(await res.text());
  let entries = [];
  if (xml.rss && xml.rss.channel) {
    const items = [].concat(xml.rss.channel.item || []);
    entries = items.map((it) => ({
      title: clean(it.title, 200),
      link: safeUrl(text(it.link)),
      author: clean(it['dc:creator'] || it.author || '', 80),
      date: Date.parse(text(it.pubDate)) || null,
      excerpt: clean(it.description || it['content:encoded'])
    }));
  } else if (xml.feed) {
    const items = [].concat(xml.feed.entry || []);
    entries = items.map((it) => ({
      title: clean(it.title, 200),
      link: safeUrl(atomLink(it.link)),
      author: clean(it.author && it.author.name, 80),
      date: Date.parse(text(it.published || it.updated)) || null,
      excerpt: clean(it.summary || it.content)
    }));
  }
  return entries
    .filter((e) => e.title && e.link)
    .slice(0, MAX_ITEMS_PER_FEED)
    .map((e) => ({ ...e, publication: feed.name, topic: feed.topic || 'Ideas' }));
}

export function makeParser() {
  return new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', cdataPropName: '__cdata' });
}

export default async function handler(req, res) {
  let feeds = [];
  try {
    const raw = await readFile(new URL('../public/data/newsstand_feeds.json', import.meta.url), 'utf8');
    feeds = JSON.parse(raw).feeds || [];
  } catch (e) {
    feeds = [];
  }
  const parser = makeParser();
  const results = await Promise.allSettled(feeds.map((f) => readFeed(f, parser)));
  const items = [];
  const failed = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') items.push(...r.value);
    else failed.push({ name: feeds[i].name, reason: String(r.reason && r.reason.message ? r.reason.message : r.reason) });
  });
  items.sort((a, b) => (b.date || 0) - (a.date || 0));

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
  res.end(JSON.stringify({ updated: Date.now(), items: items.slice(0, MAX_ITEMS), failed }));
}
