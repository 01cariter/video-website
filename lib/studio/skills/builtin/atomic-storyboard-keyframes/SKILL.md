---
name: atomic-storyboard-keyframes
description: Decompose scripts into atomic, continuity-aware shots and generate reviewed keyframes from approved character, scene, and prop assets.
---

# Atomic Storyboard Keyframes

Convert a script plus an approved asset library into a complete sequence of storyboard keyframes. The workflow emphasizes atomic action, performance-critical frames, explicit screen direction, shot-size-aware references, narrative prompt compilation, and visible review history.

This English edition preserves the v9.2 contracts while adapting execution to this product:

- Search and attach assets already present on Canvas; there is no `zencli material` command.
- Create image generator nodes directly on Canvas; there is no `zencli canvas build-draft` command.
- Attach actual node images as references. Do not put legacy `@asset` or tracking `<tag>` syntax into `finalPrompt`.
- Generate and review serially within a scene. A failed attempt becomes a new Reuse, Quick Edit, or Regenerate node; preserve the original.
- Use the selected model's real reference count, size, negative-prompt, and parameter contract.

## Supporting references

Read only what the current phase needs:

- For detailed script decomposition, special shots, dialogue coverage, and eyelines, read [Appendix A](references/appendix-A-script-decomposition.md) before Step 2.
- For composition templates, camera-position reasoning, atmosphere, lighting translation, and shot-size starting points, read [Appendix B](references/appendix-B-composition-camera.md) during Steps 1 and 4.
- For strict prompt compilation, identity locks, supported negatives, coverage checks, and review repairs, read [Appendix C](references/appendix-C-prompt-compiler.md) before Step 5.
- For a complete bamboo-courtyard example from source to reviewed frame, read [Appendix D](references/appendix-D-full-example.md) when the schema or rolling-reference behavior is unclear.

## Seven-step workflow

```text
Script + accepted asset library
  -> Step 0: scope and mode
  -> Step 1: Visual Bible, global light, Color Script
  -> Step 2: scenes, scriptUnitMap, performance cards, atomic freeze frames
  -> Step 3: asset matching, identityLock, reference tiers
  -> Step 4: narrative-led composition and screen orientation
  -> Step 5: compile finalPrompt, Greenlight, create a node, inspect, repair
  -> Step 6: manual decisions and Canvas organization
```

## Twenty-two operating laws

Any violation blocks Greenlight.

1. A precise written storyboard precedes prompt writing.
2. Every shot has foreground, midground, and background; `intimate` may intentionally collapse depth.
3. Decide `shotIntent` -> `cameraPosition` -> `cameraAngle` in that order.
4. Do not write `shotDescription` before `scriptUnitMap`.
5. Write `performanceCard`, especially `criticalFrame` and `whyThisNeedsOwnShot`, before description.
6. Force a separate shot for a decisive microdetail, sound-to-image cue, planted clue, emotional embodiment, or genuinely independent action.
7. Lock `cameraPosition`, `cameraAngle`, `relationComposition`, `compositionMethod`, and `figureOrientation` together.
8. Every prompt passes through the visual-narrative compiler; do not freestyle components.
9. Attach references through the generator node; `finalPrompt` contains no `@asset` or `<tag>`.
10. Prefer angles with perspective tension. Eye-level needs a dramatic reason; three unjustified eye-level shots in one scene create slideshow staging.
11. `finalPrompt` is the only effective text layer.
12. Create `compiledPromptPacket` first, then render `finalPrompt` mechanically through the narrative flow; do not embellish afterward.
13. Every shot has `shotSize` and a matching `figureFramingPrompt` that states body crop and frame share.
14. Mark `shotStateType` at the end of Step 2. Do not force a normal-state reference onto a `special` shot.
15. Outside `establish`, keep `qualityTexture` at or below `qualityFloor`, normally 20 useful tokens. Story-specific effects in `impact` do not count.
16. Every `impact` frame contains a force line or threat direction.
17. A multi-person `narrative` or `impact` frame describes spatial relation and a shared event, not isolated appearance paragraphs.
18. An `establish` frame has direction, narrative negative space, breathing room, or subtle movement; no purposeless centered catalog display.
19. Generate within a scene serially: generate -> review -> next frame, never blind parallel batches.
20. Every frame uses the correct asset anchor; once a frame passes review, it may become the next frame's rolling reference.
21. Configure character and scene references by shot size. Do not attach character references to EWS/VWS, where they tend to pull framing closer.
22. Every character in `finalPrompt` has explicit `figureOrientation`, especially back and profile views.

