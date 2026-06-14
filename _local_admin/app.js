(function () {
  const root = document.querySelector("[data-admin]");
  const params = new URLSearchParams(window.location.search);
  const keyFromUrl = params.get("key");

  if (keyFromUrl) {
    sessionStorage.setItem("feiyang-local-admin-key", keyFromUrl);
    window.history.replaceState({}, "", "/");
  }

  const adminKey = sessionStorage.getItem("feiyang-local-admin-key");
  const fields = {};
  root.querySelectorAll("[data-field]").forEach((field) => {
    fields[field.dataset.field] = field;
  });

  const list = root.querySelector("[data-list]");
  const search = root.querySelector("[data-search]");
  const status = root.querySelector("[data-status]");
  const fileLabel = root.querySelector("[data-file]");
  const heading = root.querySelector("[data-heading]");
  const preview = root.querySelector("[data-preview]");
  const tagPalette = root.querySelector("[data-tag-palette]");
  const today = new Date().toISOString().slice(0, 10);
  let posts = [];
  let activeFile = "";
  let taxonomy = [];

  const starterBody = [
    "## note",
    "",
    "Context:",
    "",
    "What happened:",
    "",
    "What remains unresolved:"
  ].join("\n");

  const setStatus = (message) => {
    status.textContent = message;
  };

  const escapeHtml = (value) => String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

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

  const selectedTags = () => fields.tags.value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  const setSelectedTags = (tags) => {
    fields.tags.value = Array.from(new Set(tags)).join(", ");
    update();
  };

  const toggleTag = (tag) => {
    const tags = selectedTags();
    setSelectedTags(tags.includes(tag)
      ? tags.filter((item) => item !== tag)
      : [...tags, tag]);
  };

  const api = async (path, options) => {
    if (!adminKey) throw new Error("Missing local admin key. Restart the server and open the printed URL.");
    const response = await fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Key": adminKey,
        ...(options && options.headers ? options.headers : {})
      }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Request failed.");
    return data;
  };

  const current = () => ({
    file: activeFile,
    title: fields.title.value.trim() || "Untitled",
    date: fields.date.value || today,
    slug: slugify(fields.slug.value || fields.title.value),
    category: fields.category.value.trim() || "facts",
    author: fields.author.value.trim() || "Feiyang",
    tags: fields.tags.value.split(",").map((tag) => tag.trim()).filter(Boolean),
    image: fields.image.value.trim(),
    body: fields.body.value
  });

  const fileFor = (entry) => `${entry.date}-${entry.slug}.md`;

  const markdownFor = (entry) => {
    const quote = (value) => `"${String(value || "").replace(/"/g, '\\"')}"`;
    const lines = [
      "---",
      "layout: post",
      `title: ${quote(entry.title)}`,
      `author: ${quote(entry.author)}`,
      `categories: ${entry.category}`
    ];

    if (entry.tags.length) lines.push(`tags: [${entry.tags.map(quote).join(", ")}]`);
    if (entry.image) lines.push(`image: ${entry.image}`);
    lines.push("---", "", entry.body.trim(), "");
    return lines.join("\n");
  };

  const renderMarkdown = (markdown) => escapeHtml(markdown || "")
    .split(/\n{2,}/)
    .map((block) => {
      const text = block.trim();
      if (!text) return "";
      if (text.startsWith("### ")) return `<h3>${text.slice(4)}</h3>`;
      if (text.startsWith("## ")) return `<h2>${text.slice(3)}</h2>`;
      if (text.startsWith("# ")) return `<h1>${text.slice(2)}</h1>`;
      if (text.startsWith("- ")) {
        return `<ul>${text.split("\n").map((line) => `<li>${line.replace(/^- /, "")}</li>`).join("")}</ul>`;
      }
      return `<p>${text.replace(/\n/g, "<br>")}</p>`;
    })
    .join("")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  const renderTagPalette = () => {
    if (!tagPalette) return;
    const selected = new Set(selectedTags());
    tagPalette.innerHTML = taxonomy.map((group) => {
      const chips = (group.tags || []).map((tag) => [
        `<button type="button" class="tag-chip${selected.has(tag) ? " active" : ""}" data-tag="${escapeHtml(tag)}">`,
        `${escapeHtml(tag)}</button>`
      ].join("")).join("");

      return [
        '<section class="tag-group">',
        `<strong>${escapeHtml(group.name)}</strong>`,
        `<div class="tag-chips">${chips}</div>`,
        '</section>'
      ].join("");
    }).join("");

    tagPalette.querySelectorAll("[data-tag]").forEach((button) => {
      button.addEventListener("click", () => toggleTag(button.dataset.tag));
    });
  };

  const update = () => {
    const entry = current();
    const file = fileFor(entry);
    fileLabel.textContent = `_posts/${file}`;
    heading.textContent = entry.title;
    preview.innerHTML = [
      `<h1>${escapeHtml(entry.title)}</h1>`,
      `<p><code>_posts/${escapeHtml(file)}</code></p>`,
      renderMarkdown(entry.body)
    ].join("");
    renderTagPalette();
  };

  const fill = (post) => {
    activeFile = post.file || "";
    fields.title.value = post.title || "";
    fields.date.value = post.date || today;
    fields.slug.value = post.slug || slugify(post.title);
    fields.category.value = post.category || "facts";
    fields.author.value = post.author || "Feiyang";
    fields.tags.value = (post.tags || []).join(", ");
    fields.image.value = post.image || "";
    fields.body.value = post.body || starterBody;
    update();
  };

  const renderList = () => {
    const query = search.value.trim().toLowerCase();
    list.innerHTML = "";
    posts
      .filter((post) => {
        const haystack = `${post.title} ${post.category} ${(post.tags || []).join(" ")}`.toLowerCase();
        return haystack.includes(query);
      })
      .forEach((post) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `post-item${post.file === activeFile ? " active" : ""}`;
        button.innerHTML = [
          `<strong>${escapeHtml(post.title)}</strong>`,
          `<small>${escapeHtml(post.date)} / ${escapeHtml(post.category)}</small>`
        ].join("");
        button.addEventListener("click", async () => {
          setStatus("loading");
          const data = await api(`/api/post?file=${encodeURIComponent(post.file)}`);
          fill(data.post);
          renderList();
          setStatus("loaded");
        });
        list.appendChild(button);
      });
  };

  const refresh = async () => {
    setStatus("refreshing");
    const data = await api("/api/posts");
    posts = data.posts;
    renderList();
    setStatus(`${posts.length} posts`);
  };

  const loadTaxonomy = async () => {
    const data = await api("/api/taxonomy");
    taxonomy = data.groups || [];
    renderTagPalette();
  };

  const newPost = () => {
    activeFile = "";
    fill({
      title: "Untitled",
      date: today,
      slug: "new-post",
      category: "facts",
      author: "Feiyang",
      tags: ["emotional-debugging"],
      image: "",
      body: starterBody
    });
    renderList();
    setStatus("new draft");
  };

  const save = async () => {
    setStatus("saving");
    const data = await api("/api/save", {
      method: "POST",
      body: JSON.stringify(current())
    });
    activeFile = data.file;
    await refresh();
    setStatus(`saved ${data.path}`);
  };

  const copy = async () => {
    await navigator.clipboard.writeText(markdownFor(current()));
    setStatus("markdown copied");
  };

  const download = () => {
    const entry = current();
    const blob = new Blob([markdownFor(entry)], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileFor(entry);
    link.click();
    URL.revokeObjectURL(url);
    setStatus(`downloaded ${link.download}`);
  };

  Object.values(fields).forEach((field) => field.addEventListener("input", update));
  fields.title.addEventListener("input", () => {
    if (!activeFile) fields.slug.value = slugify(fields.title.value);
  });
  search.addEventListener("input", renderList);
  root.querySelector("[data-new]").addEventListener("click", newPost);
  root.querySelector("[data-refresh]").addEventListener("click", refresh);
  root.querySelector("[data-save]").addEventListener("click", () => save().catch((error) => setStatus(error.message)));
  root.querySelector("[data-copy]").addEventListener("click", () => copy().catch((error) => setStatus(error.message)));
  root.querySelector("[data-download]").addEventListener("click", download);

  if (!adminKey) {
    setStatus("missing key");
  } else {
    newPost();
    Promise.all([refresh(), loadTaxonomy()]).catch((error) => setStatus(error.message));
  }
})();
