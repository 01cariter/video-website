---
name: script-assets-to-images
description: Extract complete character, location, and prop inventories from scripts, develop a coherent visual constitution, and create image-ready asset prompts.
---

# Script Assets to Images

Use this skill to turn a screenplay or prose narrative into a complete asset inventory and a coherent set of character, location, and prop images.

The central sequence is:

```text
Genre diagnosis
  -> reference comparison by abstract visual traits
  -> original visual direction
  -> exhaustive asset extraction
  -> global visual constitution
  -> progressive character casting
  -> location and prop development
  -> model-aware prompt assembly and Canvas generation
```

Reference works are diagnostic shorthand, never instructions to copy protected characters, logos, exact frames, or a living artist's style. Extract broad properties such as palette, material density, scale, or line energy, then combine them with story-specific motifs into an original system.

## Five-stage pipeline

1. **Analyze and extract:** identify genre, visual-direction candidates, cultural setting, episodes, script lines, characters, locations, and props. Draft one initial `imagePrompt` for every item.
2. **Build the visual constitution:** confirm 2D, 3D, or live-action medium; define line/render language, palette, material, light, and exclusions; output reusable positive, character-only, and negative prefixes when the selected model supports them.
3. **Cast characters progressively:** use the first lead as the anchor, validate the second against it, resolve uncertainty for the third, then infer later cast members within the locked system.
4. **Develop locations and props:** derive their rendering, palette, and cultural material from the accepted constitution while preserving their functional identity.
5. **Assemble and generate:** combine the relevant components for the selected Canvas image model, attach references, display real credit cost, and create one generator node per approved asset.

## Stage 1 — Analyze the script and extract assets

### A. Diagnose genre

Identify a primary narrative driver and optional secondary genre from actual evidence.

| Genre | Common evidence | Expected asset domains |
|---|---|---|
| Contemporary urban | company, commute, phone, apartment, city | modern architecture, current wardrobe, daily objects |
| Chinese cultivation fantasy | sect, qi, cultivation, elixir, talisman, immortal | mountain halls, arrays, flying swords, spirit creatures, cloud seas |
| Wuxia | martial clans, jianghu, internal force, escort agency | inns, bamboo forests, arenas, traditional weapons |
| Western-style fantasy | magic, elves, dragons, knights | castles, magical systems, creatures, premodern material culture |
| Science fiction | spacecraft, AI, mecha, cybernetics, genetics | stations, future cities, equipment, alien environments |
| Mystery or detective | case, suspect, clue, investigator, locked room | evidence, night city, interview room, controlled suspense lighting |
| Horror or supernatural | haunting, curse, ritual, seal, abandoned house | ruins, fog, night, aged interiors, uncanny objects |
| Romance | date, confession, longing, campus love | cafes, schools, flowers, intimate wardrobe, soft or emotionally contrasted light |
| Historical | dynasty, office, palace, battle, historical figure | period architecture, costume, military and ceremonial objects |
| Military or war | unit, rank, weapon, position, battlefield | camps, vehicles, uniforms, smoke, terrain |
| Children's or fairy tale | talking animals, enchanted forest, treasure | expressive characters, readable shapes, bright narrative environments |
| Hybrid | several strong evidence sets | Let the primary driver control; use secondary traits selectively |

```json
{
  "primaryGenre": "Chinese cultivation fantasy",
  "secondaryGenre": "coming-of-age adventure",
  "genreKeywords": ["sect", "spirit creature", "cultivation"],
  "genreConfidence": 0.95,
  "genreReason": "The central action follows a cultivation system and conflict between sects."
}
```

### B. Derive a medium and style candidate pool

Genre shapes audience expectations but does not dictate one aesthetic. Treat the table as a candidate map and defer to explicit user choices.

