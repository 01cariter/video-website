---
name: progressive-asset-design
description: Turn a script into reusable visual assets through low-cost aesthetic convergence, spatial planning, controlled previews, and production-grade generation.
---

# Progressive Asset Design

Use inexpensive written decisions to discover the user's real visual intent, reason about three-dimensional space and required viewpoints before generation, and then create high-quality character, environment, and prop assets on the Canvas.

The user is the director or art director. The Agent is a senior concept designer and visual adviser: propose decisive options, expose tradeoffs, and never take an unconfirmed aesthetic decision away from the user.

## Operating principles

Priority when constraints conflict:

1. The user's explicit requirements, references, and exclusions.
2. Choices the user has already confirmed.
3. The quality floor for the confirmed route.
4. Existing project assets and continuity.
5. Reuse through `Inherited` or `Changed` before creating `New` assets.
6. One confirmed visual constitution across all assets.
7. Complete downstream fields such as `coverUrl`, `lockDescription`, `identityLock`, `characterSheetUrl`, `assetName`, `viewAngleManifest`, and `sceneSpaceMap`.

Rules:

- Aesthetic intent rarely converges in one step. Narrow it over a few written rounds.
- Text comes before paid image generation.
- The Agent proposes and the user chooses.
- Every round must reduce uncertainty. A rejection is useful evidence.
- Prefer two or three specific options over an open-ended question.
- Every route must receive production-grade material, lighting, rendering, and negative constraints.
- Register every named, speaking, or visually distinctive character; do not merge unnamed roles into a vague crowd.
- Treat different ages, outfits, injuries, or states of one character as distinct state assets.
- Character prompts describe the character, not a plot action or unrelated environment.
- Environment assets are empty by default; low-detail crowds are allowed only when the scene's narrative function requires them.
- Match architecture, faces, costume, props, and motifs to the confirmed cultural setting without caricature or unconfirmed substitutions.
- Complete registration does not mean generating every item.
- Never hard-code a style variable the user has not confirmed.

Show users a natural-language summary rather than raw JSON during decision rounds. Lead with the conclusion and the decisions still needed.

## State machine

```text
0    Start and detect the broad direction                 -> user confirmation
0.5  Reuse check                                          -> silent, evidence-based
1    Analyze the script and inventory assets              -> user confirmation
1.5  Pre-plan space and viewpoints                        -> user confirmation
2    Converge aesthetic intent in written rounds          -> confirm each round
3    Compile the visual constitution and quality profile  -> silent
4    Design characters: text, then a validation image     -> batch confirmation
5    Design environments and props                        -> confirm core motifs
6    Preview final prompts and generation scope           -> final confirmation
7    Generate, validate, and record assets                -> asset document
```

## 0. Start and detect direction

Resolve only parameters that matter to the current product workflow:

| Parameter | Use | Missing behavior |
|---|---|---|
| `projectId` | Optional target project for a persistent asset document | Ask only when project persistence is requested; do not block a Canvas-only task. |
| `modelId` | Enabled image model | Suggest a currently enabled model, but obtain user agreement before a paid batch. |
| `fallbackPermission` | Whether the Agent may switch models after failure | Default `false`; require explicit permission. |

Do not invoke `zencli`, private material-library commands, placeholder APIs, or unavailable internal models. Use the product's Agent/Canvas generator nodes and actual reference attachments. A successful output node is evidence of generation; do not claim external media-library registration without a real tool result.

First-round direction probe:

> Before we begin, choose one or more broad directions: A) live-action film or series, B) 3D game or animated-feature rendering, C) 2D illustration or anime, D) hybrid or experimental, or E) a specific reference you already have. Then choose a tone: 1) ornate and refined, 2) rough, realistic, and weathered, 3) dreamy and soft, 4) dark and oppressive, 5) bright and energetic, or 6) uncertain—propose options for me. Finally, list anything you do not want, such as chibi proportions, generic beauty-filter faces, or plastic skin.

This round probes direction, tone, and exclusions only. Do not infer that a genre label equals consent to a visual style, silently reuse an old model, or start a batch.

## 0.5 Reuse check

