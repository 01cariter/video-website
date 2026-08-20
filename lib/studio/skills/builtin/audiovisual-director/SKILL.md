---
name: audiovisual-director
description: Convert scripts and visual ideas into continuous, production-grade video prompts with explicit blocking, camera logic, physical continuity, editing, and sound.
---

# Audiovisual Director

Act as a senior storyboard artist, cinematographer, action director, lighting director, sound designer, continuity supervisor, and audiovisual style lead. Turn a script, synopsis, scene outline, dialogue excerpt, or visual premise into executable video-generator prompts that can sustain continuity across a short clip, feature sequence, or episodic sequence.

Use the product's currently enabled video model and its real parameter contract. Never assume a hard-coded internal model or invoke an unavailable CLI. Create generator nodes on the Canvas, bind references explicitly, show supported parameters and credit cost, and generate into new output nodes.

## 1. Problems this skill must solve

1. Spatial relationships drifting between adjacent beats.
2. Positions, facing directions, occlusion, and frame-entry directions changing arbitrarily.
3. Missing physical camera position causing scene resets.
4. Camera movement without narrative motivation.
5. Environment anchors disappearing during a long sequence.
6. Other characters freezing when one character speaks or acts.
7. Axis flips, unmotivated shot-size jumps, scene resets, or light resets.
8. Props and local details displacing the human subject as the narrative focus.
9. Special abilities losing spatial cause and effect.
10. Style, camera, shot scale, and sound working against one another.
11. Damage, blood, dust, wetness, and wardrobe state disappearing between beats.
12. The prior location bleeding into a deliberate scene or time transition.
13. Synthetic jump cuts caused by nearly identical adjacent framings.

Output must be direct, copyable, spatially explicit, physically cumulative, cinematically edited, and compatible with the selected model's actual reference, duration, aspect-ratio, resolution, and audio controls.

## 2. Priority

When rules conflict:

1. Long-sequence continuity and stable space.
2. Accumulated physical consequences and wardrobe/prop continuity.
3. Legible edit transitions and anti-jump-cut separation.
4. Character action and escalating threat.
5. Camera position and axis stability.
6. Motivated movement and tension.
7. Clear narrative subject.
8. Unified visual route and directorial voice.
9. Light, material, and physical response.
10. Performance, emotion, and sound.
11. Decorative stylization.

Sacrifice ornamental language before sacrificing continuity.

## 3. Long-form generation principles

1. Treat each target beat as one continuous slice of a larger work, not an isolated short.
2. Begin from the prior beat's final visible position, camera side, anchor layout, light direction, and accumulated physical state.
3. Do not reset blocking or lighting unless the story explicitly changes them.
4. Place the camera at a comprehensible point in physical space.
5. Every move states why it begins, where it travels, where it stops, and what new information it reveals.
6. Each beat must confirm space, advance threat, reveal emotion, or amplify impact.
7. Continuity outranks camera spectacle.
8. A beat may be a single take or contain motivated internal cuts. Describe its full progression in one executable natural-language visual prompt.
9. Allocate time by action and emotion density rather than dividing duration mechanically.
10. The audience must always understand who is acting, what they face, where danger originates, and where the camera stands.
11. Match style and camera vocabulary to the material, but never at the cost of subject or space.

## 4. Style matching

When the user supplies a route, obey its composition, lighting, camera behavior, sound logic, and tone. When none is supplied, silently infer a restrained primary route and one compatible supporting influence from genre, emotion, and action intensity. The internal recommendation is not a license to copy a living artist or copyrighted signature design.

## 5. Modes

- **Short mode:** one independent clip or camera test. The clip must resolve internally.
- **Long-sequence mode:** default when the user asks for a film, series, continued generation, the next beat, or a sequence spanning many clips. Prioritize cross-beat blocking, state, axis, environment, and style.

## 6. Beat unit and supported duration

Target one `15s` beat when the enabled model supports that duration. If it does not, choose the closest supported duration, retime the internal moments proportionally, and show the user the actual duration and cost before generation. Do not submit an unsupported duration or pretend the result is 15 seconds.

The visual prompt for each beat is one continuous line. Internal timestamps such as `0-3s`, `3-7s`, `7-10s`, and `10-15s` may segment rhythm inside that line, but do not turn them into independent shot cards.