| Genre | Often compatible | Often requires a strong reason |
|---|---|---|
| Contemporary urban | semi-real 2D, elegant graphic drama, live action, modern 3D | historical ink or classical cel language |
| Cultivation fantasy | contemporary Chinese 2D, expressive ink, Chinese 3D, Eastern fantasy realism | unrelated contemporary glamour or Western comic shorthand |
| Wuxia | expressive ink, meticulous Chinese painting, live-action martial drama, low-key realism | cute school anime or Western cartoon comedy |
| Western fantasy | painterly fantasy, 3D fantasy, cinematic live action | unrelated school or ink conventions |
| Science fiction | cyber graphic 2D, hard-surface 3D, cinematic live action | classical historical language without a story reason |
| Mystery | low-key realism, cinematic photography, controlled graphic 2D | uniformly bright cute or fairy-tale treatment |
| Horror | Gothic, distressed realism, graphic horror | comforting bright cartoon language unless deliberately ironic |
| Romance | lyrical 2D, soft live action, watercolor, refined graphic style | grim hard-surface realism unless the story asks for it |
| Historical | cinematic period realism, meticulous line-and-color painting, painterly realism | cyber or cute stylization without narrative logic |
| Military | grounded live action, hard-surface 3D, restrained graphic realism | decorative cute or romantic treatment |
| Children's tale | bright 2D, storybook, friendly stylized 3D | graphic horror or punishing realism |

### C. Compare references by visual DNA

Offer three to six familiar works spanning different directions when the user needs concrete anchors. Analyze only:

- Medium and rendering density.
- Palette and contrast behavior.
- Line, silhouette, surface, and atmosphere.
- Composition and scale.
- The story type each treatment serves.

Example comparison bank:

#### Chinese fantasy and cultivation

| Reference work | Abstract visual DNA | Palette | Useful lesson |
|---|---|---|---|
| *Black Myth: Wukong* | dense dark realism, materially specific 3D | aged gold and near-black | adult myth, weathering, monumental detail |
| *Monkey King: Hero Is Back* | energetic Chinese 3D, painterly surfaces | warm gold and red | youthful momentum and growth |
| *Battle Through the Heavens* animation | bright accessible fantasy 3D | higher saturation | readable progression systems and visible energy |
| *Perfect World* animation | polished expansive fantasy 3D | jade green and gold | scale, celestial space, refined environments |
| *Ne Zha* | elastic Chinese 3D expression | fire red against ice blue | rebellious contrast and character energy |
| *The Island of Siliang* | lyrical Chinese fantasy 2D | pale violet and moon white | romantic lightness and poetic space |

#### Contemporary or graphic urban

| Reference work | Abstract visual DNA | Palette | Useful lesson |
|---|---|---|---|
| *Yao — Chinese Folktales* | varied experimental 2D rooted in Chinese art | episode-specific | contemporary transformation of traditional media |
| *Scissor Seven* | simple line economy with bursts of finish | strong color collision | comic-to-action contrast and street life |
| *White Cat Legend* | polished flat Chinese 2D | warm historical palette | urban texture mixed with light mystery |
| Makoto Shinkai films | light-driven 2D with photographic backgrounds | sky blue and sunset gold | light as emotional structure |
| *Spy x Family* | refined retro 2D | pink, green, muted neutrals | elegance balanced with comedy and family warmth |

#### Wuxia

| Reference work | Abstract visual DNA | Palette | Useful lesson |
|---|---|---|---|
| *JX3* | ornate Chinese 3D and faction-specific costume systems | faction palettes | ensemble readability and garment identity |
| *The Degenerate Drawing Jianghu* | shadowed 3D wuxia mystery | gray-brown with blood red | danger, intrigue, and harsh jianghu |
| *Hero* | minimal forms and color-chapter storytelling | red, blue, green, white | palette as narrative structure |
| *Storm Riders* | high-contrast Hong Kong comic energy | stark light/dark | exaggerated force and signature attacks |
| *Great Journey of Teenagers* | airy youthful Chinese 2D | blue-white and ink | elegant movement and camaraderie |

#### Science fiction

| Reference work | Abstract visual DNA | Palette | Useful lesson |
|---|---|---|---|
| *The Wandering Earth* | grounded industrial spectacle | cold blue and fire warmth | large-scale engineering and human urgency |
| *Cyberpunk: Edgerunners* | kinetic graphic cyber 2D | neon pink-violet against night | impact, speed, and dystopian saturation |
| *Ling Cage* | hard-surface post-apocalyptic 3D | gray with toxic green | biological machinery and wasteland survival |
| *Blade Runner 2049* | rigorously composed atmospheric live action | orange haze and cold blue night | philosophical scale and sculpted light |

