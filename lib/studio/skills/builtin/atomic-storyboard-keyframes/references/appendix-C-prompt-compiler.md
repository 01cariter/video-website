# Appendix C — Visual-Narrative Prompt Compiler, Identity Lock, and Review Loop

This appendix defines the strict compilation path. It was originally tuned around legacy “Nano Banana” nicknames; apply it to the actual Canvas image model and use negative prompts or named references only when the selected contract supports them.

The key rule is: **`finalPrompt` is the only effective text layer.** An idea recorded elsewhere but absent from it does not influence generation.

## 1. Visual-narrative compiler

### Internal slots

Slots organize evidence; they are not concatenated mechanically.

| # | Slot | Required | Content | Early-word guide |
|---:|---|---|---|---|
| 1 | `subjectCore` | yes | shot-size-appropriate identity lock, signature accessory, identity-consistency instruction | single figure 80; two 120; three or more 160 words |
| 2 | `actionRelation` | yes | translated freeze frame: body, hands, head, expression, relation, prop | within first 80 words |
| 3 | `sceneEnvironment` | yes | location evidence and natural-language reference role | within first 80 words |
| 4 | `styleMedium` | yes | visual medium inherited from the Bible | within first 80 words |
| 5 | `cameraComposition` | yes | shot size, figure framing, angle, lens if useful, depth, composition | about 80–200 words maximum |
| 6 | `lightingColor` | yes | photographic lighting language and palette | about 80–200 words maximum |
| 7 | `qualityTexture` | yes | material and useful quality detail | about 80–200 words maximum |
| 8 | `constraints` | yes | supported baseline, shot-specific, narrative-mode, and cultural exclusions | model-dependent |

### Compilation flow

```text
jointCompositionDecision + performanceCard + visualFreezeFrame
+ identityLock + Visual Bible + fromPrev/toNext
  -> fill eight internal slots
  -> check useful length
  -> write one visual-narrative finalPrompt
  -> run promptCoverageChecklist
  -> Greenlight
  -> attach references and generate
  -> review
```

### `finalPrompt` narrative order

```text
[shot size and concise location establishment],
[specific visible element carried from fromPrev],
[subject position using quadrant/depth language],
[subject action and bodily state],
[environment reaction if any],
[unresolved action, gaze, or prop state handed to toNext],
[how light intensifies this exact instant],
[foreground / midground / background],
[composition and intended eye path],
[style, medium, and material],
[angle, optional lens, and depth].
Avoid: [supported constraints]
```

The sequence matters: inherit, establish, place, act, react, hand off, then finish with light, depth, and technical form.

### Injecting `fromPrev` and `toNext`

1. Put `fromPrev` before the principal subject action with concrete language such as `continuing from`, `picking up from`, or `carrying over`.
2. Put `toNext` after action or environmental reaction with `about to`, `leaving`, or `setting up the next beat`.
3. Use visible evidence: `still facing`, `still holding`, `maintaining the left-right relationship`, `same doorway`, `same light direction`, `leaving a gaze trail toward`, `unresolved motion`.
4. Do not substitute empty phrases such as `same scene as before`, `cinematic continuity`, `connected shot`, or `sequential feeling`.

### Packet

```json
{
  "compiledPromptPacket": {
    "subjectCore": "...",
    "actionRelation": "...",
    "sceneEnvironment": "...",
    "styleMedium": "...",
    "cameraComposition": "...",
    "lightingColor": "...",
    "qualityTexture": "...",
    "constraints": "...",
    "finalPrompt": "One complete prompt in visual-narrative order"
  }
}
```

Internal slots may retain a tracking `<tag>`. Strip tracking tags and legacy `@assetName` syntax from `finalPrompt`; attach actual reference images through the Canvas generator.

## 2. `identityLock`

```yaml
identityLock:
  tag: "<LDY>"
  coreFeatures:
    - "five stable features in English"
  signatureAccessory: "recognizable accessory"
  preferredAngle: "three-quarter view"
  colorPalette:
    hair: "..."
    skin: "..."
    costume_primary: "..."
    costume_accent: "..."
  confusionNegative: "supported exclusions that prevent confusion with another asset"
```

### Shot-size-aware `subjectCore`

Every character shot must state `figureOrientation`. Include accessory and face detail only at a scale where they can be visible.

| Scale | `subjectCore` | Face consistency | Identity depth |
|---|---|---|---|
| EWS/VWS | `[name] as a tiny silhouette, [orientation], [palette], [position]` | omit | tracking tag and palette only |
| WS/FS | `[name], full body in [costume color], [orientation], [accessory], [position]` | omit | tag, palette, accessory |
| MWS | name, three core features, orientation, accessory | optional | three features |
| MS and closer | name, all five core features, orientation, accessory, `maintaining exact facial features from the reference image` | required when a face reference is attached | full lock |

Wide images should not contain detailed face prose; it often pulls the generated view closer.

Examples after tracking tags are stripped:

```text
Lin Daiyu, [five core features], facing frame-left, wearing [signature accessory], maintaining exact facial features from the reference image
```

```text
Lin Daiyu, full body in pale green hanfu, back to camera, carrying a jade pendant, standing in the left third of the foreground
```

For several characters, order by focal priority and give each a separate identity clause appropriate to visible scale.

Source precedence:

1. Read an existing accepted `identityLock`; do not re-extract it.
2. Translate an accepted `lockDescription` when no lock exists.
3. Extract from an attached reference image and request confirmation.

When `lockDescription` conflicts with `coreFeatures`, use the accepted `identityLock` and record `identityConflict: true`.

## 3. Layered references

| Asset | Slot | Text behavior |
|---|---|---|
| Character | `subjectCore` | visible features and identity consistency; no tracking syntax |
| Location | `sceneEnvironment` | location evidence and `for environment reference` when useful |
| Prop | `actionRelation` | concrete holding, wearing, or contact relation |

Product-native payload record:

```json
{
  "primaryPayload": {
    "reference_images": [
      {
        "nodeId": "...",
        "assetName": "Character asset",
        "role": "identity",
        "tier": "P0",
        "source": "asset_anchor"
      },
      {
        "nodeId": "...",
        "assetName": "Previous accepted frame",
        "role": "sequence continuity",
        "source": "rolling_ref"
      }
    ],
    "assetCalls": {
      "Character A": "attached character reference",
      "Scene": "attached scene reference"
    }
  }
}
```

Do not exceed the selected model's real reference-image limit. The legacy workflow used at most three; that remains a good clarity ceiling when the provider permits it.

### Reference selection by scale

| Scale | Character reference | Scene reference |
|---|---|---|
| EWS/VWS | omit | required |
| WS/FS | optional, only when recognition is essential | required |
| MWS | expression or approved design reference | as needed |
| MS/MCU | multiview or best matching approved angle | as needed |
| CU/BCU/ECU | face crop or high-quality identity reference | omit unless environment remains narratively necessary |

In `establish` mode, the scene reference is mandatory. Attach a character reference only when the person is the visual focus and occupies more than about 40% of frame.

### Transitional states

| `shotStateType` | Prompt and reference behavior |
|---|---|
| `normal` | use the normal lock |
| `transitional` | anchor the target state; describe the source state as breaking, fading, or changing |
| `special` | omit the normal lock or use only a weak identity trace |

## 4. Negative-prompt standardization

Use this section only when the model exposes a real negative-prompt field. Natural-language-only models should receive positive constraints in the main prompt instead of an unsupported `Avoid:` block.

### Baseline

```text
text, watermark, logo, signature,
extra limbs, missing limbs, extra fingers, missing fingers,
facial distortion, asymmetric eyes, duplicate faces, merged faces,
unintended blur, low resolution, oversaturation, underexposure,
artifacts, compression damage
```

### Shot-specific

| Shot | Add when relevant |
|---|---|
| Single person | `background characters, crowd, extra people` |
| Several people | `merged bodies, overlapping faces, fused limbs` |
| Close-up | `extreme distortion, fisheye effect` |
| Action | `unintended motion blur, frozen awkward pose` |
| Full or wider | `cropped body, cut-off feet, cut-off head` |

### Anti-template exclusions

```text
staged pose, mannequin-like acting, empty hands, stiff symmetry,
poster-like static composition, absent motion evidence,
generic dramatic light, over-smoothed face,
eyebrow-only emotion, flat background,
missing spatial anchor, generic centered layout without a reason
```

### Narrative-mode exclusions

| Mode | Add when supported |
|---|---|
| `establish` | `static catalog layout, purposeless centered character display, lifeless symmetry, no breathing room, no directional flow` |
| `narrative` | `symmetrical posing, both figures facing camera without shared gaze, poster layout, isolated character descriptions without relationship` |
| `impact` | `calm standing, undisturbed environment, balanced calm composition, gentle light, absent force direction, absent environmental reaction` |
| `intimate` | `distant framing, full-body shot, multiple focal points, poster composition, competing detail` |
| Global | accepted `cultureNegative` from the Visual Bible |

Compose supported negatives as baseline + shot-specific + anti-template + mode + cultural exclusions.

Do not use abstractions as if they were completed evidence: `dynamic pose`, `motion energy`, `cinematic composition`, `dramatic shot`, `intense emotion`, `powerful atmosphere`, `beautiful lighting`, or `artistic framing`.

## 5. `promptCoverageChecklist`

Preserve the legacy schema key `referenceByShortSize` for compatibility even though it means “reference by shot size.”

