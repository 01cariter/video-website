---
name: asset-multiview-generation
description: Create identity-locked character, expression, environment, prop, and special-angle reference sheets from approved visual assets.
---

# Asset Multi-View Generation

Generate production reference sheets for approved characters, environments, and complex props. Every output must use the asset's real reference image and remain visually identical to its approved `coverUrl`.

Expected upstream data may include `lockDescription`, `coverUrl`, `qualityProfile`, generation priority, `sceneSpaceMap`, and `viewAngleManifest`.

Expected outputs:

- `characterSheetUrl`
- `emotionSheetUrl` for `MustGenerate` characters only
- `sceneMultiViewUrl`
- `propMultiViewUrl`
- `angleAssetUrls` when special-angle assets are requested

## Execution environment

Work through the product's Agent and Canvas tools:

1. Create an image-generator node for each requested asset.
2. Bind the asset's concrete canvas image or `coverUrl` as a reference image.
3. Select an enabled model that supports reference-image generation or editing; prefer the model used for the approved source when it is still enabled.
4. Put the complete prompt, aspect ratio, and supported parameters on the generator node.
5. Start generation and inspect the returned output node.
6. Record the persistent result URL in the asset document only after a successful result exists.

Do not invoke `zencli`, placeholder APIs, unavailable internal models, or imaginary upload commands. Do not claim that an asset was registered in a media library unless a real product tool confirms it.

## 1. Global invariants

### 1.1 No visible text

No sheet may contain text, subtitles, labels, annotations, row numbers, watermarks, logos, signatures, or typography.

Avoid positive terms such as `labeled`, `annotated`, `with text`, and `numbered grid`. Include this negative block in every prompt:

```text
TEXT_NEG = text, subtitles, captions, labels, watermark, letters, numbers, annotations, title, logo, signature, writing, words, typography
BG_NEG = complex background, patterned background, gradient background
```

Any visible writing is a failure and requires one retry with stronger text suppression.

### 1.2 Reference-to-asset binding

Every generated sheet requires a real reference image. Text descriptions are not a substitute.

| Output | Reference priority |
|---|---|
| Character turnaround | Character `coverUrl` |
| Expression sheet | Front-face crop from the turnaround, then character `coverUrl` as fallback |
| Environment multi-view | Environment `coverUrl` |
| Complex-prop multi-view | Prop `coverUrl` |

Rules:

1. Each generator node must contain its own reference image.
2. The URL or canvas attachment must be real and accessible, never a placeholder.
3. Skip an asset without a `coverUrl` and mark it clearly in the confirmation table.
4. List the exact reference for every item before generation.
5. One `@image:...` reference represents one concrete asset. Never use one generic image token for multiple characters, environments, or props.
6. Record `asset name / reference source / canvas @image binding / reference URL`.
7. If several attachments share a generic filename such as `image.png`, explicitly disambiguate them in the current turn or rename them before generation.
8. Character sheets use character references, environment sheets use environment references, and prop sheets use prop references. Never cross-bind them.

### 1.3 Visual gender anchor for character prompts

Before generating a character sheet, infer only the visible presentation needed to choose a neutral subject noun:

| Visible presentation | Suggested prompt noun |
|---|---|
| Adult feminine presentation | `woman` or `adult woman` |
| Adult masculine presentation | `man` or `adult man` |
| Young feminine presentation | `girl` |
| Young masculine presentation | `boy` |
| Uncertain | `person` or `character` |

This is a visual-description aid, not an identity claim. When uncertain, use `person`. Once the confirmation table records `genderAnchor`, use the same value for the turnaround and expression sheet. If `lockDescription`, reference image, and approved setting conflict, resolve the conflict before generation.

### 1.4 Style lock

- Prefer the source model when it is enabled and supports the required operation.
- Begin the prompt with the matching style-lock language.
- Explicitly exclude conflicting styles.
- Compare every result with `coverUrl` immediately.
- After two clearly drifting attempts, stop and report the failure instead of spending more credits.

| Source style | Positive lock | Conflicting-style negative |
|---|---|---|
| Live-action realism | `photorealistic, real person, cinematic photography` | `anime, cartoon, 2D, illustration, cel-shading` |
| Anime or animation | `anime style, 2D illustration, cel-shaded` | `photorealistic, photograph, real skin, 3D render` |
| 3D rendering | `3D render, CGI, PBR material` | `2D, flat illustration, photograph, anime` |
| Semi-realistic or stylized | `semi-realistic, stylized digital art` | `photograph, anime flat color, sketch` |