#### Romance

| Reference work | Abstract visual DNA | Palette | Useful lesson |
|---|---|---|---|
| Makoto Shinkai films | luminous 2D where weather and light carry feeling | sky blue and dusk gold | longing and distance |
| *Kaguya-sama: Love Is War* | polished 2D with graphic comic exaggeration | elegant red and gold | romantic strategy and visual punch lines |
| *Violet Evergarden* | highly finished lyrical 2D | flower colors and soft blue-violet | healing, restraint, and emotional detail |
| *Love Between Fairy and Devil* | live-action romantic Chinese fantasy | mystical blue-violet and celestial white-gold | romance nested in fantasy spectacle |

Use this bank only when relevant; select current, recognizable references from knowledge available to the Agent, and never claim a live web comparison unless research was actually performed.

### D. Evolve an original visual direction

1. Extract two or three broad traits from each useful reference.
2. Select traits that serve this script's mood, production format, and audience.
3. Add visual motifs unique to the screenplay.
4. Produce two or three original proposals and ask the user to choose or refine.

Do not merely write “A's palette plus B's lines.” Describe the new interaction and why it belongs to this story.

```json
{
  "genreAnalysis": {
    "primaryGenre": "Chinese cultivation fantasy",
    "secondaryGenre": "coming-of-age adventure",
    "genreReason": "The story is driven by cultivation and sect conflict."
  },
  "referenceComparison": [{
    "workName": "Reference work",
    "styleDNA": ["weathered dark gold", "material specificity", "monumental scale"],
    "relevance": "The script combines Chinese mythic imagery with adult danger.",
    "borrowableTraits": "Weathered metallic palette and tactile material hierarchy"
  }],
  "uniqueStyleProposals": [{
    "id": "style_1",
    "name": "Dawn Through Tarnished Gold",
    "description": "A heavy ink-black and aged-gold world interrupted by a controlled red-gold warmth that follows the young protagonist.",
    "dnaSource": "Broad dark-material realism + youthful warm-light energy + the script's broken sun-disk motif",
    "colorPalette": "ink black and tarnished gold with restrained red-gold light",
    "textureDirection": "dense weathered surfaces with selectively luminous energy",
    "moodKeywords": "hope under pressure, heat inside darkness"
  }],
  "userQuestion": "Which original direction is closest? You can also reject all of them and name a work, material, color, or feeling to use as a new anchor."
}
```

If every proposal is rejected, ask for the nearest film, animation, game, artwork, palette, or material sensation. If the user has no reference, switch the candidate medium completely—for example, from primarily 3D proposals to 2D directions—and derive a new set.

### E. Cultural and identity evidence

Preserve cultural specificity without stereotyping.

- Infer **setting** from explicit language, institutions, architecture, clothing, history, and user direction.
- Do not infer a real person's ethnicity, skin color, facial geometry, or gender solely from a name.
- When identity is not explicit but visually consequential, ask once or leave it open in the asset record.
- Treat a fictional culture on its own terms; do not force modern national categories onto it.
- Match architecture, costume, objects, and crowd casting to the established place and period, including cosmopolitan or mixed populations when the story supports them.
- Preserve stated gender and age accurately. When they are unspecified, use neutral language rather than guessing from a name.

This replaces the source's unreliable name-to-ethnicity and nationality-to-beauty rules while preserving its actual goal: culturally coherent, non-stereotyped assets.

### F. Exhaustive extraction rules

1. Extract every visually relevant speaking and non-speaking character, named crowd type, location, implied location transition, and prop.
2. Use the script's name. Give an unnamed individual a stable role label such as `Old Daoist`; do not merge distinct individuals into “everyone.”
3. Treat materially different ages as separate entries, for example `Lin Dong — age 8` and `Lin Dong — adult`.
4. A merely mentioned person or object belongs in the inventory with `visualRequired: false` until a shot actually needs an image.
5. Keep the character prompt isolated: body and wardrobe only, no story action or location.
6. Keep the location plate free of principal characters unless the requested asset explicitly includes crowd scale.
7. Keep prop sheets isolated from character and environment.

