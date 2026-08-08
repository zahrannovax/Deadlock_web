#!/usr/bin/env node
/**
 * build-sitemap.js
 * ---------------------------------------------------------------------------
 * Static-site SEO tooling for a plain HTML/CSS/vanilla-JS project (no
 * framework, no build step). Scans the project for real, physical .html
 * files and generates two SEO-clean output files in the project root:
 *
 *   - sitemap.xml   one <url> entry per crawlable page, clean (no .html)
 *                    canonical URLs, with an accurate <lastmod> pulled from
 *                    each file's real filesystem modified time.
 *   - robots.txt    minimal, correct, and points crawlers at the sitemap.
 *
 * Run it any time your pages change:
 *     node build-sitemap.js
 *   or, via npm:
 *     npm run build:sitemap
 *
 * IMPORTANT — clean URLs require host-side rewriting:
 * Stripping ".html" from the sitemap only changes what URL crawlers are
 * told to index. Your web server/host still needs to actually serve
 * "/blog" as "blog.html" (extension-less URL rewriting), or those clean
 * URLs will 404 in production. See the deployment notes printed at the
 * end of this script, and update the notes for your actual host.
 * ---------------------------------------------------------------------------
 */

"use strict";

const fs = require("fs");
const path = require("path");

// ============================================================================
// 1. CONFIGURATION — edit these for your project
// ============================================================================

/** Your production domain. No trailing slash. */
const BASE_URL = "https://deadlockcheats.net";

/** Directory the script scans, relative to this file. Project root by default. */
const ROOT_DIR = __dirname;

/**
 * Per-page <priority> / <changefreq> overrides, keyed by the page's relative
 * path from ROOT_DIR using forward slashes (e.g. "index.html", "blog.html").
 * Anything not listed here falls back to DEFAULT_META below.
 */
const PAGE_META = {
  "index.html": { priority: "1.0", changefreq: "weekly" },
  "deadlock-cheats.html": { priority: "0.9", changefreq: "weekly" },
  "blog.html": { priority: "0.7", changefreq: "monthly" },
  "guide.html": { priority: "0.7", changefreq: "monthly" }
};

/** Fallback metadata for any crawlable .html file not listed in PAGE_META above. */
const DEFAULT_META = { priority: "0.6", changefreq: "monthly" };

/**
 * Directory names to skip entirely (never descended into). Keep this in
 * sync with any new non-page folders you add (asset dirs, tooling, etc.).
 */
const EXCLUDED_DIRS = new Set([
  "node_modules",
  ".git",
  ".github",
  ".vscode",
  ".cursor",
  "assets",
  "css",
  "js",
  "img",
  "images",
  "fonts",
  "dist",
  "build"
]);

/**
 * Individual files to always skip, even if they end in .html.
 * Add drafts / staging pages / test fixtures here as needed.
 */
const EXCLUDED_FILES = new Set([
  "404.html",
  "500.html",
  "offline.html"
]);

/** Filename *patterns* to skip — draft/test/internal pages, matched case-insensitively. */
const EXCLUDED_PATTERNS = [/^draft-/i, /^_/, /\.draft\.html$/i, /\.test\.html$/i, /-test\.html$/i];

// ============================================================================
// 2. DISCOVER PAGES
// ============================================================================

/**
 * Recursively walks `dir`, returning absolute paths of every qualifying
 * .html file, skipping EXCLUDED_DIRS/EXCLUDED_FILES/EXCLUDED_PATTERNS.
 */
function findHtmlFiles(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) {
        continue;
      }
      results.push(...findHtmlFiles(fullPath));
      continue;
    }

    if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== ".html") {
      continue;
    }
    if (EXCLUDED_FILES.has(entry.name)) {
      continue;
    }
    if (EXCLUDED_PATTERNS.some((pattern) => pattern.test(entry.name))) {
      continue;
    }

    results.push(fullPath);
  }

  return results;
}

// ============================================================================
// 3. TRANSFORM: physical file -> clean SEO URL + lastmod
// ============================================================================

/** Converts a Windows/POSIX path to a forward-slash relative path from ROOT_DIR. */
function toRelativePosixPath(absolutePath) {
  return path.relative(ROOT_DIR, absolutePath).split(path.sep).join("/");
}

/**
 * Maps a relative file path to its clean, extension-less public URL path.
 *   "index.html"        -> ""                (site root)
 *   "blog.html"          -> "blog"
 *   "guides/index.html"  -> "guides"          (folder index)
 *   "guides/setup.html"  -> "guides/setup"
 */
function toCleanUrlPath(relativePath) {
  if (relativePath === "index.html") {
    return "";
  }
  if (relativePath.endsWith("/index.html")) {
    return relativePath.slice(0, -"/index.html".length);
  }
  return relativePath.slice(0, -".html".length);
}

/** Formats a Date as YYYY-MM-DD (UTC), suitable for <lastmod>. */
function formatLastmod(date) {
  return date.toISOString().split("T")[0];
}

function buildPageEntries() {
  const files = findHtmlFiles(ROOT_DIR);

  return files
    .map((absolutePath) => {
      const relativePath = toRelativePosixPath(absolutePath);
      const cleanPath = toCleanUrlPath(relativePath);
      const loc = cleanPath === "" ? BASE_URL : `${BASE_URL}/${cleanPath}`;
      const lastmod = formatLastmod(fs.statSync(absolutePath).mtime);
      const meta = PAGE_META[relativePath] || DEFAULT_META;

      return {
        relativePath,
        loc,
        lastmod,
        priority: meta.priority,
        changefreq: meta.changefreq
      };
    })
    .sort((a, b) => Number(b.priority) - Number(a.priority) || a.loc.localeCompare(b.loc));
}

// ============================================================================
// 4. WRITE OUTPUT FILES
// ============================================================================

function escapeXml(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function writeSitemap(entries) {
  const urlBlocks = entries
    .map(
      (entry) => `  <url>
    <loc>${escapeXml(entry.loc)}</loc>
    <lastmod>${entry.lastmod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlBlocks}
</urlset>
`;

  fs.writeFileSync(path.join(ROOT_DIR, "sitemap.xml"), xml, "utf8");
}

function writeRobotsTxt() {
  const contents = `User-agent: *
Allow: /

Sitemap: ${BASE_URL}/sitemap.xml
`;

  fs.writeFileSync(path.join(ROOT_DIR, "robots.txt"), contents, "utf8");
}

// ============================================================================
// 5. RUN
// ============================================================================

function main() {
  const entries = buildPageEntries();

  if (entries.length === 0) {
    console.warn("No .html pages found — check ROOT_DIR/EXCLUDED_DIRS in build-sitemap.js.");
    return;
  }

  writeSitemap(entries);
  writeRobotsTxt();

  console.log(`sitemap.xml generated with ${entries.length} URL(s):\n`);
  entries.forEach((entry) => {
    console.log(`  ${entry.loc}  (lastmod ${entry.lastmod}, priority ${entry.priority}, ${entry.changefreq})`);
  });
  console.log("\nrobots.txt regenerated.");
  console.log(
    "\nReminder: clean URLs (no .html) only work in production if your host rewrites\n" +
      "extension-less requests to the matching .html file. Configure that on your\n" +
      "host (Netlify/Vercel/Apache/Nginx/etc.) or these sitemap URLs will 404."
  );
}

main();
