# Appendix C: Style, Lighting, and Prompt Templates

These are starting clauses. Adapt them to the confirmed visual brief and selected model; never paste incompatible routes together.

## Style directives

### Chinese-inspired 2D art

```text
Chinese ink-and-mineral-pigment inspired, elegant controlled line art, restrained palette,
atmospheric ink diffusion, tactile brush texture, culturally coherent production illustration
```

### Japanese-style 2D cel animation

```text
feature-quality anime visual language, cel shading, clean line art, disciplined color script,
detailed model-sheet consistency, professional animation illustration
```

### Korean-style polished illustration

```text
premium webtoon and fashion-illustration finish, refined pastel and jewel tones,
dreamlike atmosphere, controlled soft lighting, clean digital painting, subtle depth
```

### Stylized 3D feature animation

```text
feature-quality stylized 3D, appealing shape language, layered subsurface skin,
soft global illumination, tactile surfaces, controlled warm palette, premium cinematic render
```

### Realistic 3D

```text
photorealistic 3D render, production PBR materials, subsurface scattering,
path-traced lighting, high-resolution texture detail, physically coherent surfaces
```

### Live-action feature

```text
cinematic photography, large-format cinema-camera response, subtle film grain,
shallow depth of field, professional color grade, motivated volumetric lighting, movie still
```

### Premium live-action series

```text
premium episodic photography, professional motivated lighting, clean detailed image,
natural color palette, polished production design, high production value
```

## Lighting presets

| Scheme | Prompt clause | Useful for |
|---|---|---|
| Rembrandt | `Rembrandt lighting, dramatic chiaroscuro, controlled cheek triangle` | Portraits and serious tension |
| Butterfly | `butterfly lighting, soft glamour key, restrained shadow beneath the nose` | Refined portraits |
| Volumetric rays | `volumetric shafts through atmosphere, visible particulate depth` | Sacred, fantastic, or dusty environments |
| Backlight | `motivated backlight, rim separation, controlled silhouette edge glow` | Entrances, turns, and climaxes |
| Moonlight | `cool moonlit ambience, soft silver directional glow` | Quiet or mysterious night scenes |
| Neon | `motivated neon spill, colored ambient reflection, controlled urban light pollution` | Cyberpunk and night cities |
| Natural soft light | `diffused natural daylight, gentle shadows, warm-hour falloff` | Everyday warmth and realism |

## Conflicting-style negatives

| Current route | Add to negative prompt |
|---|---|
| 2D animation | `3D render, photorealistic photo, film grain, realistic skin texture` |
| 3D rendering | `flat 2D fill, cel shading, line-art-only, ink painting` |
| Live-action realism | `anime, cartoon, 2D illustration, synthetic 3D-render look` |
| Chinese ink art | `unrequested western oil-painting treatment, gothic architecture, generic European ornament` |
| Japanese-style animation | `Chinese ink-wash treatment, oil-painting impasto, live-action skin texture` |

## General negative floor

```text
low quality, blurry, deformed anatomy, broken proportions, extra limbs, missing fingers,
unintended grotesque features, watermark, text, signature, logo, frame, border
```

## Translation and phrasing notes

| Concept | Preferred English phrasing |
|---|---|
| Luminous pale complexion | `fair luminous skin`, not the flat phrase `white skin` |
| Sword-like brows and bright eyes | `clean angular brows, clear focused eyes` |
| Ethereal grace | `ethereal presence, weightless controlled elegance` |
| Heroic martial bearing | `heroic valiant bearing, disciplined martial presence` |
| Classical splendor | `regal classical beauty, rich but controlled ornament` |
| Gentle scholarship | `gentle scholarly demeanor, refined cultured grace` |
| Killing intent | `controlled threat, predatory focus, compressed physical tension` |
| Fragile vulnerability | `restrained vulnerability, delicate but credible emotional presence` |

## Three-depth environment template

```text
foreground: [specific foreground element], tactile detail, slightly out of focus;
midground: [main environment subject], primary focal area, sharp focus;
background: [distant element], atmospheric perspective and depth haze;
empty environment unless the story requires a crowd, wide establishing composition,
{styleDirective}, {lightingScheme}, physically coherent materials, production-ready finish
```