### Initial prompt forms

Character sheet:

```text
[explicit age/gender only when known], [cultural context only when evidenced],
[build and proportions], [face, hair, eyes], [wardrobe color and material],
[accessories], [bearing], standing in a relaxed A-pose, full body,
neutral white background, character reference sheet, soft studio light
```

Children require accurate child proportions, scale, and face development. Avoid sexualized treatment.

Location plate:

```text
[geography, architecture, vegetation, surfaces], [composition and scale],
[motivated light and weather], [accepted medium/render language], no principal characters
```

Prop sheet:

```text
[shape and function], [material, color, wear, texture, cultural construction],
isolated, centered, neutral studio light, sharp detail
```

### Extraction contract

Keep schema keys stable:

```json
{
  "genreAnalysis": {
    "primaryGenre": "Primary genre",
    "secondaryGenre": "Secondary genre",
    "genreKeywords": ["evidence"],
    "genreConfidence": 0.95,
    "genreReason": "Reason"
  },
  "ipComparison": [{
    "ipName": "Reference work",
    "styleDNA": ["Abstract trait"],
    "relevance": "Relevance",
    "borrowableTraits": "Non-infringing broad traits"
  }],
  "uniqueStyleProposal": {
    "name": "Original direction name",
    "description": "Description",
    "dnaSource": "Abstract sources and story-specific motif",
    "colorPalette": "Palette",
    "textureDirection": "Surface/render direction",
    "moodKeywords": "Mood"
  },
  "episodes": [{
    "episodeSeq": 1,
    "episodeTitle": "Title",
    "episodeStartMark": "Exact first-source excerpt, up to 30 characters",
    "episodeEndMark": "Exact final-source excerpt, up to 30 characters",
    "characterNames": ["Character"],
    "sceneNames": ["Location"],
    "propNames": ["Prop"]
  }],
  "characters": [{
    "name": "Character",
    "description": "Source-grounded description",
    "tags": ["tag"],
    "ethnicity": "Explicit identity or unspecified",
    "aestheticSystem": "Accepted project visual system",
    "imagePrompt": "Prompt"
  }],
  "scenes": [{
    "name": "Location",
    "description": "Description",
    "culturalContext": "Established setting",
    "imagePrompt": "Prompt without principal characters"
  }],
  "props": [{
    "name": "Prop",
    "description": "Description",
    "imagePrompt": "Isolated prop prompt"
  }],
  "scriptLines": [{
    "sceneIndex": 0,
    "characterIndex": 0,
    "dialogue": "",
    "action": "Action",
    "emotion": "Emotion",
    "cameraHint": "Camera evidence if present",
    "episodeSeq": 1
  }],
  "ethnicityAnalysis": {
    "dominantEthnicity": "Explicit dominant identity or unspecified",
    "inferenceReason": "Evidence and uncertainty",
    "aestheticSystem": "Accepted project system",
    "needsUserConfirmation": false
  }
}
```

Episode segmentation:

- Up to about 1,000 Chinese characters, or a comparably short text, may be one episode.
- Roughly 1,000–5,000 may become two to five episodes if the source has clear divisions.
- Split long work on chapters, location changes, time jumps, and story turns.
- `episodeStartMark` and `episodeEndMark` must be exact source text, not paraphrases.

## Stage 2 — Global visual constitution

Confirm the abstract proposal, then convert it into a technical system.

### Three layers plus exclusions

1. **Medium:** `anime_2d`, `anime_3d`, or `live_action`—names are legacy schema values; interpret them as 2D illustration, 3D animation, and photographed/live-action realism.
2. **Specific language:** contemporary Chinese graphic art, cel animation, painterly fantasy, hard-surface realism, cinematic photography, or another original description.
3. **Character surface:** flat graphic, semi-real, game-CG, photoreal, tactile stop-motion-like, and so on.
4. **Exclusions:** unwanted medium leakage, graphic content, sexualization, horror intensity, logos, or project-specific forbidden elements.

