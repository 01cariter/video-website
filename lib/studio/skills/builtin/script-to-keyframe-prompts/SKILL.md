---
name: script-to-keyframe-prompts
description: Break a script or storyboard into continuity-safe keyframes and write production-ready image prompts for each shot.
---

# Script to Keyframe Prompts

Act as both a film storyboard artist and an image-prompt engineer. Convert a screenplay into a precise shot sequence and a high-quality still-image prompt for every keyframe.

The source workflow named “Nano Banana” as its default image model. In this product, use the image model selected in the Canvas generator and honor its actual size, reference-image, and prompt contract. Do not claim that a nickname or unavailable model was used. Write prompts in the user's requested language; otherwise use the conversation language, with English as the portable default for this built-in skill.

Understand:

- Shot size, composition, implied camera behavior, lighting, and visual rhythm.
- Semantic priority and economical natural-language prompting.
- The hard constraint of image-to-video: the starting keyframe should already contain every character who must visibly participate, unless the chosen video model explicitly supports adding a later referenced character.
- Character asset management through exact, consistent asset names and attached reference images.

## Non-negotiable constraints

### C1 — Character completeness

Every keyframe contains all characters visibly participating in that shot.

- If A and B converse on screen, include both A and B.
- A character absent from the source frame may not reliably appear during image-to-video generation.
- An off-screen speaker or intentionally hidden character is an explicit exception; mark the intent and do not list that person as visually present.

### C2 — Character asset names

Use `Character name (wardrobe or state)` as the visual asset identifier rather than repeatedly rewriting the person's complete appearance.

| Character | Context | Asset name |
|---|---|---|
| Xiao Ming | Work | `Xiao Ming (suit)` |
| Xiao Ming | Hospital | `Xiao Ming (hospital gown)` |
| Xiao Hong | Date | `Xiao Hong (dress)` |
| Xiao Hong | Home | `Xiao Hong (loungewear)` |
| Lao Wang | Bedridden | `Lao Wang (patient clothes)` |
| Lao Wang | Outdoors | `Lao Wang (dark coat)` |

Rules:

- Put the most recognizable wardrobe or physical state in parentheses.
- Create a new asset name only when wardrobe or state meaningfully changes.
- Match the name to the attached character reference exactly when the provider supports named binding.
- Add appearance detail only for a story-visible change such as injury, rain, or tears; for a close-up where expression or texture matters; or to distinguish visually similar people.

### C3 — Cross-shot continuity

- Reuse the same location anchors in adjacent shots from the same scene.
- Keep motivated light stable unless the script changes it.
- Progress atmosphere along the emotional curve rather than jumping arbitrarily.
- Maintain spatial logic. If A looks screen-left, a reverse view of B should usually orient B screen-right unless crossing the axis is intentional and explained.

### C4 — Image quality over information volume

- Keep the prompt to about three semantic layers: subject, environment, atmosphere.
- Give quality and medium direction clear priority.
- Remove mutually contradictory style, light, lens, or mood phrases.
- Prefer a coherent descriptive sentence over a pile of tags.

## Shot output format

```markdown
### Shot [number] — [scene number] [brief title]

**Shot size:** [extreme long / long / full / medium / medium close / close / extreme close]
**Composition:** [symmetry / thirds / leading lines / foreground frame / high angle / low angle / Dutch angle / other]
**Narrative purpose:** [one sentence]

**Characters:** [every visible character's exact asset name]

**Image prompt:**
> [Complete prompt]

**Continuity:**
- Inherits: [visual link to the prior shot]
- Progresses: [emotion, action, or spatial change]
```

## Prompt structure

Order the description as:

```text
[one or two quality/medium cues], [shot size and composition],
[character assets and actions], [relationships and interaction],
[location], [motivated light], [palette and atmosphere], [camera or film character]
```

### Quality and medium cues

Choose only two or three that materially help:

- `cinematic still`, `masterful composition`
- `cinematic lighting`
- `high detail`, `clean sharp focus`
- `professional photography`
- `subtle film texture`
- `ultra-high-definition detail` when the selected model and output size justify it

Avoid treating “8K” or “masterpiece” as a substitute for concrete visual direction.

### Shot-size cues

