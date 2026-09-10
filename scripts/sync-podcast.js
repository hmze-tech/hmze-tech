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

function extractCoverImage(item) {
  const img = item["itunes:image"];
  if (img?.$?.href) return img.$.href;
  if (typeof img === "string") return img;
  return "";
}

function padEpisode(num) {
  return String(num).padStart(3, "0");
}

function cleanTitle(rawTitle, paddedEpisode) {
  let title = rawTitle.trim();

  // If the feed already provides its own "#" prefix (e.g. "#065 …" or
  // "#S2.03 …"), trust the feed title verbatim instead of re-deriving one.
  if (title.startsWith("#")) {
    return title;
  }

  title = title.replace(/^\d{1,4}\s*[:\-–—]\s*/i, "");

  return `#${paddedEpisode} ${title}`.trim();
}

// ---------------------------------------------------------------------------
// HTML -> Markdown
//
// The feed ships show notes as HTML (paragraphs, lists, links, headings) and we
// store them as Markdown, so every construct has to be translated rather than
// dropped: deleting a tag without a replacement welds the text on either side
// together, which is how list items used to end up as one run-on line.
// ---------------------------------------------------------------------------

// Tags that imply a break in the text when we have no better mapping for them.
const BLOCK_TAGS = new Set([
  "address", "article", "aside", "blockquote", "div", "dl", "dd", "dt",
  "fieldset", "figcaption", "figure", "footer", "form", "header", "hr",
  "main", "nav", "pre", "section", "table", "tbody", "td", "tfoot", "th",
  "thead", "tr",
]);

// Converted links are parked behind a placeholder so that the later passes,
// which strip anything shaped like a tag, cannot eat an <https://...> autolink.
const LINK_MARK = "\u0000";

function stripTags(html) {
  return html.replace(/<[^>]+>/g, "");
}

// Kramdown only recognises <...> autolinks with a lower-case scheme, and the
// feed does contain the occasional "Https://". Schemes are case-insensitive, so
// this is safe to normalise.
function normalizeScheme(href) {
  return href.replace(/^([a-zA-Z][a-zA-Z0-9+.-]*):/, (_, scheme) => `${scheme.toLowerCase()}:`);
}

// The feed emits <a href="URL">URL</a> a lot; [https://x](https://x) is noise.
function sameTarget(label, href) {
  const bare = (value) => value.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  return bare(label) === bare(href);
}

function markdownLink(label, href) {
  if (!href) return label;
  if (!label || sameTarget(label, href)) return `<${href}>`;
  // Whitespace or parens in a bare destination break the inline-link syntax.
  const target = /[()\s]/.test(href) ? `<${href}>` : href;
  return `[${label}](${target})`;
}

function convertLinks(html, links) {
  return html.replace(/<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi, (_, attrs, inner) => {
    const hrefMatch = attrs.match(/\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const href = hrefMatch
      ? normalizeScheme(he.decode(hrefMatch[2] ?? hrefMatch[3] ?? hrefMatch[4] ?? "").trim())
      : "";
    const label = he.decode(stripTags(inner)).replace(/\s+/g, " ").trim();

    if (!href && !label) return "";
    // Bare fragments, javascript: and friends are not worth linking.
    if (href && !/^(https?:|mailto:)/i.test(href)) return label;

    links.push(markdownLink(label, href));
    return `${LINK_MARK}${links.length - 1}${LINK_MARK}`;
  });
}

// Emphasis markers have to hug their text — "** bold **" is not emphasis — so
// any padding is moved outside the delimiters.
function wrapInline(inner, marker) {
  const [, lead, core, tail] = stripTags(inner).match(/^(\s*)([\s\S]*?)(\s*)$/);
  return core ? `${lead}${marker}${core}${marker}${tail}` : `${lead}${tail}`;
}

function convertInline(html, links) {
  return convertLinks(html, links)
    .replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi, (_, __, inner) => wrapInline(inner, "**"))
    .replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi, (_, __, inner) => wrapInline(inner, "*"))
    .replace(/<code\b[^>]*>([\s\S]*?)<\/code\s*>/gi, (_, inner) => wrapInline(inner, "`"));
}

function indentContinuation(body, width) {
  const pad = " ".repeat(width);
  return body
    .split("\n")
    .map((line, index) => (index === 0 || !line.trim() ? line : pad + line))
    .join("\n");
}

function listItems(inner) {
  const closed = [...inner.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li\s*>/gi)].map((m) => m[1]);
  if (closed.length) return closed;
  // Defensive: an unclosed <li> should still produce one item.
  return inner
    .split(/<li\b[^>]*>/i)
    .slice(1)
    .map((chunk) => chunk.replace(/<\/li\s*>/gi, ""));
}

function convertList(tag, inner) {
  const ordered = tag.toLowerCase() === "ol";

  const rendered = listItems(inner)
    .map((raw, index) => {
      const marker = ordered ? `${index + 1}. ` : "- ";
      const body = raw
        .replace(/<\/p\s*>/gi, "\n\n")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/[ \t]+/g, " ")
        .trim();
      return body ? marker + indentContinuation(body, marker.length) : null;
    })
    .filter(Boolean)
    .join("\n");

  // Kramdown only recognises a list that is preceded by a blank line.
  return rendered ? `\n\n${rendered}\n\n` : "\n\n";
}