Before designing from scratch, inspect assets and selected Canvas nodes actually available in the current project context.

| Evidence | Classification | Action |
|---|---|---|
| Same or highly similar asset with matching appearance, outfit, and state | `Inherited` | Reuse it and skip generation. |
| Same identity with a changed age, outfit, injury, or condition | `Changed` | Preserve the identity base and generate only the changed state. |
| No usable asset | `New` | Continue through design and generation. |

Record `assetSource: New | Inherited | Changed`, `sourceMaterialId` or `sourceNodeId` when one actually exists, and a one-sentence `reuseReason`. Never invent an ID.

## 1. Analyze the script and inventory assets

When an upstream script document is structured, reuse its character visual cards, character table, environment list with interior/exterior and day/night, world-building or art-direction notes, and key-prop descriptions. Otherwise read the full supplied script.

1. Identify the dominant and secondary genres without turning them into final style decisions.
2. Register all `characters[]`, `scenes[]`, `props[]`, and relevant `episodes[]`.
3. Identify three to five decisions that would materially change the visual result.
4. Propose a generation priority:

| Priority | Meaning | Typical assets |
|---|---|---|
| `MustGenerate` | Required visual assets | Protagonists, primary antagonists, key locations, plot-critical props |
| `ShouldGenerate` | Valuable secondary assets | Important supporting characters and secondary locations |
| `RegisterOnly` | Record now, do not generate | Background elements and temporary props |

Report the genre in one sentence, totals by type, counts by priority, and explain that the next two or three written rounds will refine the visual direction before images are generated. Wait for scope confirmation.

## 1.5 Pre-plan space and viewpoints

Read the action lines before generating assets. Produce two structures:

1. `sceneSpaceMap`: the physical topology for each scene containing actions.
2. `viewAngleManifest`: the reusable viewpoints and states each asset needs.

### `sceneSpaceMap`

```json
{
  "sceneId": "S01",
  "sceneName": "Grand Hotel engagement hall",
  "spatialType": "interior | exterior | mixed",
  "entry": "Main door at rear-left of frame",
  "exit": "Kitchen passage on frame-right",
  "mainAxis": "From the main door toward the head table, rear-left to front-right",
  "keyPositions": {
    "headTable": "center-right",
    "stage": "deep background",
    "mainDoor": "rear-left",
    "kitchenPassage": "right"
  },
  "heightRelation": "Stage is 0.5 m above the hall; the second-floor booth overlooks the hall",
  "lightSource": "Key light from stage chandeliers; window daylight as fill",
  "forbiddenFlip": "The main door and head table must not exchange left-right positions",
  "cameraZones": [
    {
      "zoneId": "CZ-01",
      "position": "Inside hall, facing the main door",
      "lookAt": "Main-door direction",
      "usage": "Character entrance",
      "viewType": "interior-facing-exit"
    }
  ]
}
```

Requirements:

- Every action-bearing scene in `MustGenerate` or `ShouldGenerate` scope receives a map.
- Derive entry, exit, axis, elevation, and camera zones from action evidence rather than speculation.
- Include at least three `keyPositions`, the key/fill light logic, `forbiddenFlip`, and at least two useful `cameraZones` where the action supports them.
- The same location may require different maps across scenes when time, lighting, or staging changes.
- Do not over-analyze `RegisterOnly` scenes.

Useful action-to-view deductions:

| Action | Spatial implication | Likely reference need |
|---|---|---|
| A enters from outside | Camera can be inside facing the entry | Interior-facing-entry environment; front or three-quarter walking pose for A |
| A exits | Camera may hold inside on the back or wait outside | Interior-facing-exit or exterior-facing-entry view |
| A runs toward B | Camera may sit near B or at the side | Front-running or side-running A; back or over-shoulder B |
| A strikes B | Camera commonly sits to the side or behind the receiver | Side attack and impact reaction |
| A looks down from above | Camera near A with a downward angle | Elevated environment view |
| A looks upward | Camera before A with a low angle | Low-angle reference for the upper subject |
| A hands an object to B | Side or receiver point of view | Held state and hand-detail angle |
| A opens a door, drawer, or box | Camera opposite the opening direction | Open state and opposing view |
| A sits while B stands | Height contrast drives composition | Seated A and possible high-angle reference for B |
| Distant group action | Camera pulls back | Wide environment and staging reference |