| Shot | Useful phrase |
|---|---|
| Extreme long | `extreme long shot, expansive establishing view` |
| Long | `long shot, establishing view` |
| Full | `full shot, entire figure visible` |
| Medium | `medium shot, framed from the waist up` |
| Medium close | `medium close-up, framed from the chest up` |
| Close | `close-up, face dominant` |
| Extreme close | `extreme close-up, precise detail` |

### Composition cues

| Composition | Useful phrase |
|---|---|
| Rule of thirds | `rule-of-thirds composition` |
| Symmetry | `symmetrical, centered composition` |
| Foreground frame | `foreground occlusion, frame-within-a-frame` |
| Leading line | `leading-line composition` |
| Low angle | `low-angle view` |
| High angle | `high-angle view` |
| Dutch angle | `Dutch angle, tilted horizon` |
| Over shoulder | `over-the-shoulder view` |
| Three-person tension | `triangular composition` |
| Deliberate imbalance | `asymmetrical composition, shifted visual weight` |

### Lighting cues

| Light | Useful phrase |
|---|---|
| Natural daylight | `soft natural daylight` |
| Golden hour | `warm golden-hour light` |
| Backlight | `backlight, silhouette and rim light` |
| Low key | `low-key light, dramatic shadow` |
| High key | `high-key light, soft diffusion` |
| Neon | `colored neon glow` |
| Candle | `warm, flickering candlelight` |
| Moon | `cool blue moonlit ambience` |
| Desk lamp | `warm localized sidelight from a desk lamp` |
| Fluorescent | `cold white clinical fluorescent light` |

### Atmosphere cues

| Emotion | Useful phrase |
|---|---|
| Tension | `tense, suspenseful atmosphere` |
| Warmth | `warm, secure, intimate` |
| Isolation | `lonely, melancholy atmosphere` |
| Awe | `epic scale, awe-inspiring` |
| Fear | `ominous, unsettling, uncanny` |
| Joy | `lively, playful, energetic` |
| Grief | `subdued, sorrowful, heavy` |
| Mystery | `mysterious, dreamlike, mist-filled` |
| Dignity | `solemn, dignified` |
| False warmth | `a trace of unease beneath apparent warmth` |
| Conspiracy | `casual surface with concealed calculation` |
| Despair | `oppressive, airless darkness` |

## Shot decomposition

Create a new shot when:

1. The primary action completes and a new decisive action begins.
2. Emotion turns sharply.
3. Narrative emphasis requires a different scale.
4. Time or location changes.
5. Audience attention transfers from one subject to another.

Keep material in one shot when:

1. A continuous action reads clearly in one frame.
2. A cut would omit a required participant and violate C1.
3. Fragmentation would harm rhythm without revealing new information.

Density guide:

| Scene type | Starting point |
|---|---|
| Action or combat | One shot per 2–3 script sentences |
| Dialogue | One shot per 4–6 sentences, with reverses as dramatic focus changes |
| Lyrical or atmospheric | One shot per 1–2 sentences |
| Transition | One or two shots to summarize |

Adapt density to the actual action, not sentence count alone.

## Workflow

### Step 0 — Asset table

Read the entire script and map every character state before drafting prompts.

```markdown
| Character | Asset name | Applicable scenes | State note |
|---|---|---|---|
| [name] | [name] ([wardrobe/state]) | [scene numbers] | [short note] |
```

- Split only meaningful wardrobe or state variations.
- Keep the parenthetical label short and distinct.
- Cover every state that appears in the script.
- Preserve user-provided asset names exactly.
- Attach the corresponding Canvas reference images when generation begins.

### Step 1 — Analyze

Identify scene count, cast, emotional arc, major turns, location continuity, and any information that cannot be shown in a still image. Return a brief analysis.

### Step 2 — Plan shots

Apply the decomposition rules. Assign shot size and composition; list every visually participating character and exact asset name. Mark off-screen dialogue explicitly rather than pretending an invisible speaker is present.

### Step 3 — Write prompts

Write one coherent prompt per shot using the selected model's actual language and reference contract. Apply C1–C4.

### Step 4 — Audit continuity

- [ ] Same character and state use the same asset name in adjacent shots.
- [ ] Same location keeps stable environmental anchors.
- [ ] Light does not change without a motivated event.
- [ ] Left/right, foreground/background, and eyelines make spatial sense.
- [ ] Atmosphere progresses along the intended emotional curve.
- [ ] Every visible participant is present.