### 1.5 Background and framing locks

| Type | Background |
|---|---|
| Character turnaround | Solid light gray |
| Expression sheet | Solid light gray |
| Environment multi-view | The environment itself |
| Prop multi-view | Solid light gray |

Within one sheet, only angle or expression may change. Lock subject scale, position, crop, negative space, and lighting with:

- `identical framing`
- `same size`
- `same crop`
- `same position in every cell`
- `uniform lighting across all views`

## 2. Character sheets

### 2.1 Generation scope

| Priority | Turnaround | Expression sheet |
|---|---:|---:|
| `MustGenerate` | Yes | Yes |
| `ShouldGenerate` | Yes | No |
| `RegisterOnly` | No | No |

### 2.2 Character turnaround specification

| Setting | Requirement |
|---|---|
| Aspect ratio | `16:9` |
| Background | Solid light gray |
| Layout | Three full-body rows in the left column and three face rows in the right column |

Left column:

| Row | Angle | Constraint |
|---|---|---|
| 1 | Front | Entire body visible |
| 2 | Three-quarter | Body rotated about 45 degrees |
| 3 | Back | Fully facing away from camera |

Use one neutral standing A-pose. Only rotation changes; never add an action or alternate pose. Keep head and foot positions aligned.

Right column:

| Row | Angle | Relationship |
|---|---|---|
| 1 | Front face | Strictly matches the first body row |
| 2 | Three-quarter face | Strictly matches the second body row |
| 3 | Side profile | Adds nose, mouth, and jaw structure rather than mechanically matching the back view |

Use one neutral expression and identical head size, placement, and crop. Both columns must show the same character, outfit, style, proportions, skin tone, and lighting.

Prompt template:

```text
{styleLockPositive}, {qualityProfile.globalBase}, {qualityProfile.characterPackage},
character turnaround reference sheet, two-column layout,
left column: full body turnaround, front view / three-quarter view / back view,
right column: face close-up turnaround, front face / three-quarter face / side profile,
first two face rows match the first two body angles, third face row is a facial structure supplement,
{genderAnchor}, {lockDescription},
full body standing naturally in A-pose, only rotation changes, no other poses,
identical character size, identical head position, identical foot position,
head and shoulders portrait, neutral expression,
identical framing, identical head size, identical crop,
same face, same hairstyle, same outfit, same skin tone, same proportions,
solid light gray background, clean neutral gray backdrop,
no text, no labels, no annotations, no captions, no watermark,
{qualityProfile.negativeLocks}, {styleLockNegative}, {BG_NEG}, {TEXT_NEG}, {generalNegativePrompt}
```

Store the persistent result as `characterSheetUrl`.

### 2.3 Nine-expression sheet

| Setting | Requirement |
|---|---|
| Aspect ratio | `1:1` |
| Layout | `3 x 3` |
| Background | Solid light gray |
| Scope | `MustGenerate` only |

Expressions: `calm neutral / gentle smile / laughing / angry / sad / surprised / fearful / disgusted / determined`.

Every cell is a front-facing head-and-shoulders portrait. Only expression changes. Angle, head size, position, crop, identity, hair, outfit, and skin tone remain fixed. Prefer a front-face crop from the approved turnaround as the reference and reuse its `genderAnchor`.

```text
{styleLockPositive}, {qualityProfile.globalBase}, {qualityProfile.characterPackage},
character expression sheet, 3x3 grid layout,
{genderAnchor}, {core facial features from lockDescription},
front-facing head and shoulders portrait,
identical framing, identical head size, identical crop in every cell, only expression changes,
calm neutral, gentle smile, laughing, angry, sad, surprised, fearful, disgusted, determined,
solid light gray background, clean neutral gray backdrop,
same character, same hairstyle, same outfit, same skin tone,
no text, no labels, no annotations, no captions, no watermark,
{qualityProfile.negativeLocks}, {styleLockNegative}, {BG_NEG}, {TEXT_NEG}, {generalNegativePrompt}
```

Store the persistent result as `emotionSheetUrl`.

### 2.4 Special character angles from `viewAngleManifest`

This workflow must also turn every approved `needsSeparateAsset: true` entry into a real reusable visual asset.

