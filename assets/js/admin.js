(function () {
  const root = document.querySelector("[data-admin]");
  if (!root) return;

  const fields = {};
  root.querySelectorAll("[data-field]").forEach((field) => {
    fields[field.dataset.field] = field;
  });

  const githubFields = {};
  root.querySelectorAll("[data-github]").forEach((field) => {
    githubFields[field.dataset.github] = field;
  });

  const entryList = root.querySelector("[data-entry-list]");
  const status = root.querySelector("[data-status]");
  const preview = root.querySelector("[data-preview]");
  const editorTitle = root.querySelector("[data-editor-title]");
  const filterInput = root.querySelector("[data-filter]");
  const today = new Date().toISOString().slice(0, 10);
  const storagePrefix = "feiyang-admin-v2:";
  let kindFilter = "all";
  let activeSha = null;

  const starterBody = [
    "## note",
    "",
    "Write the thing before it mutates into a LinkedIn post.",
    "",
    "- context:",
    "- unresolved state:",
    "- exit condition:"
  ].join("\n");

  const slugify = (value) => {
    return (value || "untitled")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "untitled";
  };

  const escapeHtml = (value) => {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  const setStatus = (message) => {
    status.textContent = message;
  };

  const currentEntry = () => ({
    kind: fields.kind.value || "post",
    title: fields.title.value.trim() || "Untitled",
    author: fields.author.value.trim() || "Feiyang",
    date: fields.date.value || today,
    category: fields.category.value.trim() || "facts",
    tags: fields.tags.value.trim(),
    image: fields.image.value.trim(),
    path: fields.path.value.trim(),
    body: fields.body.value
  });

  const pathFor = (entry) => {
    if (entry.path && (entry.path.includes("/") || entry.path.endsWith(".md"))) return entry.path;
    const slug = slugify(entry.path || entry.title);
    if (entry.kind === "page") return `pages/${slug}.md`;
    return `_posts/${entry.date}-${slug}.md`;
  };

  const frontMatter = (entry) => {
    const lines = [
      "---",
      `layout: ${entry.kind === "page" ? "page" : "post"}`,
      `title: "${entry.title.replace(/"/g, '\\"')}"`,
    ];

    if (entry.kind === "post") {
      lines.push(`author: "${entry.author.replace(/"/g, '\\"')}"`);
      lines.push(`categories: ${entry.category || "facts"}`);
      if (entry.tags) {
        lines.push(`tags: [${entry.tags.split(",").map((tag) => tag.trim()).filter(Boolean).join(",")}]`);
      }
      if (entry.image) lines.push(`image: ${entry.image}`);
    } else {
      lines.push(`permalink: /${slugify(entry.title)}.html`);
    }

    lines.push("---", "");
    return lines.join("\n");
  };

  const markdownFile = () => {
    const entry = currentEntry();
    entry.path = pathFor(entry);
    fields.path.value = entry.path;
    return frontMatter(entry) + entry.body.trim() + "\n";
  };

  const renderMarkdown = (markdown) => {
    const blocks = escapeHtml(markdown || "")
      .split(/\n{2,}/)
      .map((block) => {
        const trimmed = block.trim();
        if (!trimmed) return "";
        if (trimmed.startsWith("### ")) return `<h3>${trimmed.slice(4)}</h3>`;
        if (trimmed.startsWith("## ")) return `<h2>${trimmed.slice(3)}</h2>`;
        if (trimmed.startsWith("# ")) return `<h1>${trimmed.slice(2)}</h1>`;
        if (trimmed.startsWith("- ")) {
          const items = trimmed.split("\n").map((line) => `<li>${line.replace(/^- /, "")}</li>`).join("");
          return `<ul>${items}</ul>`;
        }
        return `<p>${trimmed.replace(/\n/g, "<br>")}</p>`;
      })
      .join("");

    return blocks
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  };

  const updatePreview = () => {
    const entry = currentEntry();
    if (editorTitle) editorTitle.textContent = entry.title || "Untitled";
    if (!fields.path.value) fields.path.value = pathFor(entry);
    preview.innerHTML = [
      `<h1>${escapeHtml(entry.title)}</h1>`,
      `<p><code>${escapeHtml(pathFor(entry))}</code></p>`,
      renderMarkdown(entry.body)
    ].join("");
  };

  const loadEntry = (entry) => {
    fields.kind.value = entry.kind || "post";
    fields.title.value = entry.title || "";
    fields.author.value = entry.author || "Feiyang";
    fields.date.value = entry.date || today;
    fields.category.value = entry.category || (entry.kind === "post" ? "facts" : "");
    fields.tags.value = entry.tags || "";
    fields.image.value = entry.image || "";
    fields.path.value = entry.path || "";
    fields.body.value = entry.body || starterBody;
    activeSha = entry.sha || null;
    updatePreview();
  };

  const seedEntryFromButton = (button) => ({
    kind: button.dataset.kind,
    title: button.dataset.title,
    author: button.dataset.author || "Feiyang",
    date: button.dataset.date || today,
    category: button.dataset.category || "facts",
    tags: button.dataset.tags || "",
    image: button.dataset.image || "",
    path: button.dataset.path,
    body: [
      `## ${button.dataset.title}`,
      "",
      "<!-- Existing source Markdown is not embedded in the static build.",
      "Use GitHub mode to fetch and overwrite the file, or start a local replacement draft here. -->"
    ].join("\n")
  });

  const draftKey = (entry) => `${storagePrefix}${pathFor(entry)}`;

  const addDraftButton = (entry) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "admin-entry";
    button.dataset.kind = "draft";
    button.innerHTML = [
      "<span>",
      `<strong>${escapeHtml(entry.title)}</strong>`,
      `<em>draft / ${escapeHtml(pathFor(entry))}</em>`,
      "</span>",
      "<small>Draft</small>",
      '<i class="fa fa-ellipsis-h" aria-hidden="true"></i>'
    ].join("");
    button.addEventListener("click", () => loadEntry(entry));
    entryList.prepend(button);
  };

  const loadDrafts = () => {
    Object.keys(localStorage)
      .filter((key) => key.startsWith(storagePrefix))
      .sort()
      .forEach((key) => {
        try {
          addDraftButton(JSON.parse(localStorage.getItem(key)));
        } catch (_) {
          localStorage.removeItem(key);
        }
      });
  };

  const downloadMarkdown = () => {
    const content = markdownFile();
    const entry = currentEntry();
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = pathFor(entry).split("/").pop();
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus(`exported / ${pathFor(entry)}`);
  };

  const saveLocal = () => {
    const entry = currentEntry();
    entry.path = pathFor(entry);
    localStorage.setItem(draftKey(entry), JSON.stringify(entry));
    addDraftButton(entry);
    setStatus(`draft saved / ${entry.path}`);
  };

  const toBase64 = (value) => {
    const bytes = new TextEncoder().encode(value);
    let binary = "";
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary);
  };

  const fetchExistingSha = async (repo, branch, path, token) => {
    const response = await fetch(`https://api.github.com/repos/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}?ref=${encodeURIComponent(branch)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json"
      }
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`GitHub lookup failed: ${response.status}`);
    const data = await response.json();
    return data.sha;
  };

  const publishToGithub = async () => {
    const repo = githubFields.repo.value.trim();
    const branch = githubFields.branch.value.trim() || "main";
    const token = githubFields.token.value.trim();
    const entry = currentEntry();
    const path = pathFor(entry);

    if (!repo || !token) {
      setStatus("github mode needs repo and token");
      return;
    }

    setStatus("github / checking existing file");
    const sha = activeSha || await fetchExistingSha(repo, branch, path, token);
    const response = await fetch(`https://api.github.com/repos/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: `${sha ? "Update" : "Create"} ${path}`,
        content: toBase64(markdownFile()),
        branch,
        sha: sha || undefined
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      setStatus(`github failed / ${response.status}`);
      throw new Error(error.message || `GitHub commit failed: ${response.status}`);
    }

    const data = await response.json();
    activeSha = data.content && data.content.sha;
    setStatus(`committed / ${path}`);
  };

  root.querySelector("[data-new-post]").addEventListener("click", () => {
    loadEntry({
      kind: "post",
      title: "Untitled unresolved state",
      author: "Feiyang",
      date: today,
      category: "facts",
      tags: "personal,life",
      image: "",
      body: starterBody
    });
  });

  root.querySelector("[data-new-page]").addEventListener("click", () => {
    loadEntry({
      kind: "page",
      title: "new page",
      author: "",
      date: today,
      category: "",
      tags: "",
      image: "",
      body: "## page\n\nA small page for something that survived the draft folder."
    });
  });

  root.querySelector("[data-save-local]").addEventListener("click", saveLocal);
  root.querySelector("[data-download]").addEventListener("click", downloadMarkdown);
  root.querySelector("[data-publish]").addEventListener("click", () => {
    publishToGithub().catch((error) => {
      console.error(error);
      setStatus(error.message);
    });
  });

  root.querySelectorAll("[data-seed-entry]").forEach((button) => {
    button.addEventListener("click", () => {
      root.querySelectorAll(".admin-entry").forEach((entry) => entry.classList.remove("active"));
      button.classList.add("active");
      loadEntry(seedEntryFromButton(button));
    });
  });

  root.querySelectorAll("[data-kind-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      root.querySelectorAll("[data-kind-filter]").forEach((tab) => tab.classList.remove("active"));
      button.classList.add("active");
      kindFilter = button.dataset.kindFilter;
      applyFilters();
    });
  });

  const applyFilters = () => {
    const query = (filterInput.value || "").toLowerCase();
    root.querySelectorAll(".admin-entry").forEach((entry) => {
      const matchesText = entry.textContent.toLowerCase().includes(query);
      const matchesKind = kindFilter === "all" || entry.dataset.kind === kindFilter;
      entry.style.display = matchesText && matchesKind ? "" : "none";
    });
  };

  filterInput.addEventListener("input", applyFilters);
  Object.values(fields).forEach((field) => field.addEventListener("input", updatePreview));
  fields.kind.addEventListener("change", () => {
    fields.path.value = "";
    updatePreview();
  });
  fields.title.addEventListener("input", () => {
    fields.path.value = "";
    updatePreview();
  });
  fields.date.addEventListener("change", () => {
    fields.path.value = "";
    updatePreview();
  });

  loadDrafts();
  loadEntry({
    kind: "post",
    title: "Untitled unresolved state",
    author: "Feiyang",
    date: today,
    category: "facts",
    tags: "personal,life",
    image: "",
    body: starterBody
  });
})();