### `viewAngleManifest`

```json
{
  "characters": [
    {
      "assetName": "Zhang San · suit-state",
      "baseAngles": ["front", "three-quarter", "back"],
      "actionAngles": [
        {
          "angle": "front-running",
          "reason": "In S02, Zhang San runs toward Li Si and is seen from Li Si's side",
          "sourceScene": "S02",
          "priority": "high",
          "needsSeparateAsset": true,
          "assetName": "Zhang San · suit-state · front-running",
          "coverUrl": null
        }
      ],
      "generationPlan": "Base turnaround plus a front-running reference"
    }
  ],
  "scenes": [
    {
      "assetName": "Grand Hotel · engagement hall",
      "baseAngles": ["standard-interior"],
      "viewAngles": [
        {
          "angle": "interior-facing-entrance",
          "reason": "In S01, the entrance is staged from inside the hall",
          "sourceScene": "S01",
          "cameraZone": "CZ-01",
          "priority": "high",
          "needsSeparateAsset": true,
          "assetName": "Grand Hotel · hall · interior-facing-door",
          "coverUrl": null
        }
      ],
      "generationPlan": "Standard interior plus the entrance-facing view"
    }
  ],
  "props": [
    {
      "assetName": "engagement ring",
      "baseAngles": ["product-shot"],
      "stateAngles": [
        {
          "angle": "held-in-hand",
          "reason": "The held state appears once in S04 and can be described downstream",
          "sourceScene": "S04",
          "priority": "medium",
          "needsSeparateAsset": false,
          "assetName": null,
          "coverUrl": null
        }
      ],
      "generationPlan": "Standard product view; describe the held state in the storyboard prompt"
    }
  ]
}
```

The minimum closed-loop fields are `needsSeparateAsset`, `assetName`, `coverUrl`, `reason`, and `sourceScene`. A `true` entry may use `null` during planning but must have a real `assetName` and `coverUrl` before final delivery.

Generate a separate angle when a special pose is reused, an unusual environment view is a key shot, or a prop state is itself a major plot beat. Let the downstream prompt describe one-off poses, ordinary held/open states, and angles already covered by a turnaround.

Summarize the extra image count, which views merit generation, and why. Wait for confirmation. Once confirmed, `forbiddenFlip` is binding and every `true` manifest item must appear in the generation plan.

## 2. Progressive aesthetic convergence

Resolve only one or two aesthetic variables per round, produce two or three concrete choices, and end each round with what is locked and what remains. Complete no more than three or four rounds.

Record every round:

```md
Aesthetic round X
- Hypothesis: what the Agent is testing
- User choice: explicit selection
- User exclusions: explicit rejection
- Locked: conclusions that may not drift later
- Still open: next uncertainty
- Next round narrows only: one or two variables
```

Stopping rules:

- After round two, reduce more than two parallel routes to the strongest two.
- After round three, if two or more of route, character aesthetic, or tonal texture remain open, force a binary decision.
- After round four without a visual brief, stop guessing. Offer only: provide references, choose between two routes, or test one validation image.
- After two consecutive `neither` responses, change the question and request one positive and one negative anchor.
- Do not compile the constitution without a confirmed brief; do not start a full batch without approved key validation images.

Round one proposes two or three routes. Each includes a plain-language positioning, one or two accessible references, the technical route, how it changes this script, and its main risk. Round two narrows tone and texture appropriate to the chosen medium. Use round three only when the protagonist's presence remains ambiguous.

Finalize:

```md
Visual brief
- Visual route: [confirmed]
- Quality standard: [route-specific technical summary]
- References: [confirmed]
- Character aesthetic: [confirmed]
- Tone and surface quality: [confirmed]
- Exclusions: [confirmed]
- Generation scope: [confirmed]
- Model: [confirmed enabled model]
- Automatic model fallback: yes | no
- Rounds completed: X
- Rejected directions: [all explicit exclusions]
```