## Step 0 — Scope and mode

### Asset preflight

| Contract | Preferred source | If missing |
|---|---|---|
| `sceneSpaceMap[]` | accepted asset document | mark degraded and build from source/location boards in Step 1 |
| `viewAngleManifest` | accepted asset document | use only available primary character references |
| `identityLock` | accepted asset document | extract from the best attached reference and request confirmation |
| `qualityProfile.qualityFloor` | accepted asset document | select no more than 20 useful texture/style tokens |

If three or more are missing, recommend running the asset-generation skill first. Continue only if the user accepts reduced consistency.

### Scope and mode

1. Read the script and count episodes and scenes.
2. Let the user choose full work, one episode, or selected scenes when this was not already clear.
3. Estimate a shot range from actual density. A rough starting estimate is 3–8 shots per scene and about 1.3 generated comparisons per shot; do not present a fictional wall-clock time.
4. Choose:
   - **Fast:** concept validation and simple frames; core Greenlight dimensions.
   - **Full:** production and key drama; every check.
   - **Guided:** first use; explain each decision briefly.
5. Mode may change later without discarding accepted upstream work.

## Step 1 — Visual Bible, global light, and Color Script

Read [Appendix B](references/appendix-B-composition-camera.md) when translating light or choosing camera defaults.

Produce:

1. **Visual Bible:** `visualDNA`, `lensPackage`, `cameraMovementGrammar`, `framingBias`, `depthBias`, `textureFinish`, `effectsWhitelist`, and `forbiddenLooks`.
2. **Global lighting constitution:** principal color temperature, contrast, saturation, Key character, shadow role, prohibited colors, base light plan, and signature effects.
3. **Color Script:** emotional palette arc by scene.
4. **Scene light base:** `sceneLightingBaseClause` plus `shotLightingAccentPolicy` for every scene.
5. **`qualityFloor`:** inherit the accepted asset profile or select up to 20 essential tokens. An `establish` frame may use the full texture package; other modes reserve prompt capacity for narrative. `impact` effects are separate.
6. **Cultural setting:** `cultureAnchor` and `cultureNegative` based on explicit setting evidence. Avoid stereotyping or treating every culturally mixed environment as an error.

## Step 2 — Script to atomic written storyboard

Read [Appendix A](references/appendix-A-script-decomposition.md) for the full four-layer method and special-shot rules.

### Mandatory chain

```text
Action / dialogue / emotion / environment reading
  -> scriptUnitMap: actionAtoms, emotionalTurns, microDetails,
     soundToVisualCues, foreshadowCues, performanceClues
  -> atomic action: preparation / threshold / result
  -> performanceCard
  -> single drawable visualFreezeFrame
  -> shotDescription
  -> clear uncoveredItems
  -> shotNarrativeMode and sequence rhythm
```

### `performanceCard`

```json
{
  "performanceCard": {
    "performanceBeat": "The playable center of the performance",
    "criticalFrame": "The decisive readable instant",
    "emotionCarrier": "Visible body, object, fabric, liquid, or particle evidence",
    "whyThisNeedsOwnShot": "Why adjacent shots cannot absorb it"
  }
}
```

Optional detail includes `gazeState`, `breathState`, `handState`, `weightShift`, and `bodyTension`.

### `visualFreezeFrame`

Write one drawable instant, never an interval.