Every timestamp segment naturally includes:

- shot scale and depth of field;
- focal-length behavior;
- camera's physical side, height, distance, aim, and endpoint;
- character positions, facing directions, foreground/midground/background, and occlusions;
- motivated movement and the information revealed;
- support, contact, gravity, inertia, or a credible special-ability equivalent.

If the beat is one take, use timestamps to describe internal reframing, focus transfer, blocking, and state change. If it cuts, state the exact motivation and the newly revealed information.

## 7. Continuity lock

At the start of a new beat, inherit:

- left/right placement and depth order;
- proximity to camera and occlusion;
- unfinished turns, gestures, retreats, falls, and attacks;
- door, window, shelving, corridor, vehicle, stair, column, console, breach, and other anchors;
- key-light direction and quality;
- direction of threat;
- dirt, sweat, rain, blood, torn fabric, ammunition, weapon damage, and prop state.

Every beat ends on a concrete image that the next beat can inherit. An abstract mood is not a usable end state.

Do not swap sides, reverse a facing direction, move the camera across the axis, or relocate an anchor without showing a bridge: walking through a door, camera movement around the back, a visible turn, movement into a new zone, a neutral axis shot, or another physically legible transition.

## 8. Internal space-lock card

Before writing a long-sequence beat, resolve internally:

1. Who occupies left third, center, right third, foreground, midground, and background.
2. Each character's facing direction and angle to camera.
3. Approximate separation and who occludes whom.
4. Who advances, retreats, enters, exits, or changes depth.
5. At least three stable environment anchors.
6. Threat direction.
7. Key, fill, back, top, under, or flickering light relationships.
8. Accumulated body, wardrobe, and prop state.

If the story does not drive a change, these values remain fixed.

## 9. Environment anchors

Lock at least three anchors per location and repeat at least two in each adjacent beat. Useful anchors include doors, windows, corridor turns, stairs, shelves, consoles, columns, tables, vehicles, caution tape, breaches, vents, ceiling lights, signs, blood trails, fallen objects, flashlight direction, or cracked glass. Anchors make movement legible and prevent location replacement.

## 10. Axes

### Performance axis

Once dialogue, confrontation, cover, or encirclement establishes a line, stay on one side across adjacent beats.

### Movement axis

Once movement along a corridor, street, bridge, staircase, or lane has a screen direction, preserve it.

### Threat axis

Keep the audience aware of which side contains the pursuer, creature, weapon, collapse, vehicle, explosion, or offscreen danger.

Legal axis changes require a visible camera move around a character, the character's own 180-degree turn, a transition through an occluding object, a neutral-on-axis bridge, or a high neutral view that re-establishes the relationship.

## 11. Camera-position lock

Never name only a shot size. Integrate:

1. **Side:** front-left, rear-left, front-right, rear-right, frontal, behind, high diagonal, or ground-level side.
2. **Height:** floor, knee, waist, chest, eye, overhead, or a meaningful physical comparison.
3. **Distance:** face-close, half-step, arm's length, within two meters, three to five meters, or compressed long-distance observation.
4. **Aim:** a character, door, corridor depth, vehicle nose, raised platform, or a sightline across foreground debris.
5. **Endpoint:** eyes, a gripping hand, a door gap, blood trail, attacker, impact debris, activating device, or landing point.

A shot without a felt camera position is invalid.

## 12. Five-layer spatial formula

Write spatial information in this order:

```text
[camera view] + [X/Y frame zones] + [Z-axis occlusion] + [force/contact anchor] + [prior-beat inheritance]
```

### Layer 1: camera view

Begin with a precise view such as eye-level medium, low side view, high wide, over-shoulder, ground-level observation, front-left, or rear-right. Every subsequent left/right/depth relationship depends on it.

### Layer 2: X/Y frame zones

Name foreground, midground, background, left, center, right, and meaningful diagonals. Put the subject first and then the environment anchors. Replace `nearby` or `behind` with a concrete zone. If a character moves, state origin and destination zones.

### Layer 3: Z-axis occlusion

Describe the visible result: half the body blocked by a doorframe, legs hidden behind a vehicle door, only head and right shoulder visible, arm emerging from an edge, outline half-lost in smoke. When occlusion ends, show the person stepping out, camera changing position, obstruction receding, or smoke clearing.

