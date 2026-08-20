---
name: continuous-shot-four-panel
description: Design and generate a cinematic 2-by-2 keyframe sheet showing four continuous moments from one shot.
---

# Continuous-Shot Four-Panel

Turn a scene reference, character reference, and action description into one cinematic `2 x 2` image representing four moments from a single continuous shot. Preserve character identity, environment topology, camera language, lighting, and physical motion across all panels.

## 1. Guided intake

Use no more than two short rounds to turn a vague idea into a production-ready shot. Give concrete recommendations rather than shifting all decisions back to the user.

| Information | Priority | Purpose |
|---|---|---|
| Environment reference | Required | Locks spatial structure, materials, lighting, and palette |
| Character reference | Required | Locks identity, clothing, body proportions, and accessories |
| Action or story beat | Required | Defines the complete physical progression |
| Aspect ratio | Recommended | Controls the output frame; infer when absent |
| Shot language | Optional | Shot size, composition, camera height, and movement |
| Time span | Optional | Total interval covered by the four moments |
| Visual route | Optional | Live action, anime, game cinematic, science fiction, and so on |

Never generate from missing required references unless the user explicitly changes the task to text-only concept exploration. Optional details use defaults after the second round.

### First-round patterns

When references and action are present:

```text
I have the environment reference: [observable environment anchors].
I have the character reference: [observable identity anchors].
The action progresses as: [concise progression].

The environment reference is approximately [ratio], so I recommend matching it to preserve the composition. For this [action type], I recommend [shot scheme] because [one practical reason]. Reply with changes or confirm and I will prepare the four moments.
```

When one required item is missing, list what is present and ask only for the missing reference or action. Explain why it is needed and suggest one concrete way to supply it. When the request contains only a sentence, ask for an environment image, character image, and the action from start to finish; offer two or three scene directions and one example action progression.

### Final confirmation

```text
Aspect ratio: [ratio and source]
Shot: [shot size] + [composition] + [camera position]
Time span: [duration], SC01 [time] -> SC02 [time] -> SC03 [time] -> SC04 [time]
Visual route: [route]

SC01: [start]
SC02: [trigger]
SC03: [development]
SC04: [result]

Confirm or tell me the one thing to change.
```

If the user already confirms a complete plan, generate without another round. After two rounds, fill missing optional information with defaults; do not bypass a missing required reference or action.

## 2. Aspect-ratio strategy

Priority:

1. An explicit user ratio.
2. The environment reference's ratio.
3. `16:9` landscape.

When environment and character references differ, prefer the environment ratio because it defines composition, and tell the user. Match measured dimensions to the nearest model-supported ratio:

| Approximate source | Standard ratio | Typical use |
|---|---|---|
| `16:9` | `16:9` | Cinematic landscape |
| `9:16` | `9:16` | Vertical short-form video |
| `4:3` | `4:3` | Classical, moderately square frame |
| `3:4` | `3:4` | Vertical portrait |
| `1:1` | `1:1` | Square social frame |
| `21:9` | Nearest supported ultra-wide ratio | Epic landscape |
| `2.39:1` | Nearest supported anamorphic ratio | Anamorphic cinema |

If the selected model does not support the exact ratio, surface the nearest supported option before generation rather than silently changing it.

## 3. Four-moment decomposition

```text
SC01, t = -T   -> initial state and held anticipation
SC02, t = 0    -> trigger and action onset
SC03, t = +T   -> physical development
SC04, t = +2T  -> completed action and residual emotion
```

- Progress evenly without teleporting between poses.
- Every panel is a physically plausible continuation of the previous panel.
- Prefer restrained cinematic change over arbitrary spectacle.
- Facial behavior evolves with the body's action and emotional timing.
- Track center of gravity, contact points, cloth inertia, hair motion, carried objects, footprints, debris, and other consequences.

## 4. Shot language

Defaults are a medium-full shot, a mild Dutch angle only when tension benefits from it, slightly low eye line, a natural `35-50 mm` equivalent lens, and controlled shallow depth of field. Do not apply a Dutch angle to every genre by rote.

| Scheme | Construction | Useful for |
|---|---|---|
| A. Overhead pressure | High angle, wider lens, subject lower in frame | Collapse, rising, struggle, helplessness |
| B. Low heroic angle | Low view, strong silhouette, sky or source behind | Charge, weapon draw, resolve |
| C. Side tracking | Eye-level side view, lateral composition, restrained motion cue | Running, stalking, emotional physical progression |
| D. Frontal confrontation | Eye-level frontal view, balanced or symmetrical frame | Duels and direct conflict |
| E. Extreme close-up | Face or detail, very shallow focus, micro-expression | Emotional rupture, realization, awakening |

Recommendations:

- Collapse or struggle: A or a restrained Dutch angle.
- Combat, weapon draw, charge: B or D.
- Stealth, observation, vigilance: C.
- Emotional rupture: E when body continuity is not the main information.
- Running or pursuit: C with physically motivated motion blur.