1. Read `viewAngleManifest.characters[]`, `scenes[]`, and `props[]`.
2. Generate only entries whose `needsSeparateAsset` is `true`; keep `false` entries as downstream prompt requirements.
3. For a special character pose, start with `coverUrl`; use `characterSheetUrl` as an additional reference when available.
4. For an environment angle, use the named `cameraZone.position` and `cameraZone.lookAt`.
5. Generate a prop state only when the manifest explicitly requires a separate asset.
6. The generated asset name must exactly equal the entry's `assetName`.
7. After a persistent URL exists, write it back to that entry's `coverUrl`. A generated but unrecorded image is incomplete.

Return `angleAssetUrls[]` and the updated `viewAngleManifest` entries.

## 3. Environment multi-view

### 3.1 Scope

| Priority | Angle count |
|---|---:|
| `MustGenerate` | 3 |
| `ShouldGenerate` | 2 |
| `RegisterOnly` | 0 |

### 3.2 Confirm `sceneSpaceMap` first

An environment sheet shows one physical space from different observation points, not different locations. Reuse an existing complete `sceneSpaceMap`; create one only when absent.

```json
{
  "sceneId": "S01",
  "sceneName": "Scene name",
  "spatialType": "interior | exterior | mixed",
  "entry": "Entry direction",
  "exit": "Exit direction",
  "mainAxis": "Primary movement axis",
  "keyPositions": {
    "anchorA": "Position description",
    "anchorB": "Position description",
    "anchorC": "Position description"
  },
  "heightRelation": "Relative elevations",
  "lightSource": "Key and supporting light",
  "forbiddenFlip": "Left-right relationship that must not flip",
  "cameraZones": [
    {
      "zoneId": "CZ-01",
      "position": "Camera position",
      "lookAt": "Camera target",
      "usage": "Suitable shots",
      "viewType": "Angle type"
    }
  ]
}
```

Requirements:

1. Inherit the upstream map when present; do not create a competing prose map.
2. `keyPositions` contains at least three anchors.
3. `lightSource` is required and shared by all views.
4. `forbiddenFlip` is required.
5. `cameraZones` contains at least two zones: establishing and normal-use. A core environment may add a third signature zone.

### 3.3 Sheet specification

| Setting | Requirement |
|---|---|
| Aspect ratio | `16:9` |
| Layout | Two or three angles side by side |
| Background | The environment itself |

Choose:

- A: establishing view, always required;
- B: normal-use camera position, always required;
- C: signature position, core environments only.

Every angle shares the same topology, anchors, time, weather, and light direction. Anchor objects may not swap positions. Scale and perspective must remain physically coherent.

```text
{styleLockPositive}, {qualityProfile.globalBase}, {qualityProfile.scenePackage},
scene multi-view reference sheet, 2-3 views of the same location side by side,
A: establishing shot, B: main activity angle, C: signature angle,
{lockDescription},
spatial layout: {space boundary description},
anchor landmarks: {anchorA}, {anchorB}, and {anchorC},
main light source from {light direction},
entrance and exit: {entry and exit directions},
foreground: {foreground}, midground: {midground}, background: {background},
camera viewpoints: A {...}; B {...}; C {...},
consistent spatial layout across all views,
same architecture, same furniture, same props,
same lighting direction, same time of day, same weather,
physically correct proportions and perspective,
no text, no labels, no annotations, no captions, no watermark,
{qualityProfile.negativeLocks}, {styleLockNegative}, {TEXT_NEG}, {generalNegativePrompt}
```

Store the persistent result as `sceneMultiViewUrl`.

## 4. Complex-prop multi-view

Generate a prop sheet for vehicles, mecha, complex machinery, large weapons, composite equipment, structurally complex artifacts, and creatures or summoned entities. Skip simple blades, small objects, everyday items, and simple tools.

Decision test: if rotating it 90 degrees reveals important new structure, it needs multiple views; if it looks essentially the same, it does not.

| Priority | Complexity | Angle count |
|---|---|---:|
| `MustGenerate` | Complex | 3 |
| `ShouldGenerate` | Complex | 2 |
| Any | Simple | 0 |

| Setting | Requirement |
|---|---|
| Aspect ratio | `1:1` |
| Layout | Two or three angles side by side |
| Background | Solid light gray |

Angles: `hero angle`, `structure angle`, and `detail angle` for core props. Lock structure, proportions, texture, material, paint, wear, and every signature component.

```text
{styleLockPositive}, {qualityProfile.globalBase}, {qualityProfile.propPackage},
complex prop multi-view reference sheet, 2-3 angles side by side,
hero angle, structure angle, detail angle,
{lockDescription},
identical object in every view,
same paint, same wear, same texture, same detail,
identical object size, same scale, same proportion,
solid light gray background, clean neutral gray backdrop,
no text, no labels, no annotations, no captions, no watermark,
{qualityProfile.negativeLocks}, {styleLockNegative}, {BG_NEG}, {TEXT_NEG}, {generalNegativePrompt}
```