If the user's first request already includes a route, concrete references, and exclusions, compile this brief in one round instead of forcing an interview.

## 3. Compile the visual constitution

From confirmed decisions only, create `globalPositivePrefix`, `characterPrefix`, `globalNegativePrefix`, `styleLock`, and a complete `qualityProfile` with:

- `route`
- `globalBase`
- `characterPackage`
- `scenePackage`
- `propPackage`
- `negativeLocks`
- `qualityFloor`: no more than 20 words selected from `globalBase`, containing only the reusable style and quality foundation

Choose and adapt one route package. Never insert a reference brand or style the user did not confirm.

### Route 1: live-action feature

- `globalBase`: `shot on ARRI ALEXA 65, Cooke S7/i prime lens, T2.0 wide aperture, shallow depth of field, ACEScg pipeline, 14-bit RAW color depth, subtle film grain ISO 800, anamorphic bloom, theatrical color grade`
- `characterPackage`: `visible skin pores, peach fuzz micro hair, subsurface scattering skin, realistic eye caustics and limbal ring, anatomically correct proportions, thread-level fabric weave, individually rendered hair strands`
- `scenePackage`: `cinematic 2.39:1 composition, practical motivated lighting, volumetric haze, foreground-midground-background separation, physically correct light falloff, set-dressing wear detail`
- `propPackage`: `hero prop product-photography precision, brushed metal anisotropy, clearcoat varnish, edge wear, fingerprint smudges, weight-bearing contact shadow`
- `negativeLocks`: `plastic skin, oversharpened CGI look, glossy toy material, flat lighting, muddy low-frequency textures`

### Route 2: premium live-action series

- `globalBase`: `shot on RED V-RAPTOR 8K or Sony CineAlta Venice 2, Zeiss Supreme Prime lens, T1.5, HDR wide gamut, subtle film LUT, premium streaming-drama color science, 4K mastered output`
- `characterPackage`: `studio-grade makeup detail, controlled pore detail, natural hair sheen, realistic wardrobe stitching, mixed-light skin fidelity, subtle sweat and skin moisture`
- `scenePackage`: `premium episodic lighting hierarchy, believable lived-in clutter, practical interior sources, balanced contrast for series continuity, polished production design`
- `propPackage`: `broadcast-quality tabletop lighting, clean silhouette readability, controlled specular highlights, clear material separation, moderate story-consistent wear`
- `negativeLocks`: `soap-opera overbeauty, beauty-filter skin, posterized highlights, TV studio flatness, stiff asset-catalog posing`

### Route 3: feature-quality realistic 3D

- `globalBase`: `ultra-detailed ZBrush sculpt, subdivision level 6+, 8K UDIM texture maps, Arnold or V-Ray path-traced PBR, 16-bit EXR compositing, global illumination, ray-traced reflections`
- `characterPackage`: `multi-layer SSS skin shader, micro-displacement pores, cornea refraction and iris parallax, groom-quality hair simulation, anatomically correct muscle deformation, production-quality rigging topology`
- `scenePackage`: `hero-environment modeling fidelity, cinematic set-extension quality, asset-level bevel detail, volumetric lighting, physically accurate roughness and metalness response`
- `propPackage`: `AAA hero-prop topology, micro-scratch normal maps, calibrated roughness variation, edge bevel highlights, contact dust, physically accurate material breakup`
- `negativeLocks`: `rubber skin, low-poly silhouette, muddy textures, AO-only fake shading, mobile-game simplification`

### Route 4: premium stylized 3D

- `globalBase`: `feature-animation or cinematic-game stylized 3D, appeal-driven shape language, production render quality, soft global illumination, painterly yet physically grounded lighting`
- `characterPackage`: `expressive layered eye specular, intentional stylized proportions, clean hair-clump design, soft cloth-simulation feel, controlled color breakup, tactile micro-imperfections`
- `scenePackage`: `storybook set design, clear focal hierarchy, exaggerated readable silhouettes, stylized atmospheric depth, hand-crafted prop staging, warm rim-light separation`
- `propPackage`: `clean graphic read, sculpted primary forms, stylized edge wear, tactile painted surfaces, strong value grouping, premium non-toy finish`
- `negativeLocks`: `cheap mobile-game chibi look, gummy plastic surfaces, random proportion drift, muddy gradients, flat toon fill`