```yaml
shotId: S01-003
visualFreezeFrame:
  subject: Lin Daiyu
  bodyState: "right foot planted, left foot lifted 5 cm, center of gravity 15 degrees forward"
  handState: "left hand gathers the skirt; right hand rests beside the thigh"
  headState: "head turned 20 degrees to the right; gaze toward upper frame-right"
  expressionState: "brows slightly drawn, lips held, tension mixed with expectation"
  environmentRelation: "third stone step inside the garden gate"
  propInteraction: "none"
```

“Lin Daiyu walks into the garden” is not a freeze frame.

### Minimum shot schema

```json
{
  "sceneId": "S01",
  "shotId": "S01-03",
  "shotFunction": "ESTABLISHING / MASTER / DETAIL / REACTION / TRANSITION / EMOTIONAL_BEAT",
  "shotIntent": "What the audience realizes in this frame",
  "shotSize": "EWS/VWS/WS/FS/MWS/MS/MCU/CU/BCU/ECU",
  "shotStateType": "normal / transitional / special",
  "shotNarrativeMode": "establish / narrative / impact / intimate",
  "visualFreezeFrame": {},
  "shotDescription": "Concrete image description",
  "fromPrev": "Visible state inherited from the prior frame",
  "toNext": "Visible state handed to the next frame",
  "performanceCard": {},
  "duration": 4
}
```

`fromPrev` and `toNext` replace older oversized continuity schemas. They record action, gaze, prop state, or spatial relation. Without them, a frame behaves like an isolated illustration.

### `shotNarrativeMode`

| Mode | Goal | Compiler behavior |
|---|---|---|
| `establish` | living stillness: space, arrival, breath | direction and narrative negative space; complete environment texture |
| `narrative` | relationship, dialogue, emotion, interaction | shared relationship before individual completeness; emotion through bodily event |
| `impact` | explosive action, pressure, arrival | crop, occlusion, imbalance allowed; force/threat direction required |
| `intimate` | emotion close-up or prop detail | extreme crop allowed; one focal point; microtexture first |

First matching rule wins:

```text
1. ESTABLISHING -> establish
2. TRANSITION without a person -> establish
3. ECU/BCU/CU + EMOTIONAL_BEAT -> intimate
4. ECU/BCU/CU + DETAIL -> intimate
5. memoryPoint or heroShot -> impact
6. emotionAnchor + MCU/CU/BCU/ECU -> intimate
7. emotionAnchor + MS/MWS/WS -> narrative
8. several people + MASTER/EMOTIONAL_BEAT/REACTION -> narrative
9. DETAIL with kinetic force -> impact
10. default -> establish
```

After decomposition, warn on three or more consecutive `impact`, four or more consecutive `establish`, or a whole scene with only one mode.

Every `establish` needs at least one of composition vitality, narrative negative space, direction, micro-movement, or tension.

### `shotStateType`

| State | Definition | Reference strategy |
|---|---|---|
| `normal` | accepted ordinary appearance | normal character reference |
| `transitional` | transformation, wardrobe change, injury occurring | target-state reference only |
| `special` | charred, apparition, consciousness form, or another unmatched state | no normal reference or a weak local cue only |

One shot anchors one primary state.

### Lock at scene level

- `sceneLightingBaseClause` and `shotLightingAccentPolicy`.
- `sceneSpaceMap`, inherited when accepted.
- `heroShotId`, `emotionAnchorShotId`, and `memoryPointShotId`.
- `sceneContinuityRules`: `axisRule`, `dominantMovementVector`, `gazeFlowRule`, `lightDirectionLock`, `emotionCurve`.

## Step 3 — Assets, `identityLock`, and references

### `viewAngleManifest`

Read available extra character angles before matching references.

### `identityLock`

Source precedence:

1. Existing accepted lock: read directly.
2. Accepted `lockDescription`: translate to concise English features and confirm on first use.
3. Neither: inspect the best attached reference and ask the user to confirm the extracted lock.

