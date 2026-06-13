(function () {
  const root = document.querySelector("[data-admin]");
  if (!root) return;

  const fields = {};
  root.querySelectorAll("[data-field]").forEach((field) => {
    fields[field.dataset.field] = field;
  });

  const status = root.querySelector("[data-status]");
  const preview = root.querySelector("[data-preview]");
  const pathPreview = root.querySelector("[data-path-preview]");
  const draftKey = "feiyang-post-composer-draft";
  const today = new Date().toISOString().slice(0, 10);

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

  const escapeHtml = (value) => {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
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

  const tagList = (value) => {
    return String(value || "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  };

  const currentEntry = () => ({
    title: fields.title.value.trim() || "Untitled",
    date: fields.date.value || today,
    slug: slugify(fields.slug.value || fields.title.value),
    category: fields.category.value || "facts",
    author: fields.author.value.trim() || "Feiyang",
    tags: tagList(fields.tags.value),
    image: fields.image.value.trim(),
    body: fields.body.value
  });

  const filePath = (entry) => `_posts/${entry.date}-${entry.slug}.md`;

  const frontMatter = (entry) => {
    const lines = [
      "---",
      "layout: post",
      `title: ${yamlQuote(entry.title)}`,
      `author: ${yamlQuote(entry.author)}`,
      `categories: ${entry.category}`
    ];

    if (entry.tags.length) {
      lines.push(`tags: [${entry.tags.map(yamlQuote).join(", ")}]`);
    }

    if (entry.image) {
      lines.push(`image: ${entry.image}`);
    }

    lines.push("---", "");
    return lines.join("\n");
  };

  const markdownFile = () => {
    const entry = currentEntry();
    return `${frontMatter(entry)}${entry.body.trim()}\n`;
  };

  const renderMarkdown = (markdown) => {
    return escapeHtml(markdown || "")
      .split(/\n{2,}/)
      .map((block) => {
        const text = block.trim();
        if (!text) return "";
        if (text.startsWith("### ")) return `<h3>${text.slice(4)}</h3>`;
        if (text.startsWith("## ")) return `<h2>${text.slice(3)}</h2>`;
        if (text.startsWith("# ")) return `<h1>${text.slice(2)}</h1>`;
        if (text.startsWith("- ")) {
          const items = text.split("\n").map((line) => `<li>${line.replace(/^- /, "")}</li>`).join("");
          return `<ul>${items}</ul>`;
        }
        return `<p>${text.replace(/\n/g, "<br>")}</p>`;
      })
      .join("")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  };

  const update = () => {
    const entry = currentEntry();
    pathPreview.textContent = filePath(entry);
    preview.innerHTML = [
      `<h1>${escapeHtml(entry.title)}</h1>`,
      `<p><code>${escapeHtml(filePath(entry))}</code></p>`,
      renderMarkdown(entry.body)
    ].join("");
  };

  const saveDraft = () => {
    localStorage.setItem(draftKey, JSON.stringify(currentEntry()));
    setStatus("draft saved locally");
  };

  const loadDraft = () => {
    const draft = localStorage.getItem(draftKey);
    if (!draft) {
      setStatus("no local draft");
      return;
    }

    try {
      const entry = JSON.parse(draft);
      fields.title.value = entry.title || "";
      fields.date.value = entry.date || today;
      fields.slug.value = entry.slug || "";
      fields.category.value = entry.category || "facts";
      fields.author.value = entry.author || "Feiyang";
      fields.tags.value = (entry.tags || []).join(", ");
      fields.image.value = entry.image || "";
      fields.body.value = entry.body || starterBody;
      update();
      setStatus("draft loaded");
    } catch (_) {
      localStorage.removeItem(draftKey);
      setStatus("draft was invalid");
    }
  };

  const exportMarkdown = () => {
    const entry = currentEntry();
    const blob = new Blob([markdownFile()], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${entry.date}-${entry.slug}.md`;
    link.click();
    URL.revokeObjectURL(url);
    setStatus(`exported ${link.download}`);
  };

  const copyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(markdownFile());
      setStatus("markdown copied");
    } catch (_) {
      setStatus("clipboard unavailable");
    }
  };

  Object.values(fields).forEach((field) => field.addEventListener("input", update));
  fields.title.addEventListener("input", () => {
    if (!fields.slug.dataset.touched) fields.slug.value = slugify(fields.title.value);
  });
  fields.slug.addEventListener("input", () => {
    fields.slug.dataset.touched = "true";
  });

  root.querySelector("[data-save-draft]").addEventListener("click", saveDraft);
  root.querySelector("[data-load-draft]").addEventListener("click", loadDraft);
  root.querySelector("[data-export]").addEventListener("click", exportMarkdown);
  root.querySelector("[data-copy]").addEventListener("click", copyMarkdown);

  fields.title.value = "Untitled";
  fields.date.value = today;
  fields.slug.value = "new-post";
  fields.category.value = "facts";
  fields.author.value = "Feiyang";
  fields.tags.value = "personal";
  fields.body.value = starterBody;
  update();
})();