Output:

- `globalPositivePrefix`: medium, visual language, palette, and rendering anchors.
- `characterPrefix`: character-sheet surface and beauty/appeal direction only.
- `globalNegativePrefix`: incompatible media and accepted exclusions, but only if the selected model supports negative prompts.

### Medium anchors

| Medium | Positive anchor |
|---|---|
| 2D | `2D illustration, hand-drawn visual language, digital painting, graphic color design` |
| 3D | `3D CGI render, modeled character and environment, volumetric three-dimensional light` |
| Live action | `cinematic photograph, real human and material texture, natural skin detail, motivated real-world light` |

If a negative-prompt field exists:

| Medium | Exclude |
|---|---|
| 2D | `3D CGI, photographed live action, photoreal human skin` |
| 3D | `flat 2D line art, cel-only shading, live-action photograph` |
| Live action | `anime, cartoon line art, flat illustration, 3D render, CGI look` |

Do not append unsupported negative syntax to a natural-language-only model.

### Character appeal direction

Translate the user's desired appeal into non-stereotyped design traits: approachable, elegant, formidable, weathered, radiant, dangerous, comic, ordinary, or uncanny. Do not force every character into conventional beauty. A villain can have dangerous charisma without erasing age, scars, disability, body diversity, or narrative truth. Avoid degrading racialized features and avoid “perfect symmetry” as a universal rule.

Assembly:

```text
globalPositivePrefix = quality appropriate to model + medium + original visual language + palette
characterPrefix = character surface + user-approved appeal direction
globalNegativePrefix = incompatible medium + user exclusions
```

## Stage 3 — Progressive character casting

Characters form one system rather than isolated designs.

### Progression

1. **Anchor character, usually the lead:** analyze the dramatic essence, select a design mode, identify one or two broad reference philosophies, evolve an original design, and show four meaningfully different proposals.
2. **Second character:** inherit the confirmed medium, surface, palette logic, and shape language; use the relationship to create contrast without leaving the system; show four proposals.
3. **Third character:** if the first two make the answer clear and the source is unambiguous, produce one best proposal with reasoning. If culture, role, or visual relation remains uncertain, offer two to four choices.
4. **Fourth and later:** infer automatically from the established system, asking only for exceptional creatures, cultures, or roles that genuinely conflict with it.

### Character design modes

| Mode | Fit | Visual tendency |
|---|---|---|
| Heroic epic | energetic lead, principled protagonist | clear value contrast, determined gaze, dynamic silhouette |
| Dark charisma | antihero, enigmatic rival | lower values, sharp silhouette, hard shadow contrast |
| Ethereal cultivation | immortal, sword cultivator | pale or restrained palette, flowing hair and fabric, airy negative space |
| Grounded hard realism | soldier, laborer, veteran | weight, wear, scars when scripted, functional build |
| Fresh lyrical | student, young scholar, intimate lead | soft palette, natural light, youthful restraint |
| Otherworldly | spirit, alien, creature | nonstandard color, eyes, surface, or anatomy tied to world rules |

### Reference philosophy, not copying

Choose widely recognizable references only to articulate philosophy, such as optimism, freedom, restraint, or faction-based costume coding. Combine:

```text
Reference A's abstract design principle
+ Reference B's abstract design principle
+ the script's unique identity, class, history, and motif
= an original character design
```

Never request a close duplicate of a protected character's face, outfit, insignia, or silhouette.

### Four-proposal axes

| Axis | Proposal 1 | Proposal 2 | Proposal 3 | Proposal 4 |
|---|---|---|---|---|
| Reference emphasis | principle A | principle B | synthesis | story-only original |
| Palette | warmer | cooler | controlled complement | near-monochrome |
| Bearing | restrained | expressive | grounded | light and agile |
| Detail | spare | ornate | tactile | idealized |

