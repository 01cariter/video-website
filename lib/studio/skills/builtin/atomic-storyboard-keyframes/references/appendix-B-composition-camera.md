# Appendix B — Composition, Camera Decisions, Atmosphere, and Lighting

## 1. Camera-position decisions

Camera position describes the viewer's relationship to the action, not merely a physical coordinate.

1. **Action direction:** for an entrance, the camera may wait inside the destination facing the threshold; for departure, a back view can leave the audience behind.
2. **Emotion:** oppression may use very close low placement; isolation may use distant high placement; intimacy often benefits from moderate distance and eye-level relation.
3. **Relationship:** proximity to A can imply identification with A; equal distance can feel observational.
4. **Entering and exiting space:** decide whether the audience waits within, accompanies, or watches from outside.

| Situation | Position | Dramatic effect |
|---|---|---|
| Entering a room | Inside, facing the doorway | The audience waits for entry |
| Approaching from afar | Ahead of the character | Movement comes toward the viewer |
| Farewell or departure | Hold the original position on the back | The audience is left behind |
| Discovering an object | Over shoulder or beside the character | Audience discovers it with them |
| Being watched | Behind an obstruction or above | Surveillance creates unease |
| Two-person confrontation | Lateral to the space between them | Relationship distance is immediately legible |
| Soliloquy or thought | Close and frontal | Direct access to inner conflict |
| Large-scale event | High and distant | Overview and epic scale |

## 2. Twelve composition templates

### Rule of thirds

```text
rule-of-thirds composition, [subject] positioned in the [left/right] third, negative space on the opposite side
```

### Centered symmetry

```text
perfectly symmetrical composition, centered [subject], vertical axis of symmetry
```

### Golden ratio

```text
golden-ratio composition, [subject] near a golden-ratio power point
```

### Frame within frame

```text
frame within frame, [subject] viewed through [frame element], distinct depth between frame and subject
```

### Leading lines

```text
strong leading lines from [start] toward [focal point], readable perspective depth
```

### Diagonal

```text
diagonal composition from [corner] to [corner], dynamic tension
```

### Triangle

```text
triangular composition, [A] and [B] forming the base, [authority] at the apex
```

### Foreground depth

```text
[foreground] softly out of focus, [subject] in midground, [background] softened, layered depth
```

### Negative space

```text
vast negative space, [subject] near [edge], expansive emptiness carrying narrative weight
```

### S-curve

```text
S-curve composition, [winding element] creating a flowing visual rhythm
```

### Dutch angle

```text
Dutch angle, tilted horizon, off-kilter and unsettled
```

### Fill the frame

```text
tight framing, [subject] occupying most of the image, intentionally little breathing room
```

Safe combinations include thirds plus foreground depth, leading lines plus foreground depth, frame-within-frame plus foreground depth, and diagonal plus foreground depth.

Usually avoid mutually canceling combinations: frame-within-frame plus fill-the-frame, negative space plus fill-the-frame, centered symmetry plus diagonal, or Dutch angle plus perfect symmetry.

## 3. Screen-position semantics

```text
Facing right -> place left and leave room ahead.
Facing left -> place right and leave room ahead.
Facing camera -> center or one third, depending on power and isolation.
Lower frame -> diminished or suppressed.
Upper frame -> sacred, free, or dominant.
Exact center -> ceremony, authority, or confrontation.
Edge -> exclusion or isolation.
```

## 4. Atmosphere-to-image map

| Atmosphere | Scale | Angle | Light | Palette | Composition |
|---|---|---|---|---|---|
| Tension or suspense | Close or medium close | slight low or Dutch | hard high contrast | cool | diagonal, asymmetrical |
| Warmth or emotion | Medium or medium close | eye level with a reason | soft warm light | warm | thirds or golden ratio |
| Oppression or despair | extreme wide or extreme close | high | dark top light | desaturated gray | frame-within-frame, closed |
| Freedom or release | extreme wide, broad lens | low | bright natural light | clear and lively | open negative space |
| Mystery or unknown | medium wide | slightly high or obscured | backlight or silhouette | low saturation | foreground obstruction |
| Awe or epic scale | extreme wide | low | dramatic | strong contrast and color | symmetry plus leading lines |
| Horror | close paired with extreme wide | Dutch, high, or low | underlight or flicker | cold green or dark red | extreme asymmetry |
| Ceremony | medium or medium wide | eye level or slightly low | side or Rembrandt | warm gold or deep red | centered symmetry |