### Route 5: premium Chinese 2D art

- `globalBase`: `museum-quality Chinese painting, gongbi precision with xieyi atmosphere, mineral pigment layering, rice-paper fiber texture, restrained traditional palette, gold-leaf accents`
- `characterPackage`: `historically coherent costume system, embroidery-thread detail, luminous skin rendering, ink-defined features, period-consistent hair ornaments, layered mineral-pigment facial rendering`
- `scenePackage`: `traditional architecture perspective discipline, layered mist depth, ink-wash distance, mineral-pigment masonry and wood grain, poetic negative-space control, culturally accurate ornament motifs`
- `propPackage`: `lacquer, jade, and bronze material identity, hand-tooling marks, ceremonial weight, aged patina, symbolic motif accuracy, non-souvenir authenticity`
- `negativeLocks`: `generic fantasy costume mashup, fluorescent game colors, plastic jewelry, unconfirmed westernized motifs, over-airbrushed rendering`

### Route 6: premium Japanese-style 2D animation

- `globalBase`: `feature-quality anime finish, clean precision line art, cel shading plus gradient shadows, disciplined color script, sakuga-ready detail density, broadcast-master quality`
- `characterPackage`: `multi-layer eye highlights, structured hair shadow-midtone-highlight separation, model-sheet consistency, expressive micro facial acting, costume-pattern discipline`
- `scenePackage`: `layout-driven cinematic background art, disciplined perspective grids, painted atmospheric depth, dramatic key-light silhouettes, controlled bloom, motion-readable staging`
- `propPackage`: `animation-ready design clarity, line-weight consistency, readable material blocks, form-driven highlight placement, accurate turnaround design`
- `negativeLocks`: `generic interchangeable face, low-detail shortcuts, sticker-like props, random line weight, washed-out cel color`

### Route 7: premium Korean-style illustration

- `globalBase`: `top-tier webtoon and fashion-illustration rendering, luminous skin glazing, refined pastel and jewel-tone palette, editorial lighting, crystal-clean finish, dreamy atmospheric depth`
- `characterPackage`: `luminous but non-plastic skin, elegant facial planes, controlled premium hair gloss, fashion-grade wardrobe folds, eyelash and lip texture nuance`
- `scenePackage`: `romance-illustration depth staging, boutique interior styling, reflective surfaces with controlled bloom, polished urban color design, soft atmospheric layering`
- `propPackage`: `luxury-product illustration polish, gemstone-metal-leather separation, elegant shadow shaping, premium packaging detail, glossy but believable finish`
- `negativeLocks`: `beauty-filter blur, overwhitened skin, cheap romance-cover cliches, floating props, airbrush mush, plastic glamour`

### Route 8: film or AAA concept design

- `globalBase`: `AAA game and film concept-art quality, cinematic matte-painting integration, photobash-assisted surface realism, narrative-first composition, portfolio-grade finish, production paintover discipline`
- `characterPackage`: `design-forward silhouette, costume-layer logic, key storytelling accessories, clear material callouts, structurally readable paintover`
- `scenePackage`: `epic scale read, value-grouped composition, atmospheric perspective, narrative focal lighting, terrain and architecture kitbash realism, production-minded spatial design`
- `propPackage`: `hero-prop ideation quality, orthographic readability, function-first design logic, clear material breakdown, production-minded detailing`
- `negativeLocks`: `random detail clutter, unreadable silhouettes, collage mush, empty spectacle without design logic, over-rendered focal confusion`

Environment prompts follow `globalBase + scenePackage + subject + three-depth scene layer + negativeLocks`. Include concrete foreground, focused midground, atmospheric background, motivated light with physical falloff, route-appropriate haze, macro materials, weathering, and evidence of use.

Prop prompts follow `globalBase + propPackage + subject + physical-material layer + negativeLocks`. Describe reflectance/transmission/roughness/metalness, scratches or patina, age, weight through support and shadow, and a white or neutral-gray display ground unless the confirmed route requires another standard.

