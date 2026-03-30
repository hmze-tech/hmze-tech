const fs = require("fs");
const path = require("path");
const xml2js = require("xml2js");
const he = require("he");

const RSS_URL = "https://api.riverside.fm/hosting/H3xZ8MD8.rss";
const POSTS_DIR = path.join(process.cwd(), "_posts");

function ensureArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function text(value) {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "object" && "_" in value) return String(value._).trim();
  return String(value).trim();
}

function formatDate(pubDate) {
  const d = new Date(pubDate);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid pubDate: ${pubDate}`);
  }

  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}`;
}

function extractEpisodeNumber(item, rawTitle) {
  const itunesEpisode = text(item["itunes:episode"]);
  if (itunesEpisode && /^\d+$/.test(itunesEpisode)) {
    return Number(itunesEpisode);
  }

  const match = rawTitle.match(/#\s*(\d{1,4})\b|(?:^|\s)(\d{1,4})\s*[:-]/);
  const num = match ? Number(match[1] || match[2]) : null;
  return Number.isFinite(num) ? num : null;
}

function extractAudioUrl(item) {
  const enclosure = item.enclosure;
  if (enclosure?.$?.url) return enclosure.$.url;
  if (enclosure?.url) return enclosure.url;
  return "";
}

function padEpisode(num) {
  return String(num).padStart(3, "0");
}

function cleanTitle(rawTitle, paddedEpisode) {
  let title = rawTitle.trim();

  title = title.replace(/^#\s*\d{1,4}\s*[:\-–—]?\s*/i, "");
  title = title.replace(/^\d{1,4}\s*[:\-–—]\s*/i, "");

  return `#${paddedEpisode} ${title}`.trim();
}

function cleanBody(htmlOrText) {
  const decoded = he.decode(text(htmlOrText));

  return decoded
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildPostContent({ title, episode, body, episodeUrl }) {
  const parts = [
    "---",
    "layout: podcast_post",
    `title: ${JSON.stringify(title)}`,
    "tags:",
    `episode: ${episode}`,
    `episode_url: ${JSON.stringify(episodeUrl)}`,
    "---",
    "",
    body || "Neue Episode.",
    "",
  ];

  return parts.join("\n");
}

async function main() {
  fs.mkdirSync(POSTS_DIR, { recursive: true });

  const response = await fetch(RSS_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch RSS feed: ${response.status} ${response.statusText}`);
  }

  const xml = await response.text();
  const parsed = await xml2js.parseStringPromise(xml, {
    explicitArray: false,
    trim: true,
  });

  const channel = parsed?.rss?.channel;
  if (!channel) {
    throw new Error("RSS channel not found");
  }

  const items = ensureArray(channel.item);
  let createdCount = 0;

  for (const item of items) {
    const rawTitle = text(item.title);
    const pubDate = text(item.pubDate);
    const episode = extractEpisodeNumber(item, rawTitle);

    if (!rawTitle || !pubDate || !episode) {
      console.log(`Skipping item because of missing title/pubDate/episode: ${rawTitle || "(untitled)"}`);
      continue;
    }

    const datePart = formatDate(pubDate);
    const paddedEpisode = padEpisode(episode);
    const filename = `${datePart}-${paddedEpisode}.md`;
    const filepath = path.join(POSTS_DIR, filename);

    if (fs.existsSync(filepath)) {
      console.log(`Exists, skipping: ${filename}`);
      continue;
    }

    const body = cleanBody(item["content:encoded"] || item.description || "");
    const title = cleanTitle(rawTitle, paddedEpisode);
    const episodeUrl = extractAudioUrl(item);

    const content = buildPostContent({
      title,
      episode,
      body,
      episodeUrl,
    });

    fs.writeFileSync(filepath, content, "utf8");
    createdCount += 1;
    console.log(`Created: ${filename}`);
  }

  console.log(`Done. Created ${createdCount} new file(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});