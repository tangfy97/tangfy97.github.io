# Local Blog Admin

This tool is intentionally local-only. It is stored in `_local_admin`, so Jekyll will not publish it to GitHub Pages.

Run it from the repository root:

```sh
node _local_admin/server.mjs
```

Open the URL printed by the server. The URL contains a one-time local key. The server binds to `127.0.0.1` and only writes files inside `_posts/*.md`.
