import { createServer } from "node:http";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

const ROOT = path.resolve(process.cwd());
const ADMIN_DIR = path.join(ROOT, "_local_admin");
const POSTS_DIR = path.join(ROOT, "_posts");
const TAXONOMY_FILE = path.join(ROOT, "_data", "tag_taxonomy.yml");
const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT || 8787);
const KEY = randomBytes(24).toString("base64url");
const MAX_BODY_BYTES = 1024 * 1024;

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

const send = (res, status, body, type = "text/plain; charset=utf-8") => {
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer"
  });
  res.end(body);
};

const json = (res, status, body) => {
  send(res, status, JSON.stringify(body), contentTypes[".json"]);
};

const isLoopback = (req) => {
  const remote = req.socket.remoteAddress;
  return remote === "127.0.0.1" || remote === "::1" || remote === "::ffff:127.0.0.1";
};

const hasKey = (req) => req.headers["x-admin-key"] === KEY;

const readRequestJson = async (req) => {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw new Error("Request body is too large.");
    }
    chunks.push(chunk);
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
};

const safePostFile = (file) => {
  const basename = path.basename(String(file || ""));
  if (!/^\d{4}-\d{2}-\d{2}-[a-z0-9][a-z0-9-]*\.md$/.test(basename)) {
    throw new Error("Invalid post filename.");
  }
  return basename;
};

const slugify = (value) => {
  const slug = String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "new-post";
};

const yamlQuote = (value) => `"${String(value || "").replace(/"/g, '\\"')}"`;

const unquoteYaml = (value) => String(value || "").trim().replace(/^"(.*)"$/, "$1");

const parseTaxonomy = (content) => {
  const groups = [];
  let current = null;
  let readingTags = false;

  content.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed === "groups:") return;

    if (trimmed.startsWith("- name:")) {
      current = { name: unquoteYaml(trimmed.slice(7)), note: "", tags: [] };
      groups.push(current);
      readingTags = false;
      return;
    }

    if (!current) return;

    if (trimmed.startsWith("note:")) {
      current.note = unquoteYaml(trimmed.slice(5));
      readingTags = false;
      return;
    }

    if (trimmed === "tags:") {
      readingTags = true;
      return;
    }

    if (readingTags && trimmed.startsWith("- ")) {
      current.tags.push(unquoteYaml(trimmed.slice(2)));
    }
  });

  return groups;
};

const parseFrontMatter = (content, file) => {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?/);
  const front = {};
  let body = content;

  if (match) {
    body = content.slice(match[0].length);
    match[1].split("\n").forEach((line) => {
      const separator = line.indexOf(":");
      if (separator === -1) return;
      const key = line.slice(0, separator).trim();
      const value = line.slice(separator + 1).trim();
      front[key] = value.replace(/^"(.*)"$/, "$1");
    });
  }

  const fileMatch = file.match(/^(\d{4}-\d{2}-\d{2})-(.*)\.md$/);
  const tags = String(front.tags || "")
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .split(",")
    .map((tag) => tag.trim().replace(/^"(.*)"$/, "$1"))
    .filter(Boolean);

  return {
    file,
    title: front.title || file.replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(/\.md$/, ""),
    date: fileMatch ? fileMatch[1] : "",
    slug: fileMatch ? fileMatch[2] : "",
    category: front.categories || "facts",
    author: front.author || "Feiyang",
    tags,
    image: front.image || "",
    body
  };
};

const markdownFor = (entry) => {
  const tags = Array.isArray(entry.tags)
    ? entry.tags.map((tag) => String(tag).trim()).filter(Boolean)
    : [];
  const lines = [
    "---",
    "layout: post",
    `title: ${yamlQuote(entry.title)}`,
    `author: ${yamlQuote(entry.author || "Feiyang")}`,
    `categories: ${entry.category || "facts"}`
  ];

  if (tags.length) {
    lines.push(`tags: [${tags.map(yamlQuote).join(", ")}]`);
  }

  if (entry.image) {
    lines.push(`image: ${entry.image}`);
  }

  lines.push("---", "", String(entry.body || "").trim(), "");
  return lines.join("\n");
};

const listPosts = async () => {
  const files = (await readdir(POSTS_DIR))
    .filter((file) => /^\d{4}-\d{2}-\d{2}-.*\.md$/.test(file))
    .sort()
    .reverse();

  const posts = await Promise.all(files.map(async (file) => {
    const content = await readFile(path.join(POSTS_DIR, file), "utf8");
    const post = parseFrontMatter(content, file);
    return {
      file,
      title: post.title,
      date: post.date,
      category: post.category,
      tags: post.tags
    };
  }));

  return posts;
};

const serveStatic = async (req, res, pathname) => {
  const file = pathname === "/" ? "index.html" : pathname.slice(1);
  const target = path.resolve(ADMIN_DIR, file);

  if (!target.startsWith(ADMIN_DIR) || !existsSync(target)) {
    send(res, 404, "Not found.");
    return;
  }

  const ext = path.extname(target);
  const body = await readFile(target);
  send(res, 200, body, contentTypes[ext] || "application/octet-stream");
};

const handleApi = async (req, res, url) => {
  if (!hasKey(req)) {
    json(res, 401, { error: "Unauthorised." });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/posts") {
    json(res, 200, { posts: await listPosts() });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/taxonomy") {
    const content = await readFile(TAXONOMY_FILE, "utf8");
    json(res, 200, { groups: parseTaxonomy(content) });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/post") {
    const file = safePostFile(url.searchParams.get("file"));
    const content = await readFile(path.join(POSTS_DIR, file), "utf8");
    json(res, 200, { post: parseFrontMatter(content, file) });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/save") {
    const entry = await readRequestJson(req);
    const date = String(entry.date || "").trim();
    const slug = slugify(entry.slug || entry.title);
    const category = String(entry.category || "facts").trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      json(res, 400, { error: "Date must be YYYY-MM-DD." });
      return;
    }

    if (!/^[a-z0-9][a-z0-9-]{0,100}$/.test(slug)) {
      json(res, 400, { error: "Slug must use lowercase letters, numbers, and hyphens." });
      return;
    }

    if (!/^[a-z0-9_-]+$/.test(category)) {
      json(res, 400, { error: "Category must be a simple token." });
      return;
    }

    const file = safePostFile(`${date}-${slug}.md`);
    await writeFile(path.join(POSTS_DIR, file), markdownFor({ ...entry, date, slug, category }), "utf8");
    json(res, 200, { file, path: `_posts/${file}` });
    return;
  }

  json(res, 404, { error: "Unknown API endpoint." });
};

const server = createServer(async (req, res) => {
  try {
    if (!isLoopback(req)) {
      send(res, 403, "Loopback access only.");
      return;
    }

    const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }

    await serveStatic(req, res, url.pathname);
  } catch (error) {
    json(res, 500, { error: error.message || "Unexpected error." });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Local blog admin: http://${HOST}:${PORT}/?key=${KEY}`);
  console.log("This server only listens on 127.0.0.1 and only writes to _posts/*.md.");
});