```json
{
  "characterName": "Lin Dong — age 8",
  "castingAnalysis": "Poor but stubborn; the design needs material humility and a visible inner light.",
  "referenceAnchors": [{
    "name": "youthful adventure archetype",
    "trait": "bright resolve without copied costume or face"
  }],
  "blueprints": [{
    "id": "bp_1",
    "label": "Stubborn Spark",
    "soul": "light under deprivation",
    "designPhilosophy": "Worn gray material, economical silhouette, alert warm eyes",
    "promptFragment": "A complete prompt fragment"
  }]
}
```

For the second character, derive relational contrast. A father in the same poor household may wear cleaner but equally modest fabric; deeper blue-green can mature the child's gray; steady affection can replace the child's restless determination.

### Character `promptFragment`

- Use the prompt language best supported by the selected model; English is the built-in default.
- Aim for 800–1,200 characters only when that detail is useful. Do not pad or exceed the model's effective prompt length.
- Put known age and gender early; do not use booru tokens such as `1boy` or `1girl` unless the model is known to benefit from them.
- Describe scale/proportions, face, hair, eyes, skin when relevant, clothing material and color, accessories, and bearing.
- Include `standing in a relaxed A-pose, full body, neutral white background, character reference sheet`.
- Use soft studio light, clean focus, and sufficient texture for reference reuse.
- Exclude scene action and story background.

## Stage 4 — Locations and props

Derive environment and prop style from the accepted constitution rather than asking for an unrelated aesthetic.

```text
Input: medium + line/render language + surface + palette + cultural setting
  -> extract the core visual grammar
  -> map it to architecture, landscape, object construction, and material aging
  -> add the same palette hierarchy and rendering behavior
```

Examples:

| Character system | Location derivation | Prompt direction |
|---|---|---|
| Chinese ink 2D | ink landscape and period architecture | `Chinese ink-wash visual language, traditional architecture, restrained color, atmospheric perspective` |
| Clean cel-like 2D | finished graphic background | `detailed animated background, clean lines, controlled vibrant color` |
| Realistic 3D | cinematic modeled environment | `photoreal 3D environment, physically based materials, volumetric light, ray-traced reflections when supported` |
| Live-action cinema | production-designed real location | `cinematic location photograph, motivated natural light, precise production design` |
| Soft romantic 2D | pastel lyrical environment | `soft pastel environment, gentle light, dreamlike but coherent atmosphere` |

Highest priority is medium consistency:

- 2D characters require 2D location and prop plates unless mixed media is an explicit choice.
- Live-action characters require photographic material and light.
- Preserve accepted palette relationships across all asset classes.
- Use the established period and place for architecture, crowds, garments, symbols, and manufacturing methods. Do not reduce an East Asian setting to one generic country, and do not ban culturally mixed crowds when the story is cosmopolitan.

Props inherit the same material rendering and palette but remain functionally legible. Distinguish ceremonial, everyday, damaged, magical, or technological states through construction and wear.

## Stage 5 — Prompt assembly and generation

```text
[globalPositivePrefix]
+ [characterPrefix for character assets only]
+ [asset promptFragment]
+ [asset-specific style and lighting]
```

Add `globalNegativePrefix` and asset-specific exclusions only through a supported negative-prompt parameter.

### Portable style directives

| Key | Prompt fragment |
|---|---|
| `2d_chinese` | `premium contemporary Chinese 2D animation language, variable line weight, digital compositing, atmospheric cinematic light` |
| `2d_japanese` | `high-finish cel-inspired 2D animation, clean line art, cinematic digital compositing, controlled effects` |
| `3d_stylized` | `polished stylized 3D animation, subsurface material response, coherent hair and fabric simulation` |
| `3d_realistic` | `physically based realistic 3D render, high-detail materials, volumetric light, ray tracing when supported` |
| `live_cinematic` | `cinematic film still, anamorphic spatial character, motivated production light, restrained film response` |
| `live_drama` | `high-end dramatic cinematography, natural lens behavior, high dynamic range, controlled production design` |

Do not promise a renderer, camera, resolution, or lens that the chosen model cannot meaningfully honor. Quality cues such as `professional, highly detailed, consistent art direction` are preferable to blindly appending “masterpiece, 8K.”

### Lighting library

