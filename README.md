# Snackd

A short-form learning video app concept — a feed of bite-sized "study" and "play" videos with a built-in vertical player, search, category filters, a Create studio page, and light/dark mode.

## Files

| File | Description |
| --- | --- |
| `index.html` | Main app: sidebar nav, video feed, vertical swipe player, search, light/dark toggle |
| `create.html` | Create studio page (opens from the Create button): prompt composer, mode chips, quick-start templates, recent projects, and a generated-results gallery |
| `app.html` | Earlier app version |

## Run locally

It's plain static HTML — just open a file in your browser, or serve the folder:

```bash
python3 -m http.server 5500
# then open http://localhost:5500/index.html
```

## Features

- Bite-sized video feed (study / play / sports categories)
- Vertical full-screen swipe player
- Search bar and category filters
- **Create studio** as its own page — composer, templates, recent projects, mock generation gallery
- Light / dark theme toggle (shared across pages)
- Real Unsplash imagery, SVG icons (no emoji)