Store the persistent result as `propMultiViewUrl`.

## 5. Workflow

### Step 1: read and confirm

1. Read the approved asset document.
2. Extract `qualityProfile`, `lockDescription`, `coverUrl`, and priority. Extract `genderAnchor` for characters.
3. List all `needsSeparateAsset: true` manifest entries.
4. Identify the approved source style and its style locks.
5. Classify prop complexity.
6. Read each complete `sceneSpaceMap`; create only missing maps with the fixed schema above.
7. Build a reference-binding table in which every `@image` resolves to one asset.
8. Present the generation-scope table and wait for confirmation before spending credits.

The table must include:

- Characters: `genderAnchor`, reference source, `@image` binding, turnaround decision, expression-sheet decision.
- Environments: reference source, binding, angle count, and key `sceneSpaceMap` values: `sceneName`, `spatialType`, `keyPositions`, `cameraZones`.
- Props: reference source, binding, angle count, and complexity rationale.
- Special angles: manifest source entry, `assetName`, reference, execution decision, and write-back location.

### Step 2: generate in batches

Order:

1. Characters: `MustGenerate`, then `ShouldGenerate`.
2. Environments.
3. Complex props.
4. Approved special-angle assets.

For each `MustGenerate` character, first generate the turnaround, then use its front-face crop for the expression sheet. Generate a character's special pose immediately after its turnaround; generate an environment's special angle immediately after its multi-view sheet.

Before each node, switch to that asset's own reference and clear stale references. Every prompt attachment must map to exactly one row in the binding table.

### Step 3: validate

Run three checks on every result:

1. Text check.
2. Style and identity check.
3. Spatial check for environments.

Failures requiring retry:

- any text, subtitle, watermark, or annotation;
- different characters between columns;
- incorrect environment topology;
- missing critical prop structure;
- obvious style or identity drift.

Warnings that may proceed when usability is intact:

- slight subject-scale variation;
- minor negative-space inconsistency;
- small lighting-detail differences;
- slight crop drift.

Retry a failed output once. After two failures of the same class, stop that item and report it. Log warnings; retry once only when they materially reduce reference value.

### Step 4: record results

Write persistent URLs into the approved asset document only after the product returns successful media:

- Character: `characterSheetUrl`, plus `emotionSheetUrl` for `MustGenerate`.
- Environment: `sceneMultiViewUrl`.
- Prop: `propMultiViewUrl`.
- Special angle: exact `assetName` and `coverUrl` on the originating manifest entry; optionally aggregate `angleAssetUrls[]`.

### Step 5: deliver

Report asset name, type, generated content, text check, style check, spatial check when relevant, manifest write-back status, and final status.

## 6. Quality hierarchy

1. No visible writing.
2. A real reference image is mandatory.
3. Lock identity and style.
4. Inherit every applicable `qualityProfile` constraint.
5. Use light gray for character and prop sheets; retain the environment for scene sheets.
6. Lock composition inside each sheet.
7. Build or confirm `sceneSpaceMap` before environment angles.
8. Never introduce an unapproved design change.
9. Make complexity decisions explicit.

## 7. Troubleshooting

| Problem | Response |
|---|---|
| Visible writing | Fail; strengthen `TEXT_NEG` and retry once. |
| Style drift | Fail; reinforce the style lock and verify model/reference binding. |
| Different identity across cells | Fail; strengthen `same character, same outfit`. |
| Unrequested pose or action | Fail; strengthen `only rotation changes, no other poses`. |
| Contradictory environment topology | Fail; repair anchor relationships in `sceneSpaceMap`. |
| Slight composition drift | Warning; retry only if reference value suffers. |
| Minor lighting difference | Warning; a wrong key-light direction is a failure. |
| Disputed prop complexity | Follow the user's decision. |

## 8. Prompt floor

1. Put the style lock first.
2. Write coherent positive prose rather than a mechanical keyword pile.
3. State consistency constraints explicitly.
4. Environment prompts cite `sceneSpaceMap`.
5. Character and prop prompts require a solid light-gray background.
6. Negative constraints combine `qualityProfile.negativeLocks`, conflicting-style exclusions, `TEXT_NEG`, and `BG_NEG` where applicable.
7. Every generator node contains its own reference image.