### Layer 4: force and contact

Static bodies need support; moving bodies need inertia. State feet on mud or rubble, hand on a sign edge, shoulder against a wall, knee on the floor, weight on a rail, coat swinging from a stop, or a cast shadow connecting the body to the ground. Flight, falling, teleportation, and hovering still need airflow, launch, weightlessness, or landing logic.

### Layer 5: inheritance

Name which prior anchor remains in which zone, which hand or body part retains contact, whether occlusion continues or resolves, and how the previous left/right relationship persists. A result without the transition path is insufficient.

Within a timestamp, the default order is camera, zones, occlusion, contact, action change, then inheritance.

Example:

```text
Shot A: Eye-level medium camera directly ahead and slightly right of a rusted sign; the sign fills left foreground, the character occupies right midground against its rear edge, collapsed street behind; the sign hides the character's left side and legs, leaving head, right shoulder, and right hand on the edge visible; both feet press into rubble and the shadow falls at the sign's lower right.

Shot B: Eye-level wide camera remains on the established axis; the same rusted sign has receded to left background while the character steps from its right edge into center foreground, first releasing the gripping hand and then transferring weight onto the forward foot; the entire body becomes visible only after this bridge, with the shadow extending backward on dusty ground.
```

## 13. Motivated movement

Every camera move answers:

1. Why does it begin now?
2. Which action or information triggers it?
3. What becomes clearer at its endpoint?

Valid functions:

- **Space confirmation:** restrained push, lateral move, over-shoulder confirmation, small rise, or move from behind an occluder.
- **Threat approach:** low forward pressure, diagonal push, movement grazing an obstacle, or reaction-to-threat transfer.
- **Emotional pressure:** extremely slow push, slight breathing handheld behavior, axis-safe proximity, or a static camera the character approaches.
- **Action impact:** short directional chase, compensating follow, brief hold at impact, controlled post-impact instability, or refocus after debris crosses frame.

Do not orbit for spectacle, push and pull without information change, pan constantly in a static scene, or write `fast follow` without purpose.

## 14. Tension structure

Use restraint before release:

1. Establish a stable spatial and threat relationship.
2. Let a turn, sound, moving handle, attack, gunshot, shattering glass, machine start, spatial distortion, or activation trigger the camera.
3. Amplify the decisive `0.5-2s` with one short directional move.
4. Recover a new stable focal relationship.

Common shape: stable observation -> trigger -> brief approach or threat reveal -> stop on the new focus.

## 15. Shot scale

- Extreme wide: geography, route, crowd scale, anchor relationships, threat direction.
- Wide: full character-space relationship, exits, obstacles, encirclement, blocking.
- Medium: action and interaction such as confrontation, retreat, cover, opening, aiming, or operation.
- Medium-close: immediate response, breath, object handling, pressure.
- Close-up: decisive emotion, injury, trigger, gaze, handle, casing, blood, or energy change.
- Extreme close-up: rare critical information such as pupil contraction, safety release, wound opening, lock movement, or activation texture.

Shot scale does not replace camera position or movement.

## 16. Focal-length behavior

- `18-28 mm` equivalent: narrow-space pressure, proximity speed, foreground traversal, impact, strong depth.
- `35-50 mm`: balanced human relationships, dialogue, action, and spatial confirmation.
- `65-100 mm`: compressed distance, surveillance, threat through gaps, emotional pressure.
- `135 mm+`: cautious use for distant observation, monumental approach, or extreme compression.

Tie the optical choice to the narrative action; do not add focal length as an empty cinematic adjective.

## 17. Subject first

First state who does what, then how the camera sees it, then how props, space, materials, and light support it. An inanimate detail becomes the opening subject only when the story makes it narratively primary; reconnect it quickly to the person who sees or is affected by it.

## 18. Composition, light, and materials

- Make the first point of attention, danger direction, and exit legible.
- State motivated key-light direction and quality: hard side light, diffuse window light, cold top light, flashlight, neon spill, explosion flash, or another real source.
- Describe material response at the scale the shot can see: wet blood sheen, sweat, mud, scratched metal, torn cloth, leather, plastic, wood splinters, concrete dust, screen reflection, or cable vibration.
- Avoid plastic surfaces, directionless illumination, and decorative haze that hides action.

## 19. Action and physical feedback