| ID | Direction | Prompt fragment |
|---|---|---|
| `rembrandt` | Rembrandt | `Rembrandt lighting, controlled chiaroscuro` |
| `butterfly` | Butterfly | `butterfly lighting from above` |
| `tyndall` | Volumetric beam | `Tyndall light beams, motivated god rays` |
| `rim_backlight` | Backlit silhouette | `rim backlight, luminous contour` |
| `moonlight` | Cool night | `cold blue moonlight, nocturnal atmosphere` |
| `neon_split` | Neon split | `neon split lighting, colored urban illumination` |

### Precise translation of materials

When converting source descriptions to English, preserve identity and function first, then material, light, and technical form.

- `moon-white wide-sleeved flowing silk robe`
- `deep crimson-purple`
- `lustrous brocade silk`
- `gilt, gold-plated`
- `aged bronze, patinated copper alloy`

Do not translate a culturally specific title into a generic role when a recognized English rendering exists; add a brief explanation if necessary.

### Asset tags

```text
[CHAR_Name_Feature]       example: [CHAR_LinDong_Young_MoonWhiteRobe]
[SCENE_Name_Feature]      example: [SCENE_XuantianSect_Dusk]
[PROP_Name]               example: [PROP_TianyuanPearl]
```

For a character tag, prioritize age or role, then stable garment/appearance. For locations, add time or weather only when it defines the version. Props usually need only a stable name.

### Canvas generation

- Choose an available image model and supported dimensions.
- Attach approved character or style references.
- Put each asset in its own generator node and name the node with the asset tag.
- Show the real credit cost before running.
- Store the final prompt and parameters on the node so later Reuse or Quick Edit preserves lineage.

## Cross-episode inheritance

Compare each recurring asset with its prior accepted state.

| Source type | Meaning |
|---|---|
| `New` | First appearance in this episode |
| `Inherited` | Reuse the accepted asset without visible change |
| `Changed` | Same identity with wardrobe, injury, age, damage, or another visible change; generate a new variant |

Preserve face/identity through attached reference images or the provider's supported consistency mechanism; do not claim a `faceConsistency` parameter unless it exists. Override only changed wardrobe or state, and issue a new asset tag.

## End-to-end example

Script fragment:

> Lin Dong is eight, the youngest child of the Lin family. In worn gray cloth and bare feet, he stands at the edge of the training yard and looks toward distant Xuantiang Sect, whose masters are said to move mountains and ride flying swords. His broad-shouldered father, Lin Xiaotian, wears a blue-green martial uniform while training the clan's students. “Dong'er, your talent may be weak, but your father believes in you.” He touches the boy's shoulder. Tall parasol trees surround the Lin estate's rear training yard. A gold streak crosses the sky: a great spirit creature carries a Xuantiang elder overhead.

Genre analysis:

```json
{
  "primaryGenre": "Chinese cultivation fantasy",
  "secondaryGenre": "coming-of-age adventure",
  "genreKeywords": ["flying sword", "sect", "spirit creature", "cultivation talent"],
  "genreConfidence": 0.97,
  "genreReason": "A sect-based cultivation system and an apparently weak young protagonist drive the story."
}
```

Possible original directions after broad reference comparison:

1. **Dawn Through Tarnished Gold:** dense black-gold world, with a restrained warm red-gold light following the child; adult and hard-edged.
2. **Jade Dawn:** cool jade and gold cultivation space where the child's growth shifts gray toward warm dawn; expansive and accessible.
3. **Breaking the Shell:** brighter public-facing fantasy 3D, upgraded material specificity, and controlled warm energy; energetic without plastic surfaces.

Assume the user selects `Jade Dawn`.