Return a short report and call out uncertain transitions.

### Step 5 — Deliver and optionally generate

Return the complete shot list, asset table, continuity result, and an overview table. If the user asks to generate, create new Canvas image generator nodes with the matching prompt, model parameters, and references; show actual credit cost before generation.

## Overview table

```markdown
| Shot | Scene | Size | Characters | Emotional cue | Continuity |
|---|---|---|---|---|---|
| 01 | 1-1 Restaurant | Medium | Xiao Hong (dress) | hopeful warmth | opening |
| 02 | 1-1 Restaurant | Medium close | Xiao Hong (dress), Xiao Ming (shirt), Xiao Fang (evening dress) | shock and betrayal | inherits 01 |
```

## Special cases

### Ensemble scenes

Place principal figures centrally or in the foreground, distribute supporting figures naturally, and specify everyone's screen position without turning the prompt into a roster.

### Flashback

Use a controlled distinction such as `soft focus, restrained saturation, hazy memory, vintage film texture`, and mark the style transition in continuity.

### Parallel editing

Number each strand, for example `Shot 5A` and `Shot 5B`, and state the cross-cut relation.

### State change

Change the asset name when wardrobe or state changes and annotate the boundary:

```text
[asset change] Xiao Ming (suit) -> Xiao Ming (hospital gown)
```

If rain, injury, or another transformation happens inside the shot, preserve the initial asset and describe the visible transition rather than pretending a different source image existed from frame one.

### Empty establishing or insert shot

Use `Characters: none (environment/insert)` and focus on place, atmosphere, and time. Match its palette to adjacent shots.

## Worked example

Script fragment:

> 1-1. INT. UPSCALE RESTAURANT — NIGHT
> Xiao Hong enters, delighted. She sees Xiao Ming and Xiao Fang sitting together and freezes.
> Xiao Ming avoids her eyes. Xiao Fang smiles provocatively.

Asset table:

| Character | Asset name | Scene | State |
|---|---|---|---|
| Xiao Hong | `Xiao Hong (dress)` | 1-1 | Dressed for a date |
| Xiao Ming | `Xiao Ming (shirt)` | 1-1 | Date clothes |
| Xiao Fang | `Xiao Fang (evening dress)` | 1-1 | Deliberately glamorous |

### Shot 01 — 1-1A Entering with hope

**Shot size:** Medium
**Composition:** Leading lines through the restaurant's depth
**Narrative purpose:** Establish her happiness so the discovery has somewhere to fall from.

**Characters:** Xiao Hong (dress)

**Image prompt:**
> Cinematic still with precise composition, medium shot of Xiao Hong (dress) entering an upscale restaurant and searching the room with a bright, expectant smile; elegant interior, crystal chandeliers, softly blurred diners, leading lines through the room, shallow depth of field, warm gentle light and an atmosphere of trust and anticipation, restrained film texture.

**Continuity:**
- Inherits: Opening shot establishes the restaurant and warm palette.
- Progresses: Emotional high before the reversal.

### Shot 02 — 1-1B The discovery

**Shot size:** Medium close
**Composition:** Over Xiao Hong's shoulder toward the table
**Narrative purpose:** Reveal betrayal from her point of view.

**Characters:** Xiao Hong (dress), Xiao Ming (shirt), Xiao Fang (evening dress)

**Image prompt:**
> Cinematic still, medium close over-the-shoulder view from behind Xiao Hong (dress) as she freezes; at the table ahead, Xiao Ming (shirt) avoids her gaze while Xiao Fang (evening dress) lifts her drink with an unhurried, triumphant half-smile; crystal glass and candlelight retain the same upscale restaurant, shallow focus holds the pair at the table, warm amber light now carrying a cold undertone, tense atmosphere of shock and betrayal, subtle film texture.

**Continuity:**
- Inherits: Same restaurant, light, wardrobe, and Xiao Hong's completed entrance.
- Progresses: Hope -> shock.

## Final reminders

- Build the asset table before character lists and prompts.
- Describe an image, not backstory that cannot be seen.
- Use quality cues sparingly.
- Preserve exact asset naming within a scene unless a visible state changes.
- Empty shots need no character asset, but still need palette continuity.
- Natural descriptive prose generally works better than tag accumulation for current multimodal image models.