```json
{
  "subjectCore": "pass/fail",
  "identityLock": "pass/fail/na",
  "facialConsistency": "pass/fail/na",
  "figureOrientation": "pass/fail",
  "actionRelation": "pass/fail",
  "sceneEnvironment": "pass/fail/na",
  "styleMedium": "pass/fail",
  "figureFraming": "pass/fail",
  "cameraAngle": "pass/fail",
  "compositionMethod": "pass/fail",
  "fromPrevInPrompt": "pass/fail/na",
  "toNextInPrompt": "pass/fail/na",
  "lightingColor": "pass/fail",
  "qualityTexture": "pass/fail",
  "constraints": "pass/fail",
  "qualityFloorCompliance": "pass/fail/na",
  "forceDirectionPresence": "pass/fail/na",
  "compositionalVitality": "pass/fail",
  "referenceByShortSize": "pass/fail",
  "sequenceRhythmCheck": "pass/warning/na"
}
```

Block on any P0 failure: `subjectCore`, `identityLock`, `facialConsistency`, `figureOrientation`, `actionRelation`, `figureFraming`, `cameraAngle`, `compositionMethod`, `referenceByShortSize`, or `constraints`.

## 6. `visualImpactCheck`

For `memoryPoint`, `heroShot`, and `emotionAnchor` frames:

| Check | Applies to | Requirement |
|---|---|---|
| `spatialAnchoring` | every shot | quadrant/depth position for every subject |
| `motionTrajectory` | action | clear from-to trajectory |
| `environmentReaction` | memory and hero frames | at least three affected environmental elements |
| `debrisSpecificity` | destructive action | fragment size, amount, and direction |

Any `spatialAnchoring` failure blocks generation.

## 7. Compiling `spatialAnchor`

Every multi-subject shot must place each subject in `finalPrompt`.

- Horizontal: `left`, `center-left`, `center`, `center-right`, `right`.
- Vertical: `upper`, `upper third`, `center`, `lower third`, `lower`.
- Depth: `foreground`, `midground`, `background`.
- Orientation: `facing frame-left`, `facing frame-right`, `facing camera`, `back to camera`, `three-quarter view facing camera`, `three-quarter rear view`, `left profile`, `right profile`.

Put orientation immediately after the character name. A rear or profile shot must say so explicitly because many image models otherwise bias toward frontal faces.

## 8. `establish` vitality whitelist

An establishing prompt needs at least one concrete vitality signal:

```text
slight breeze lifting, compositional flow toward, breathing space, shifting light,
subtle movement, wind-swept, leading line, asymmetrical weight,
dynamic negative space, directional mist, receding path, floating particles,
scattered leaves, rippling surface, tilted horizon
```

## 9. `impact` effects whitelist

These count as effects rather than `qualityFloor` texture tokens:

```text
particles, explosion, shockwave, debris, sparks, energy beam, aura, radiance,
force wave, dust eruption, lightning, flame burst, light streak, impact crater,
ground fracture, vapor trail
```

## 10. Sixteen compiler laws

1. Do not compile before completing the joint composition decision.
2. `finalPrompt` is the only effective text.
3. Create `compiledPromptPacket`, then render `finalPrompt` through the narrative order; do not freestyle afterward.
4. Establish character, action, scene, and medium early: about 80 words for one figure, 120 for two, 160 for three or more.
5. At MWS or closer, include the applicable identity-lock features.
6. At MS or closer with a face reference, include the identity-consistency instruction.
7. Translate light into concrete photographic terms.
8. Derive camera framing from the shot-size table when parameters help the model.
9. When supported, use baseline, shot-specific, and narrative-mode negatives.
10. Abstract adjectives do not satisfy fields.
11. Compile every multi-subject `spatialAnchor` into the prompt.
12. Compile `fromPrev` and `toNext` as concrete visible evidence.
13. An `establish` prompt needs at least one vitality signal.
14. An `impact` prompt needs a force or threat direction.
15. Crop `subjectCore` by shot size; EWS/VWS uses silhouette and position, WS/FS omits face detail. Laws 5 and 6 are waived when the face cannot be read.
16. Every character shot contains explicit `figureOrientation`; rear and profile views must be stated.

## 11. Prompt-length truncation

Priority from highest to lowest:

```text
P0 retain: subjectCore, actionRelation, sceneEnvironment, styleMedium, constraints
P1 retain when useful: cameraComposition, lightingColor
P2 compress: qualityTexture
P3 remove first: decorative background detail
```

Target roughly 200–400 English words, adjusted to the selected model's useful prompt capacity.

## 12. Performance translation

Before `performanceBeat` enters the prompt:

1. Convert abstract emotion into face and body evidence.
2. Freeze the critical frame at a readable instant.
3. Translate the emotion carrier into a prop, skin, cloth, liquid, or particle state.
4. Use visible, filmable language the model can render.

Do not insert `suppressing anger` or `trying not to cry` without the physical evidence that makes it visible.

## 13. Encoding motion in one still

Use at least two forms of motion evidence; action frames benefit from three or four.

| Layer | Evidence |
|---|---|
| Body | shifted center of gravity, asymmetric pose, spinal twist |
| Cloth | lifted cape, sleeve lag, hair following through |
| Particles | dust, splash, blood droplets when appropriate, spark trails |
| Impact | air ripple, afterimage, fracture |
| Environment | curtain lifted, leaves bent |
| Timing difference | body reaches the position before expression catches up |
