// Re-renders the show notes of episodes that were imported before
// scripts/sync-podcast.js learned to convert HTML into Markdown.
//
// The old importer deleted every tag it did not recognise, so lists, links and
// emphasis were lost — bullet points arrived as one run-on line and URLs
// disappeared entirely. Fixing the importer only helps new episodes, because it
// skips files that already exist, so existing posts need this one-off pass.
//
// Only posts that the importer itself wrote are rewritten. The early HMZE
// episodes were hand-written and must not be overwritten with feed text, so a
// post is only touched when it is provably machine-generated: either the commit
// that added it was the sync workflow's, or its body is byte-for-byte what the
// old importer would have produced. Everything else is reported and skipped.
//
//   node scripts/backfill-post-bodies.js --dry-run
//   node scripts/backfill-post-bodies.js

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const xml2js = require("xml2js");
const he = require("he");

const {
  RSS_URL,
  POSTS_DIR,
  ensureArray,
  text,
  formatDate,
  padEpisode,
  extractEpisodeNumber,
  htmlToMarkdown,
} = require("./sync-podcast.js");

const SYNC_COMMIT_AUTHOR = "github-actions[bot]";

// The importer's original body conversion, kept verbatim as the fingerprint of
// a machine-generated post. Do not "fix" this — it has to keep reproducing the
// old, broken output to recognise the files it wrote.
function legacyCleanBody(htmlOrText) {
  const decoded = he.decode(text(htmlOrText));

  return decoded
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// The sync workflow commits new episodes as github-actions[bot]; anything a
// person committed is treated as hand-written.
function addedBySyncWorkflow(filepath) {
  try {
    const author = execFileSync(
      "git",
      ["log", "--diff-filter=A", "--format=%an", "-1", "--", filepath],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
    ).trim();
    return author === SYNC_COMMIT_AUTHOR;
  } catch {
    // No git history available (shallow clone, tarball): fall back to matching
    // the old importer's output exactly.
    return false;
  }
}

function splitFrontMatter(content) {
  const match = content.match(/^(---\n[\s\S]*?\n---\n)([\s\S]*)$/);
  return match ? { frontMatter: match[1], body: match[2] } : null;
}

async function fetchItemsByFilename() {
  const response = await fetch(RSS_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch RSS feed: ${response.status} ${response.statusText}`);
  }

  const parsed = await xml2js.parseStringPromise(await response.text(), {
    explicitArray: false,
    trim: true,
  });

  const channel = parsed?.rss?.channel;
  if (!channel) {
    throw new Error("RSS channel not found");
  }

  const byFilename = new Map();

  for (const item of ensureArray(channel.item)) {
    const rawTitle = text(item.title);
    const pubDate = text(item.pubDate);
    const episode = extractEpisodeNumber(item, rawTitle);
    if (!rawTitle || !pubDate || !episode) continue;

    byFilename.set(`${formatDate(pubDate)}-${padEpisode(episode)}.md`, item);
  }

  return byFilename;
}

function report(label, names) {
  console.log(`${label}: ${names.length}`);
  for (const name of names) console.log(`  ${name}`);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const items = await fetchItemsByFilename();

  const rewritten = [];
  const drifted = [];
  const unchanged = [];
  const handWritten = [];
  const noFeedItem = [];

  for (const filename of fs.readdirSync(POSTS_DIR).sort()) {
    if (!filename.endsWith(".md")) continue;

    const item = items.get(filename);
    if (!item) {
      noFeedItem.push(filename);
      continue;
    }

    const filepath = path.join(POSTS_DIR, filename);
    const parts = splitFrontMatter(fs.readFileSync(filepath, "utf8"));
    if (!parts) {
      handWritten.push(`${filename} (no front matter)`);
      continue;
    }

    const source = item["content:encoded"] || item.description || "";
    const matchesLegacy = parts.body.trim() === legacyCleanBody(source).trim();
    const generated = matchesLegacy || addedBySyncWorkflow(filepath);

    if (!generated) {
      handWritten.push(filename);
      continue;
    }

    const markdown = htmlToMarkdown(source) || "Neue Episode.";
    if (markdown.trim() === parts.body.trim()) {
      unchanged.push(filename);
      continue;
    }

    if (!dryRun) {
      fs.writeFileSync(filepath, `${parts.frontMatter}\n${markdown}\n`, "utf8");
    }
    rewritten.push(filename);
    // The feed was edited after the import, so this post picks up wording
    // changes on top of the formatting fix.
    if (!matchesLegacy) drifted.push(filename);
  }

  report(dryRun ? "Would rewrite" : "Rewritten", rewritten);
  console.log(`Already up to date: ${unchanged.length}`);
  report("Of those, the feed text also changed since the import", drifted);
  report("Skipped, hand-written", handWritten);
  if (noFeedItem.length) report("Skipped, no matching feed item", noFeedItem);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