```yaml
identityLock:
  tag: "<LDY>"
  coreFeatures:
    - "five stable features in English"
  signatureAccessory: "signature accessory"
  preferredAngle: "three-quarter view"
  colorPalette:
    hair: "..."
    skin: "..."
    costume_primary: "..."
    costume_accent: "..."
  confusionNegative: "supported terms that prevent identity confusion"
```

The tag is internal tracking only.

### Reference tiers

`P0` multiview sheet -> `P0.5` additional accepted angle -> `P1` expression/face crop -> `P2` single design view.

Place evidence by role:

| Asset | Compiler slot | Relation text |
|---|---|---|
| Character | `subjectCore` | visible lock features; exact face consistency only at readable scale |
| Scene | `sceneEnvironment` | scene evidence and environment-reference role |
| Prop | `actionRelation` | exact contact, wearing, holding, and position |

Do not mix legacy named-token protocols with numbered-image prose. In this product, attach Canvas images and name their roles clearly.

### Crop `subjectCore` by shot size

| Size | Subject core | Face detail | Lock depth |
|---|---|---|---|
| EWS/VWS | silhouette, palette, exact screen position | forbidden | tracking tag and palette |
| WS/FS | full silhouette, costume color, position, orientation | forbidden | tag, palette, accessory |
| MWS | three core traits, wardrobe, position, orientation | optional | three traits and accessory |
| MS and closer | full five traits and orientation | required when face is visible | complete lock and identity-consistency text |

The wider the view, the simpler the character clause. Face detail in a wide prompt often causes unwanted reframing.

### `figureOrientation`

Every character gets one explicit direction:

| Orientation | Prompt phrase |
|---|---|
| Front | `facing the camera`, `facing the viewer` |
| Rear | `back to camera`, `seen from behind` |
| Frame left | `facing frame-left`, `looking toward the left` |
| Frame right | `facing frame-right`, `looking toward the right` |
| Three-quarter front | `three-quarter view facing camera` |
| Three-quarter rear | `three-quarter rear view` |
| Left profile | `left profile view` |
| Right profile | `right profile view` |

If omitted, many models bias frontal. Therefore a back or profile frame must state orientation.

## Step 4 — Narrative-led composition

Read [Appendix B](references/appendix-B-composition-camera.md) for composition and camera reference.

Answer:

```text
Q1 What does the audience learn?
Q2 What should the audience feel?
Q3 What is the spatial relationship?
Q4 Where does the audience stand to see it?
Q5 Where is this beat in the rhythm?
```

Then complete:

```json
{
  "jointCompositionDecision": {
    "shotIntent": "...",
    "cameraPosition": "...",
    "cameraAngle": "angle name plus useful prompt phrase",
    "relationComposition": "relationship composition plus useful phrase",
    "compositionMethod": "composition method",
    "screenPosition": "position in frame",
    "figureOrientation": "facing camera / back to camera / facing frame-left / other",
    "spatialAnchor": "required for several subjects"
  }
}
```

For every multi-subject frame, `spatialAnchor` places each figure with:

- horizontal: left, center-left, center, center-right, right;
- vertical: upper, center, lower;
- depth: foreground, midground, background.

After composition, run the Asset Adequacy Gate: `angleCoverage`, `emotionCoverage`, and `actionCoverage`. Block only when identity, spatial readability, or the decisive action cannot be stabilized.

## Step 5 — Compile, generate, and review

Read [Appendix C](references/appendix-C-prompt-compiler.md) before compiling.

### Visual-narrative compiler

```text
joint decision + performanceCard + visualFreezeFrame + identityLock
+ Visual Bible + fromPrev/toNext
  -> subjectCore / actionRelation / sceneEnvironment / styleMedium
     / cameraComposition / lightingColor / qualityTexture / constraints
  -> visual-narrative finalPrompt
  -> promptCoverageChecklist
  -> Greenlight
```

`finalPrompt` order:

```text
shot size and scene -> inherited visible state -> subject position and orientation
-> body/action -> environment reaction -> handoff to next frame -> motivated light
-> foreground/midground/background -> eye path -> medium/material
-> useful camera parameters -> supported exclusions
```

### Greenlight

Score 1–5:

| Dimension | Question |
|---|---|
| `narrativeClarity` | Is the event legible immediately? |
| `performanceGranularity` | Is the person performing rather than posing? |
| `promptExecutionIntegrity` | Did every decisive input enter `finalPrompt`? |
| `assetAdequacy` | Can the available assets stabilize it? |
| `sequenceCoherence` | Are `fromPrev` and `toNext` visible? |
| `memoryPointStrength` | Is this frame worth remembering? |

Any item at 2 or below returns for revision. A total under 20 rewrites; 20–24 is `warning_pass`; 25 or more may generate.

### Shot-size-aware references

| Size | Character reference | Scene reference | Reason |
|---|---|---|---|
| EWS/VWS | do not attach | required | environment dominates; identity reference can pull closer |
| WS/FS | optional P2 when recognition is essential | required | scene remains dominant |
| MWS | P1/P2 | as needed | readable character without close face lock |
| MS/MCU | P0/P0.5 | as needed | character dominates |
| CU/BCU/ECU | P0 or P1 face crop | usually omit | environment can distract from the face |

For `establish`, always attach the scene. Attach a character only if the person is the focal point and more than about 40% of the image.

The reference priority is character identity, scene or most recent accepted frame, then a prop. Use no more than the actual model limit; the legacy clarity ceiling is three.

### Rolling reference

Within one scene:

```text
S01-01 passes -> attach its output to S01-02
S01-02 passes -> attach its output to S01-03 and drop S01-01
```

- Keep only the latest accepted output.
- Asset anchors remain available, subject to the model's reference limit.
- The first frame has no rolling reference.
- Do not propagate a `manualReview` frame.

### Product-native generation loop

For each shot, serially:

1. Compile and Greenlight `finalPrompt`.
2. Create a new image generator node with the selected model, supported parameters, and references.
3. Show real credit cost before the user runs generation when generation is user-triggered.
4. When the result is available and inspectable, compare it to prompt, lock, and scene.
5. If all six checks pass, set `verdict: pass` and use it as the rolling reference.
6. On failure, create a new revision node:
   - retry 1: change word order, strengthen one constraint, or change one supported exclusion;
   - retry 2: simplify secondary content or change the description method.
7. After three failed attempts, set `manualReview` and continue without rolling that image forward.

Do not auto-generate paid images without the product's normal user action or authorization.

### Six review checks

| Check | Pass criterion | Repair |
|---|---|---|
| Character consistency | face, hair, and wardrobe follow accepted reference | move visible lock evidence earlier; change reference tier |
| Framing | shot size and positions are roughly correct | move framing to prompt opening; remove closer-view cues |
| Action/expression | core direction and critical frame read | keep only the core action; remove distracting detail |
| Scene | environment, light, and palette follow scene | strengthen exact scene evidence; remove contradictions |
| Defects | no material extra limbs, face failure, unintended text/watermark | simplify pose and hand detail; use supported exclusions |
| Orientation | front/rear/left/right matches `figureOrientation` | move orientation immediately after name; remove conflicting cues |

```json
{
  "shotId": "S01-03",
  "attempt": 1,
  "verdict": "pass / retry / manualReview",
  "reviewChecklist": {
    "characterConsistency": "pass/fail",
    "framingExecution": "pass/fail",
    "actionExpression": "pass/fail",
    "sceneConsistency": "pass/fail",
    "noDefects": "pass/fail",
    "figureOrientation": "pass/fail"
  },
  "failedItems": [],
  "fixApplied": "What changed on retry",
  "finalImageUrl": "Canvas output URL or node reference"
}
```

Change only one or two causes per retry.

