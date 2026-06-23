# Snackd

A short-form learning video app concept — a feed of bite-sized "study" and "play" videos with a built-in vertical player, search, category filters, and light/dark mode.

## Files

| File | Description |
| --- | --- |
| `snackd-app.html` | Main app design (editorial restyle: Fraunces + Inter, terracotta palette, frosted badges) |
| `app.html` | Earlier app version |
| `index.html` | Landing / entry page |
| `style-*.html` | Style explorations (dark, headspace, minimal, pastel, vibrant) |

## Run locally

It's plain static HTML — just open a file in your browser, or serve the folder:

```bash
python3 -m http.server 5500
# then open http://localhost:5500/snackd-app.html
```

## Features

- Bite-sized video feed (study / play / sports categories)
- Vertical full-screen player
- Search bar and category filters
- Light / dark theme toggle
- Real Unsplash imagery, SVG icons (no emoji)