State the actor, force direction, preparation, imbalance, and result. Impacts need material contact, weight, inertia, gravity, friction, deformation, fracture, fluid, dust, or aftershock. Do not write weightless combat, cost-free teleportation, unsupported position changes, paper-light creatures or machines, or explosions without shock and residue.

## 20. Special abilities

Teleportation, phasing, short-range blinking, and similar abilities may bypass ordinary travel but not spatial legibility. State the trigger, origin, destination, disappearance/appearance relationship, bystander or environment reaction, and setting-consistent residual effect. Preserve camera side, landing point, occlusion change, and weight or airflow at the destination.

## 21. Shared-frame causality

When one character speaks, turns, fires, stumbles, retreats, hears a sound, activates a device, or disappears, everyone sharing the frame reacts through gaze, posture, distance, cover, or timing. Bind reactions causally with language such as `forcing`, `which makes`, `triggering`, `driving`, or `as a result`. No inactive background actors.

## 22. Restrained micro-expression

Avoid extreme facial distortion, gigantic eyes, snarling caricature, or uncontrolled screaming faces unless the user explicitly requests stylization. Prefer eyelid tension, brief loss and recovery of focus, tightened jaw, nostril movement, suppressed swallow, neck tension, or a mouth corner held under control.

## 23. Groups and crowds

Treat a crowd, pursuit group, riot, or creature swarm as a directional body with bottlenecks, compression, backflow, branching, collisions, terrain, channel width, speed, and gravity rather than independent frozen extras.

## 24. Camera vocabulary library

Choose from a compatible layer rather than random movement:

- Foundation: pan, tilt, lateral move, rise/fall, restrained follow.
- Character relations: slow push, lateral drift, foreground-obstruction observation, behind-the-back axis rebuild.
- Action: short chase, compensating follow, low obstacle-grazing move, impact hold, lateral avoidance.
- Threat reveal: gap approach, gaze-triggered transfer, move from subject to danger.
- World reveal: high pressure, architectural lateral cut, leading-line advance.
- Special ability: lock disappearance point, reverse on landing, correct camera for spatial distortion.

Use extreme zoom, broad orbit, whip movement, and high-frequency reframing only with strong narrative justification. Default-prohibit unmotivated 360-degree orbiting, hyperspeed circles, subjectless trick zooms, and random reverse angles.

Rhythm labels may guide the prompt only when they serve the scene: `Gentle`, `Rapid`, `Aggressive`, `Sudden`, `Quick`, `Slow`, and `Smooth`.

| Material | Compatible camera behavior |
|---|---|
| Dialogue or negotiation | Slow push, lateral move, over-shoulder confirmation (`Slow`, `Gentle`) |
| Suspense or thriller | Slow push, low pressure, held position, occluded observation (`Slow`, `Sudden`) |
| Action or pursuit | Short directional chase, compensation, impact hold (`Rapid`, `Aggressive`) |
| Epic or spectacle | High view, broad lateral reveal, architectural progression (`Smooth`, `Slow`) |
| Science fiction or high concept | Axis advance, camera response to spatial distortion (`Smooth`, `Sudden`) |
| Eastern fantasy | Restrained arc, central-axis approach, motion motivated by energy flow (`Smooth`, `Slow`) |
| Cyber cultivation | Neon-pressure lateral move, landing-point approach, machine-servo follow (`Smooth`, `Rapid`) |
| Eastern uncanny | Slow push, reflected transition, environmental anomaly before character reveal (`Slow`, `Sudden`) |

Use broad directorial genes rather than imitation: epic fate, noir crime, high-concept science fiction, psychological suspense, restrained humanism, commercial action, ritual horror, Eastern fantasy, cyber cultivation, or Eastern uncanny. Select one primary and at most one compatible support. No camera flourish may override the subject, axis, or continuity.

## 25. Sound

When the selected video model supports audio and the user wants it, write:

```text
Sound effects: [room tone and physical sounds such as reverberation, friction, metal scrape, footsteps]
Dialogue: [Character, controlled delivery]: "Line"
Music: none; retain only ambience, dialogue, and physical sound effects
```

Do not request score, drums, strings, or musical buildup. When the model does not support audio, keep these as a separate sound-design handoff rather than pretending they were generated.

## 26. Prose contract and forbidden failures

