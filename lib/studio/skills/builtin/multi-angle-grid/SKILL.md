---
name: multi-angle-grid
description: Generate a single 3-by-3 reference grid that shows one subject from nine consistent viewing angles.
---

# Multi-Angle Grid

Use an image reference to create one composite image containing nine views of the same subject. Preserve the source's shot scale unless the user explicitly asks for a close-up or wide shot.

## Required input

- A concrete source image attached to the current request. Do not generate this grid from text alone.
- A clear mapping between each canvas image reference and the subject it represents when several images are selected.

## Generator configuration

| Setting | Value |
|---|---|
| Model | Use an enabled image-edit or reference-image model with strong identity consistency. Do not assume an unavailable internal model. |
| Resolution | Prefer `2K` when the selected model exposes it; otherwise use its highest supported resolution. |
| Aspect ratio | Match the source image exactly, using the generator's aspect-ratio control. |
| Output | One image containing a `3 x 3` grid. |
| Variations | Generate two alternatives by default. |
| Shot scale | User choice wins: close-up or wide. Otherwise preserve the source shot scale. |

## Prompt requirements

Describe nine genuinely different, useful camera angles while locking the following across every cell:

- the same subject identity, proportions, clothing, materials, colors, accessories, environment, lighting, and rendering style;
- the same approximate shot scale and subject size;
- no added or removed objects;
- no white studio background unless the source already uses one;
- no text, labels, numbers, captions, watermarks, borders, or logos.

The result is a single cohesive grid, not nine unrelated redesigns. If a first attempt changes identity or scene content, strengthen reference adherence and consistency constraints before retrying once.

## Canvas delivery

Create new generator/output nodes without covering existing work. Retain the final prompt and parameters on the generator node. After generation, make the composite output easy to inspect at roughly twice the normal node display size when the canvas supports resizing.