| Failure | Retry 1 | Retry 2 |
|---|---|---|
| Identity | move lock earlier; supported confusion exclusion | reduce wardrobe to stable essentials; choose a better reference tier |
| Scale | open with exact scale and frame share | delete details that imply a close shot |
| Action | remove secondary actions | compress three action sentences to one |
| Scene | move location evidence earlier | remove wrong-environment cues and use supported exclusions |
| Anatomy/artifact | strengthen supported anatomy constraints | simplify pose and hands |
| Orientation | move orientation into first subject sentence | remove every conflicting direction and use a strong rear/profile phrase |

### Visual impact

For `memoryPoint`, `heroShot`, or `emotionAnchor`:

| Check | Requirement |
|---|---|
| `spatialAnchoring` | quadrant/depth position for every subject in every frame |
| `motionTrajectory` | from-to trajectory for action |
| `environmentReaction` | at least three environmental reactions in a hero/memory frame |
| `debrisSpecificity` | fragment size, amount, and direction for destruction |

## Step 6 — Manual review and Canvas organization

| Result | Action |
|---|---|
| Pass on first attempt | no additional review |
| Pass after retry | quick user confirmation |
| `manualReview` | user chooses accept, revise prompt, revise composition, revise shot, or improve assets |

Trace a manual failure to the earliest cause:

| Choice | Return to | Reuse |
|---|---|---|
| Revise shot | Step 2 | Bible, lighting, other shots |
| Revise composition | Step 4 | script map, performance card, asset match |
| Revise prompt | Step 5 | Steps 1–4 |
| Change supported seed | Step 5 | everything else |
| Add or improve an asset | Step 3 | map and performance work |

Organize Canvas by scene and shot order. Keep hero frames visible, label scene transitions, light anchors, and composition methods, and compare summed `duration` with the target rhythm.

## Checklist

### Step 1

- [ ] Visual Bible, lighting constitution, and Color Script exist.
- [ ] Every scene has `sceneLightingBaseClause`.
- [ ] `qualityFloor` has at most 20 useful tokens.
- [ ] `cultureAnchor` and `cultureNegative` are evidence-based.

### Step 2

- [ ] Four-layer reading is complete and every shot traces to `scriptUnitMap`.
- [ ] `uncoveredItems` is empty.
- [ ] `criticalFrame`, `emotionCarrier`, and `whyThisNeedsOwnShot` are present.
- [ ] Every freeze frame is one drawable instant.
- [ ] Every shot has `fromPrev` and `toNext` when applicable.
- [ ] Narrative modes are assigned and rhythm checked.

### Step 3

- [ ] Accepted `identityLock` is bound or newly confirmed.
- [ ] Reference tier and shot-size policy agree.
- [ ] Only the actual Canvas reference mechanism is used.

### Step 4

- [ ] Joint decision card is complete.
- [ ] Multi-subject frames have `spatialAnchor`.
- [ ] No three-shot eye-level run lacks a reason.
- [ ] Every character has `figureOrientation`.

### Step 5

- [ ] `finalPrompt` uses the visual-narrative order.
- [ ] Identity detail is appropriate to visible scale.
- [ ] `fromPrev` and `toNext` entered the prompt.
- [ ] References include the correct asset anchor and eligible rolling frame.
- [ ] Reference selection follows shot size.
- [ ] Orientation entered `finalPrompt`.
- [ ] All six review checks ran when the image could be inspected.
- [ ] Manual-review nodes are marked.

### Step 6

- [ ] Manual-review frames have an explicit disposition.
- [ ] Canvas is organized by scene and shot.
- [ ] Summed duration and rhythm were checked.

## Handoff

```text
Scriptwriting skill -> final screenplay
Script-assets-to-images -> accepted asset library
  -> sceneSpaceMap / viewAngleManifest / identityLock
  -> lockDescription / accepted image nodes
  -> qualityProfile.qualityFloor
Atomic storyboard keyframes -> shot sequence, prompts, generator nodes, reviews
```