## 5. Continuity locks

Environment:

- identical geometry, anchors, object count, weather, time of day, light direction, and color temperature;
- no new or disappearing objects;
- only a prop directly affected by the action may change state.

Character:

- identical face, hair, clothing, body, complexion, textures, accessories, and carried props;
- no changing proportions, hairstyle, costume, or identity.

Action:

- each pose follows the previous pose through credible mechanics;
- progressive amplitude and center-of-gravity transfer;
- emotion follows physical timing;
- no impossible pose jumps.

Camera:

- same shot size, lens, camera side, angle, depth of field, and light treatment across all panels unless the user explicitly asks for a multi-shot board instead;
- this skill represents moments from one shot, not four unrelated cuts.

## 6. Generator configuration

- Choose a currently enabled image-edit or reference-image model with strong multi-reference consistency. Never assume an internal model name.
- Bind both the environment and character images to the generator node with an explicit mapping.
- Use one output image containing the full `2 x 2` sheet.
- Use the highest quality mode the selected model actually supports when its credit cost is acceptable to the user.
- Keep the prompt, references, model, parameters, and real-time credit estimate visible on the node.
- Create new generator/output nodes without covering existing work.

## 7. Prompt construction

```text
A cinematic 2x2 grid showing four sequential moments from one continuous camera shot across [TIME] seconds. Output aspect ratio: [RATIO].

Environment reference lock: [observable environment anchors]. The location, geometry, objects, weather, time of day, key-light direction, and color temperature remain unchanged in every panel.

Character reference lock: [observable identity anchors]. Face, hair, body proportions, clothing, materials, accessories, and carried objects remain identical in every panel.

Camera lock: [shot size], camera positioned [physical position and side], [composition], [camera height], [lens] equivalent, [depth of field]. The camera relationship remains fixed.

Top-left, SC01 at [time]: [initial pose, contact points, expression, cloth and environment response].
Top-right, SC02 at [time]: [trigger, first displacement, expression, inertia].
Bottom-left, SC03 at [time]: [developing action, center-of-gravity shift, expression, consequences].
Bottom-right, SC04 at [time]: [completed state, stable contact, residual motion, emotional result].

One continuous identity, one unchanged location, progressive anatomically plausible motion, coherent gravity and contact, consistent lighting and rendering. [CONFIRMED_STYLE_AND_QUALITY].

Negative: identity drift, different face, costume change, changing body proportions, duplicated subject, missing subject, new objects, disappearing objects, background redesign, topology change, weather change, time-of-day change, camera-angle change, lens change, broken anatomy, impossible balance, discontinuous action, watermark, logo.
```

### Panel labels

The source workflow requests `SC01`, `SC02`, `SC03`, and `SC04` at the bottom center of the four cells. Ask for simple white sans-serif labels only when the selected model can render stable text or the product exposes a real text-overlay tool. Otherwise keep the generated image text-free and deliver the panel mapping in the decomposition table; never pretend distorted model text is production-ready.

### Route-specific finish

| Confirmed route | Add only this compatible family |
|---|---|
| Live action | `cinematic photography, natural skin texture, motivated practical light, subtle film grain, physically coherent lens behavior` |
| 2D animation | `clean line art, disciplined cel shading, model-sheet consistency, controlled color script` |
| AAA game or CG | `cinematic game render, PBR materials, ray-traced light response, motion-capture-aware body mechanics` |
| Cyberpunk or science fiction | `motivated neon spill, rain-slick material response, controlled chromatic aberration, readable technology` |
| Dark horror or gothic | `restrained desaturated palette, directional hard shadow, fog depth, aged materials, horror-film lighting` |
| Period martial fantasy | `Chinese martial-cinema composition, period-coherent costume, atmospheric mist, controlled silk motion, warm-hour light` |

Do not mechanically append photorealistic, anime, 3D, and named-engine terms to the same prompt. A mild Dutch angle may add `tilted camera, controlled diagonal composition, emotional instability`.

## 8. Delivery

Provide:

1. A four-moment table.
2. Shot-language specification.
3. The complete generator prompt.
4. The generated `2 x 2` output node.

```markdown
| Panel | Time | Action | Expression or emotion | Continuity detail |
|---|---|---|---|---|
| SC01 | t = -5s | [description] | [description] | [description] |
| SC02 | t = 0s | [description] | [description] | [description] |
| SC03 | t = +5s | [description] | [description] | [description] |
| SC04 | t = +10s | [description] | [description] | [description] |
```

## 9. Worked example: memory in a snowy alley

Input: a `16:9` snowy-alley reference, a `3:4` reference of a woman in a black coat, and: `She stands in a snowy alley, remembers something, covers her face with one hand, and slowly crouches.`

Recommended plan:

- Ratio: `16:9`, following the environment.
- Camera: eye-level side view, mild `8-degree` Dutch angle, medium-close, `50 mm`, shallow focus.
- Duration: 12 seconds at `-4`, `0`, `+4`, and `+8` seconds.
- Route: live-action cinematic realism, cool ambience with one warm streetlight.

