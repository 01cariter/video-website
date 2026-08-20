---
name: scene-concept-design
description: Turn a scene description or world-building brief into polished environment concept images on the canvas.
---

# Scene Concept Design

Create image-generator nodes from the user's scene description, world setting, and references, then start generation only when the intent is sufficiently clear.

## Generation defaults

- Use the product's currently available default image model unless the user names another enabled model. Never assume an internal or unavailable model.
- Default to a `16:9` landscape frame.
- Default to four variations when the generator supports multiple outputs; otherwise create the smallest number of nodes needed to provide four comparable options.
- Attach every user-provided scene reference to the generator node. Preserve the reference aspect ratio when the user asks for a match.

## Prompt strategy

Keep the user's creative direction intact, then add only the relevant finishing language:

- General scene concept: `clean, uncluttered environment, complete scene, stable composition, rich environmental detail, production-ready environment concept art`
- Photorealistic, real-world, or live-action scene: `photographic realism, practical location photography, natural light, wide-angle lens, complete environment, clean production design`
- Anime, animation, or game environment: `Japanese-inspired environment design, animated visual language, soft controlled lighting, accurate perspective, production-ready environment concept design`

Do not add people, props, text, logos, or story events that the user did not request. Keep architecture, geography, time of day, weather, and cultural cues mutually consistent.

## Delivery

Create the generator node near the user's current work without covering existing nodes, retain the final prompt and parameters on that node, and start generation. Briefly identify the chosen model, aspect ratio, and variation count.