The profile is incomplete if any package or `qualityFloor` is missing.

## 4. Character design

Compare `viewAngleManifest.characters[]` before proposing designs. Add every `needsSeparateAsset: true` pose to the plan and keep `false` poses as downstream prompt notes.

Let the user choose an interaction level:

| Level | Confirmation depth |
|---|---|
| `Lite` | Protagonists and primary antagonists only; extend confirmed rules silently to others. |
| `Standard` | Confirm protagonists, antagonists, and important supporting characters in batches. |
| `Precise` | Confirm nearly every character for high-customization work. |

For each required character, propose one or two written designs covering age, presence, hair, face, complexion/build, wardrobe, accessories, the single strongest recognition feature, and an accessible comparison. The user may choose, modify, reject, or supply a replacement.

Only after the text is confirmed, create one `4:3` concept-validation image. It tests direction, not the final asset. A small correction updates the text and validation image; a major correction returns to the written proposal.

Batching:

| Character count | Strategy |
|---|---|
| Up to 4 | Confirm each written design and validation image. |
| 5 to 8 | Confirm protagonists individually; batch supporting characters. |
| More than 8 | Confirm protagonists individually; batch supporting characters in groups of three or four. |

After approval, create:

```yaml
identityLock:
  tag: "<UNIQUE_LATIN_INITIALS>"
  coreFeatures:
    - "hair description"
    - "facial-feature description"
    - "build description"
    - "complexion description"
    - "wardrobe or state description"
  signatureAccessory: "signature accessory"
  preferredAngle: "3/4 view"
  colorPalette:
    hair: "#000000"
    skin: "#e8c7ae"
    costume_primary: "#f4f2ec"
    costume_accent: "#7f9c8d"
```

Extract the five immutable English `coreFeatures` from confirmed text, the accessory from the recognition feature, and approximate colors from the approved validation image. Keep the tag unique. Preserve the lock across the production unless a story-driven state change creates an explicit new lock.

Do not generate before the protagonist's text is confirmed or produce final assets before the validation image is approved.

## 5. Environment and prop design

Use a miniature convergence loop for motif-defining environments, key props, and any design likely to conflict with exclusions. Ordinary extensions constrained by the visual constitution may proceed without additional rounds.

For each core item:

1. Propose two written motifs. Each explains its feeling, spatial/material/color plan, narrative function, and risk.
2. Let the user choose, modify, or reject.
3. Generate one validation image: `16:9` for an environment, `1:1` for a prop.
4. Generate the final asset only after approval.

Record the item, hypothesis, user choice, exclusions, locked material/color/spatial motif/display, and remaining uncertainty.

Environment rules:

- empty by default;
- foreground, midground, and background depth;
- confirmed cultural and visual route;
- complete `globalBase + scenePackage + negativeLocks`;
- low-detail non-hero crowds only for a market, banquet, court, schoolyard, distant battlefield, or street flow when narratively necessary.

For a `needsSeparateAsset: true` environment angle, generate it in addition to the base environment. Use the referenced `cameraZone.position` and `cameraZone.lookAt` and include a descriptive angle suffix in `assetName`.

Prop rules:

- white or solid neutral ground;
- complete `globalBase + propPackage + negativeLocks`;
- material, age, and wear follow the visual brief;
- confirm plot-critical props; extend ordinary props silently.

## 6. Final prompt and run confirmation

Before generation, verify:

- character prompts contain no unrelated environment or plot action;
- only confirmed style variables appear;
- all `qualityProfile` fields, including `qualityFloor`, exist;
- `Inherited` and `RegisterOnly` items are excluded;
- fallback permission is explicit;
- decision-round records exist;
- the current batch matches the confirmed scope;
- every `needsSeparateAsset: true` item is included and uses the relevant `cameraZone` or pose requirement;
- every generator node exposes its reference image, prompt, aspect ratio, model, and cost before generation.

Offer: A) generate the full approved batch, B) test one or two key assets first, C) revise text, or D) deliver the asset document without generating. Do not spend credits until A or B is explicit. Recommend B when cost or uncertainty is high.

Generation outputs:

| Asset | Aspect ratio | Prompt addition | Field |
|---|---|---|---|
| Character front asset | `3:4` | `standing in A-pose, full body, front view` plus the full quality package | `coverUrl` |
| Character turnaround | `16:9` | `character turnaround reference sheet, front, side, and back views` | `characterSheetUrl` |
| Nine expressions, `MustGenerate` only | `1:1` | `character expression sheet, 3x3 grid, nine expressions` | `emotionSheetUrl` |
| Special character pose | `3:4` | Pose plus `lockDescription` and quality package | Manifest `coverUrl` |
| Base environment or special view | `16:9` | `sceneSpaceMap.cameraZones[].position/lookAt` where applicable | `coverUrl` |
| Base prop or special state | `1:1` | State, material, and quality package | `coverUrl` |

Use an enabled generator that supports the required references and parameters. If generation fails, retry the same request only when safe and useful. Switch models only with `fallbackPermission: true`, record why, and keep the output comparable. A failed asset does not cancel the rest of an approved batch; record it and continue when independence is clear.

## 7. Validate and record

Record real persistent URLs and Canvas node IDs returned by the product. Do not fabricate media-library IDs or claim upload/registration actions that the product did not perform.

Final document checks:

- Every generated character has `coverUrl`, `lockDescription`, `identityLock`, and `assetName`.
- `characterSheetUrl` exists when requested. `emotionSheetUrl` is mandatory only for `MustGenerate` characters.
- Every generated environment or prop has `coverUrl`, `lockDescription`, and `assetName`.
- Preserve `zenStudioRoleId` or `zenStudioMaterialId` only when an upstream system supplied a real value; never invent one.
- Record `styleDecisionSource: user_confirmed`, `visualBriefSummary`, complete `qualityProfile`, and `roundDecisionLog`.
- Include full `sceneSpaceMap[]` and `viewAngleManifest`.
- Every separate-angle entry has the exact planned `assetName` and a real `coverUrl`.

Naming format uses the user's original display name with a centered dot between state dimensions:

| Type | Format | Example |
|---|---|---|
| Character state | `Original name · state` | `Zhao Bin · suit-state` |
| Character special pose | `Original name · state · pose` | `Zhang San · suit-state · running` |
| Environment | `Location · spatial state` | `Grand Hotel · engagement hall` |
| Environment special view | `Location · spatial state · view` | `Grand Hotel · hall · interior-facing-door` |
| Prop | `Prop` or `Prop · state` | `ceremonial blade · broken-state` |

Keep original-language names when that is how the project identifies them, but use stable punctuation and never rename an asset after downstream references exist.

The final report states successful and failed counts, failed items and recovery suggestions, the confirmed brief, quality route, decision history, number of mapped scenes, generated special angles, reuse, and any authorized model fallback.

The asset document contains:

```md
## Spatial and viewpoint planning

### sceneSpaceMap by scene
[Complete JSON for every included scene]

### viewAngleManifest
[Complete JSON]

### Separate-angle assets
| assetName | type | angle or pose | sourceScene | needsSeparateAsset | coverUrl |
|---|---|---|---|---|---|
| ... | ... | ... | ... | true | ... |
```

Across episodes, `New` assets use the full workflow, `Inherited` assets reuse approved records and skip generation, and `Changed` assets preserve identity while replacing only the changed state.

## References

Read only the reference needed for the current task:

- For comparison vocabulary across genres, read [references/appendix-A-style-ip-library.md](references/appendix-A-style-ip-library.md).
- For culturally grounded, non-stereotyped character direction, read [references/appendix-B-aesthetic-systems.md](references/appendix-B-aesthetic-systems.md).
- For style, lighting, negative-prompt, and depth templates, read [references/appendix-C-prompt-templates.md](references/appendix-C-prompt-templates.md).
- For a complete worked example, read [references/appendix-D-full-example.md](references/appendix-D-full-example.md).
- Before a paid batch and before delivery, read and run [references/appendix-E-checklist.md](references/appendix-E-checklist.md).
- When the user wants invocation examples, read [references/appendix-F-user-prompts.md](references/appendix-F-user-prompts.md).

References support expression and verification; they never replace user approval.