```json
{
  "uniqueStyleProposal": {
    "name": "Jade Dawn",
    "dnaSource": "expansive celestial fantasy + a story-specific dawn-growth motif",
    "colorPalette": "jade green and gold with a gradual warm dawn transition",
    "textureDirection": "refined rendering and light atmospheric depth"
  },
  "characters": [{
    "name": "Lin Dong — age 8",
    "description": "Eight-year-old boy in patched gray cloth, barefoot, disadvantaged but determined",
    "ethnicity": "Chinese, established by the setting and source context",
    "aestheticSystem": "Jade Dawn project constitution",
    "imagePrompt": "Eight-year-old Chinese boy with accurate child proportions, small build, round youthful face, alert determined dark eyes, short unruly black hair, patched worn gray cotton tunic, barefoot, a restrained warm spark against the Jade Dawn palette, standing in a relaxed A-pose, full body, neutral white background, character reference sheet, soft studio lighting, precise cloth texture"
  }, {
    "name": "Lin Xiaotian",
    "description": "Lin Dong's father, broad and strong, blue-green martial uniform, demanding but affectionate instructor",
    "ethnicity": "Chinese, established by the setting and source context",
    "aestheticSystem": "Jade Dawn project constitution",
    "imagePrompt": "Middle-aged Chinese man, tall muscular build and broad shoulders, defined but humane face, steady warm eyes, black hair secured for training, fitted blue-green cotton martial uniform with a cloth belt, grounded protective bearing, standing in a relaxed A-pose, full body, neutral white background, character reference sheet, soft studio light, precise woven texture"
  }],
  "scenes": [{
    "name": "Lin family training yard",
    "description": "Stone practice court in the estate's rear garden, surrounded by tall Chinese parasol trees",
    "culturalContext": "fictional Chinese cultivation setting",
    "imagePrompt": "Jade Dawn visual constitution, traditional Chinese martial training courtyard, stone practice ground, tall Chinese parasol trees, period timber architecture, warm afternoon light passing through jade foliage, expansive composition, no principal characters"
  }]
}
```

Cast progressively: anchor the child's gray material and warm inner light; derive the father's deeper blue-green, heavier shape, and steadier gold from the same system; continue later family and sect characters within that palette and surface hierarchy.

## Quality checklist

- [ ] Primary and secondary genres follow source evidence.
- [ ] When useful, three to six references were compared by abstract visual DNA.
- [ ] The accepted direction is original and includes story-specific motifs.
- [ ] Every visually relevant character, location, and prop is inventoried.
- [ ] Different ages or major states have separate entries.
- [ ] Age and gender follow explicit evidence; unknown identity was not guessed from a name.
- [ ] Character sheets contain only the character, not location or story action.
- [ ] Location plates omit principal characters unless a crowd plate was explicitly requested.
- [ ] Props are isolated and functionally legible.
- [ ] Medium, palette, render language, and culture remain coherent across asset classes.
- [ ] Progressive casting used accepted earlier characters as constraints.
- [ ] Prompt length is useful rather than padded, and the selected model supports the syntax.
- [ ] Character references use a relaxed A-pose, full body, and neutral reference-sheet background.
- [ ] Generation nodes use actual supported parameters and show credit cost.

## Common failures and repairs

| Failure | Cause | Repair |
|---|---|---|
| Style conflicts with story | Genre and audience not diagnosed | Revisit genre evidence and intended medium |
| User cannot name a style | Question is too abstract | Compare concrete works by palette, medium, and material, then offer original proposals |
| Result looks like a copy | One reference dominated | Remove protected details; combine broad traits with unique story motifs |
| Character identity drifts | Insufficient source/reference evidence | Attach approved references and describe only stable known traits |
| Child looks adult | Age and proportion omitted | State exact child age, smaller scale, child proportions, and developmentally appropriate face |
| Gender presentation is wrong | Agent guessed or prompt conflicted | Use explicit source evidence and remove conflicting terms |
| Crowd or architecture contradicts place | Cultural setting was flattened | Re-read period, geography, institutions, and cosmopolitan context |
| 2D output leaks into 3D or photography | Medium anchors conflict | Strengthen one medium and use supported exclusions |
| Clothing material is vague | Translation lost material | Use precise fiber, weave, finish, and wear terms |
| Locations diverge from characters | Built independently | Derive every asset class from the same visual constitution |
| Later characters drift | No progressive casting | Reuse accepted palette, silhouette, line/render, and surface rules |
| Character sheet contains action | Story beat leaked into asset prompt | Keep pose neutral and move action to storyboard generation |
| Villain becomes generic ugliness | Appeal was equated with virtue | Design distinctive dangerous charisma while preserving story-grounded age and wear |