// Innermost first, so a nested list is already Markdown by the time its parent
// <li> gets flattened.
function convertLists(html) {
  const innermost = /<(ul|ol)\b[^>]*>((?:(?!<(?:ul|ol)\b)[\s\S])*?)<\/\1\s*>/i;

  let out = html;
  for (let guard = 0; guard < 100 && innermost.test(out); guard += 1) {
    out = out.replace(innermost, (_, tag, inner) => convertList(tag, inner));
  }
  return out;
}

function convertHeadings(html) {
  return html.replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1\s*>/gi, (_, level, inner) => {
    // Trailing hashes in the text would be swallowed as closing-hash syntax.
    const body = stripTags(inner).replace(/\s+/g, " ").trim().replace(/#+$/, "").trim();
    return body ? `\n\n${"#".repeat(Number(level))} ${body}\n\n` : "\n\n";
  });
}

function convertBreaks(html) {
  return html
    // A run of <br> separates paragraphs; a single one is a hard line break,
    // which Kramdown spells as two trailing spaces.
    .replace(/(?:\s*<br\s*\/?>\s*){2,}/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "  \n");
}

function stripRemainingTags(html) {
  return html.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (_, tag) =>
    BLOCK_TAGS.has(tag.toLowerCase()) ? "\n\n" : ""
  );
}

function tidy(body) {
  return body
    .split("\n")
    // Exactly two trailing spaces are a hard break; other trailing space is
    // noise — and it has to go first, or a whitespace-only line would keep the
    // blank-line runs below from collapsing.
    .map((line) => (/\S {2}$/.test(line) ? line : line.replace(/\s+$/, "")))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function htmlToMarkdown(htmlOrText) {
  const html = text(htmlOrText).replace(/\r/g, "");
  if (!html) return "";

  const links = [];

  let out = html.replace(/<!--[\s\S]*?-->/g, "");
  out = out.replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, "");
  out = convertInline(out, links);
  out = convertHeadings(out);
  out = convertLists(out);
  out = convertBreaks(out);
  out = out.replace(/<\/p\s*>/gi, "\n\n");
  out = stripRemainingTags(out);

  // The feed double-encodes: xml2js resolves the CDATA, this resolves the
  // entities inside the text itself (&amp;, &gt;, ...).
  out = he.decode(out);

  out = out.replace(
    new RegExp(`${LINK_MARK}(\\d+)${LINK_MARK}`, "g"),
    (_, index) => links[Number(index)]
  );

  return tidy(out);
}

function buildPostContent({ title, episode, body, episodeUrl, coverImage }) {
  const parts = [
    "---",
    "layout: podcast_post",
    `title: ${JSON.stringify(title)}`,
    "tags:",
    `episode: ${episode}`,
    `episode_url: ${JSON.stringify(episodeUrl)}`,
  ];
  if (coverImage) parts.push(`cover_image: ${JSON.stringify(coverImage)}`);
  parts.push("---", "", body || "Neue Episode.", "");
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

    const episodeUrl = extractAudioUrl(item);
    const coverImage = extractCoverImage(item);

    if (fs.existsSync(filepath)) {
      let existingContent = fs.readFileSync(filepath, "utf8");
      let patched = false;
      if (!existingContent.includes("episode_url:") && episodeUrl) {
        existingContent = existingContent.replace(
          /^(---[\s\S]*?)(---)/m,
          (_, frontMatter, closing) =>
            `${frontMatter}episode_url: ${JSON.stringify(episodeUrl)}\n${closing}`
        );
        patched = true;
      }
      if (!existingContent.includes("cover_image:") && coverImage) {
        existingContent = existingContent.replace(
          /^(---[\s\S]*?)(---)/m,
          (_, frontMatter, closing) =>
            `${frontMatter}cover_image: ${JSON.stringify(coverImage)}\n${closing}`
        );
        patched = true;
      }
      if (patched) {
        fs.writeFileSync(filepath, existingContent, "utf8");
        console.log(`Patched: ${filename}`);
      } else {
        console.log(`Exists, skipping: ${filename}`);
      }
      continue;
    }

    const body = htmlToMarkdown(item["content:encoded"] || item.description || "");
    const title = cleanTitle(rawTitle, paddedEpisode);

    const content = buildPostContent({
      title,
      episode,
      body,
      episodeUrl,
      coverImage,
    });

    fs.writeFileSync(filepath, content, "utf8");
    createdCount += 1;
    console.log(`Created: ${filename}`);
  }

  console.log(`Done. Created ${createdCount} new file(s).`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

// Shared with scripts/backfill-post-bodies.js, which re-renders the show notes
// of episodes imported before the Markdown conversion existed.
module.exports = {
  RSS_URL,
  POSTS_DIR,
  ensureArray,
  text,
  formatDate,
  padEpisode,
  extractEpisodeNumber,
  htmlToMarkdown,
};