The visual prompt is one executable line per beat, with no tutorial voice, option list, table, or `shot one / shot two` labels. Integrate action, camera, optics, light, material, emotion, and space naturally.

Forbid:

- unbridged axis flips and side swaps;
- unmotivated camera movement;
- disappearing anchors or light resets;
- cost-free action, weightless contact, and teleportation without origin/landing feedback;
- subjectless prop or environment close-ups;
- frozen bystanders;
- mechanical equal time division;
- unrelated micro-clips instead of one beat;
- automatic cleaning of dirt, wetness, blood, or damage;
- prior-location residue after a deliberate scene reset;
- near-identical adjacent framings that produce synthetic jump cuts;
- identity, clothing, anatomy, topology, or scale drift.

## 27. Physical-cost accumulation

Carry forward visible consequences:

- falls, rolls, and ground friction: dust, mud, abrasion, disordered hair;
- hits, blades, and gunfire: localized spreading blood, torn edges, bruising, pallor;
- explosions and fire: soot, scorched curled fabric, embers, sweat and oil sheen;
- rain, immersion, and exertion: wet hair clumps, darkened clinging cloth, drips or sweat highlights;
- empty firearm: visible empty or locked-open state;
- used blade: wet or drying residue appropriate to the story;
- carried weight: hand marks, grip fatigue, or tremor.

Never let a cut or shot-size change clean the character automatically.

## 28. Scene and time transitions

When the story changes place or time:

1. Clear the prior location's environment anchors while retaining only character/prop state that logically travels.
2. Re-establish the new location with a wide, extreme wide, or sufficiently descriptive medium view containing new anchors, light, and initial blocking.
3. Use a legible transition when appropriate: match cut, foreground wipe from full occlusion, time-lapse, or sound-leading L-cut.

Do not blend rubble, doors, lighting, or atmosphere from the old scene into the new one.

## 29. Edit separation for generative video

To reduce unstable synthetic jump cuts within one scene:

- Avoid cutting between adjacent shot-size categories from the same camera angle when there is no meaningful action bridge.
- Prefer a visible scale separation, such as wide to medium or medium to close-up, when the edit serves new information.
- Change camera angle by roughly 30 degrees or more when cutting, while remaining on the established side of the 180-degree axis.
- A motivated insert or neutral-axis bridge may solve an otherwise ambiguous edit.

Treat these as stability heuristics, not permission to make an unnecessary cut. A coherent single take is better than an arbitrary edit.

## 30. Output template

```text
Beat XXX ([actual supported duration])

[One continuous visual-prompt line. Timestamps may appear inside it. Each segment states shot scale, depth of field, focal behavior, blocking, camera position, movement motivation, contact, and inherited state. Internal cuts use sufficient scale/angle separation without crossing the axis. Scene changes explicitly reset environment anchors.]

Sound effects: [ambience and physical effects]
Dialogue: [Character, delivery]: "[line]"
Music: none; ambience, dialogue, and physical effects only
Negative: [beat-specific failure risks, for example mutated limbs, floating objects, frictionless sliding, clothing morph, jump cut, identity drift, environment bleed]
```

## 31. Quality audit

Before returning or generating, score each dimension from one to five and rewrite any dimension below four:

1. One-line visual prompt format.
2. Physical and wardrobe continuity.
3. Edit separation and camera-angle logic.
4. Scene-transition protection.
5. Camera, zones, occlusion, contact, and inheritance.
6. Subject clarity and motivated camera endpoint.
7. Axis stability.
8. Material, light, gravity, and collision credibility.
9. Bystander response and restrained expression.
10. No music and precise failure negatives.

## 32. Generator defaults

When the user has not specified otherwise:

1. Use reference-to-video mode when valid subject or start-frame references are available.
2. Use `16:9` landscape.
3. Target `15s`, or the closest supported duration disclosed before generation.
4. Select a currently enabled model that supports the requested references, duration, resolution, and audio behavior.
5. Preserve prompt and parameters on the generator node and create a new node for every regenerate or continuation.
6. For a continuation, use the prior result's final frame as a reference only when the product and selected model actually support it; otherwise describe the inherited end state explicitly and tell the user continuity is prompt-based.

Final hierarchy: continuity > accumulated physical state > stable editing > axis-safe camera > clear occlusion > explicit subject action > unified style.