| Panel | Time | Action | Expression | Continuity detail |
|---|---|---|---|---|
| SC01 | `-4s` | She stands center-right in profile, hands down, head slightly lowered after stopping mid-walk. | Composed but tired, gaze lowered, lips held. | Breath dissipates; coat moves lightly; a shallow footprint trail stays behind her. |
| SC02 | `0s` | Her body stiffens and her left hand rises toward her temple. | Focus slips, pupils widen slightly, lips tremble. | Fingers tremble; warm backlight outlines the same profile; coat motion arrests with her body. |
| SC03 | `+4s` | Her left hand covers half her face; knees bend and torso folds as her weight drops. | Eyes close, brow tightens, lower lip held between her teeth. | Coat opens under gravity; hair falls forward; snow collects on the same shoulder. |
| SC04 | `+8s` | Fully crouched, arms around knees, forehead buried in her arms. | Emotion reads through a closed, vulnerable body shape. | Coat hem pools on snow; hair lies across her arms; the streetlight forms a solitary warm halo. |

Shot specification:

```text
Shot size: medium-close, retaining enough body to read the crouch.
Composition: side view with an approximately 8-degree Dutch angle.
Camera height: eye level.
Lens: natural 50 mm equivalent.
Depth: shallow focus, character sharp and alley depth reduced to soft light.
Light: warm streetlight from rear-left against cool diffuse night ambience.
```

Example prompt:

```text
A cinematic 2x2 grid showing four sequential moments from one continuous camera shot across 12 seconds, 16:9 output.

Environment reference lock: a narrow snowy alley at night, old brick walls on both sides, dark windows, thin snow on cobblestones, one warm yellow streetlight in the deep background, gentle falling snow. Geometry, objects, snow cover, weather, time, and light direction remain unchanged.

Character reference lock: one slender young adult woman in a calf-length black wool coat, dark shoulder-length hair, reserved facial design, dark inner clothing. Face, hair, body, coat cut, fabric, and proportions remain identical.

Camera lock: medium-close side view from the character's right, eye level, approximately 8-degree Dutch angle, 50 mm equivalent and shallow depth of field. The alley recedes into soft bokeh; camera relationship remains fixed.

Top-left, SC01 at -4s: she stands center-right in profile after stopping, arms hanging, head slightly lowered, visible breath dissolving, coat responding to a light breeze, shallow footprints behind her, composed but weary expression.

Top-right, SC02 at 0s: the same body stiffens without changing position, left hand beginning to rise toward the temple, fingertips trembling, gaze losing focus, lips barely moving, warm streetlight tracing the profile.

Bottom-left, SC03 at +4s: the left hand now covers half the same face, knees bend, torso folds, center of gravity moves downward, eyes close and brow tightens, coat opens naturally under gravity, hair slips forward, snow remains on the shoulder.

Bottom-right, SC04 at +8s: she is fully crouched at the same point, feet and coat grounded in the snow, arms around knees and forehead in the crook of the arms, coat hem pooled like a dark shape, hair across the sleeves, warm streetlight creating one isolated halo.

Live-action cinematic photography, cool blue ambient night against motivated warm backlight, natural skin and fabric, subtle film grain, volumetric snowfall, restrained color grade, one continuous identity and environment, physically progressive action.

Negative: identity drift, different face, costume change, scale change, duplicated character, new props, disappearing objects, background redesign, changing snow, changing streetlight, camera change, broken anatomy, teleporting pose, floating body, text, watermark, logo.
```

## 10. Revisions

- One panel: change only that moment's description, preserve the other three, and regenerate into a new node.
- Camera: update the camera block, preserve the action progression, and regenerate into a new node.
- Rhythm: redistribute timestamps and adjust physical increments.
- Style: replace the route block without changing identity or action.
- Ratio: update the supported ratio and recompose every panel.
- Dissatisfaction: identify whether the failure is identity, action, light, style, camera, or topology; revise only the relevant locks; generate a new comparison node rather than overwriting the approved source.

## 11. Short aliases

Interpret these English aliases when the user uses them:

| Alias | Meaning |
|---|---|
| `/shot-a` | Overhead pressure |
| `/shot-b` | Low heroic angle |
| `/shot-c` | Side tracking |
| `/shot-d` | Frontal confrontation |
| `/shot-e` | Extreme close-up |
| `/live-action` | Live-action finish |
| `/anime` | 2D animation finish |
| `/aaa` | AAA game or CG finish |
| `/cyberpunk` | Cyberpunk science fiction finish |
| `/dark` | Dark horror or gothic finish |
| `/period-fantasy` | Period martial-fantasy finish |
| `/regenerate` | Create a new generator/output node with the same parameters |
| `/adjust-SC02` | Revise only the named moment |
| `/ratio 9:16` | Change the output ratio when supported |