## 5. Lighting translation

### Basic setups

| Source description | Photographic phrase |
|---|---|
| Soft frontal light | `soft frontal key light` |
| Hard side light | `hard side lighting, strong shadows` |
| 45-degree key | `key light at 45 degrees from camera` |
| Backlight | `backlit, rim lighting` |
| Rim | `rim light highlighting the silhouette` |
| Fill | `fill light reducing shadow contrast` |
| Three point | `three-point lighting setup` |
| Rembrandt | `Rembrandt lighting, triangular cheek light` |
| Butterfly | `butterfly lighting, shadow below the nose` |
| Split | `split lighting, half the face in shadow` |

### Environmental sources

| Source | Photographic phrase |
|---|---|
| Window | `diffused natural window light` |
| Candle | `warm flickering candlelight` |
| Oil lamp | `warm orange oil-lamp glow` |
| Golden hour | `golden-hour sunlight, long warm shadows` |
| Blue hour | `cool blue-hour ambient light` |
| Noon | `hard midday sun, compact shadows` |
| Overcast | `soft diffused overcast sky` |
| Moon | `cool blue-silver moonlight` |
| Fire | `warm firelight, moving shadows` |
| Lantern | `warm red lantern glow` |

### Emotional functions

| Emotion | Lighting plan |
|---|---|
| Tension | `low-key lighting, deep shadows, one hard motivated source` |
| Warmth or romance | `soft warm backlight, golden fill` |
| Grief | `cool blue cast, diffused low light` |
| Fear | `motivated underlight, green cast, severe contrast` |
| Hope or rebirth | `bright backlight, warm rim, controlled flare` |
| Anger or conflict | `red accent light, high contrast` |
| Calm | `soft even light, neutral restrained values` |

## 6. Shot size to camera parameters

These are starting points, not physical truths. Image models may respond better to framing descriptions than exact lens numbers; retain parameters only when the selected model benefits from them.

| Shot | Code | Starting lens | Aperture | Depth | Figure share | `figureFramingPrompt` |
|---|---|---:|---:|---|---:|---|
| Extreme wide | EWS | 14–24mm | f/8–11 | deep | up to 20% | `extreme wide shot, tiny full-body figures at no more than 20% frame height, vast environment` |
| Very wide | VWS | 24–35mm | f/5.6–8 | deep | 20–35% | `very wide shot, full figure head-to-toe, about 25% frame height` |
| Wide | WS | 35–50mm | f/4–5.6 | moderate | 35–60% | `full shot, head-to-toe, about 50% frame height with headroom` |
| Full | FS | 50mm | f/4 | subject focus | 30–50% | `full-body shot, about 40% frame height` |
| Medium wide | MWS | 50–70mm | f/3.5–4 | subject sharp | 50–70% | `medium wide shot, knees up, about 60% frame height` |
| Medium | MS | 50–85mm | f/2.8–4 | shallow | 60–80% | `medium shot, waist up, about 70% frame height` |
| Medium close | MCU | 85mm | f/2–2.8 | shallow | 70–90% | `medium close-up, chest up, about 80% frame height` |
| Close | CU | 85–135mm | f/1.8–2.8 | very shallow | 80–95% | `close-up, shoulders up, face dominant` |
| Big close | BCU | 100–135mm | f/1.4–2 | extremely shallow | 90%+ | `big close-up, face filling the frame` |
| Extreme close | ECU | 100mm macro | f/2.8 | macro isolation | fills frame | `extreme close-up, [body part] filling the entire frame` |

Optional compiled form:

```text
[shot] shot on [lens] at f/[aperture], [depth], [figureFramingPrompt]
```

Example:

```text
medium shot on an 85mm lens at f/2.8, shallow depth of field with softened background, waist up, figure about 70% of frame height
```

For WS and wider, supported negative prompts may add `cropped body, cut-off feet, cut-off head`.
