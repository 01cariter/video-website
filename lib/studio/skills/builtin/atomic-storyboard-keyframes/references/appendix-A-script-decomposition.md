# Appendix A — Shot Decomposition, Special Shots, Dialogue, and Eyelines

The obsolete `motionRelayPlan` schema has been removed. Keep the camera-development method below.

## 1. Four-layer reading

### Action

- Treat every verb as an action signal and ask what dramatic intention it serves.
- Different intentions require different shots.
- Prefer decomposing a continuous action into preparation, threshold, and result.

### Dialogue

- Give a crucial line its own shot when its delivery or consequence is the beat.
- If the listener's response matters more, create a reaction shot.
- Render subtext as micro-expression or body behavior.
- In high-tension dialogue, the strongest frame is often just before the words leave the mouth or in the aftershock immediately after them.

### Emotion

An emotional change is not a parenthetical note. Give every meaningful turn at least one `EMOTIONAL_BEAT`. The process is often more visual than the final state. Translate abstraction into bodily or material evidence.

| Emotion | Visible evidence |
|---|---|
| Boredom | yawn; picking teeth with the back of a knife; absent-mindedly nudging stones |
| Fatigue from waiting | blade ground unusually thin; dog lying low and whining; changed sunset position |
| Suppressed pain | lower lip held between teeth; knuckles whitening; scar reddening |
| Anger before release | throat moving; nostrils opening; words held at the lips |
| Grief or loss | fingers sliding weakly from an armrest; tear held at the eye; shoulders dropping |
| Shock or fear | pupils widening; lips parting; torso moving half a step backward |
| Release | fingers opening; long exhale; shoulders lowering |
| Decision | chin rising slightly; gaze sharpening; hand closing around a weapon |

### Environment and atmosphere

If the environment carries narrative information, give it a shot. Translate sound into a visible carrier.

| Sound | Visual translation |
|---|---|
| Metal impact | hairline fracture at the contact surface; sparks; metal fragments |
| Footstep or echo | dust jumping from the floor; visible scale of an empty resonant space |
| Machine hum | particles pulsing at one frequency; structure trembling microscopically |
| Wind | hair, fabric, flags, and dust sharing a direction |
| Water or drip | ripples; a suspended droplet; splash trajectory |
| Silence | minimal image, large negative space, time appearing arrested |

## 2. `scriptUnitMap`

```json
{
  "scriptUnitId": "S03-U04",
  "sourceText": "Exact source text",
  "actionAtoms": [],
  "emotionalTurns": [],
  "microDetails": [],
  "soundToVisualCues": [],
  "foreshadowCues": [],
  "performanceClues": [],
  "mustSplitReasons": [],
  "mappedShotIds": ["S03-08"],
  "uncoveredItems": []
}
```

Hard gate: do not proceed while `uncoveredItems` is nonempty.

## 3. Atomic action decomposition

Prefer preparation -> threshold -> result. Split when any two of these change:

- Dramatic intention, power relationship, or emotional state.
- Weight, eyeline, spatial relation, or prop state.
- Sound needs a dedicated visual translation.
- A microdetail needs magnification.

### Creating camera progression through adjacent shots

Do not collapse a camera idea into “the camera pushes in.” Design readable beats.

| Intention | Decomposition | Example |
|---|---|---|
| Push closer | establish -> approach -> endpoint | Erlang Shen watches from afar -> jaw tightens in medium close -> brand on chest in close-up |
| Track | enter frame -> accompany -> stop | Erlang Shen passes the golden-body array -> steps lift dust -> stops before Wukong |
| Reveal | obscured -> exposed -> reaction | reverse waterfall hides a cave -> water folds upward -> Xian Luolan appears |
| Oppressive advance | establish confrontation -> close pressure -> contact | Erlang Shen approaches golden Wukong -> raises two fingers -> taps the knee |
| Awakening ripple | stillness -> minute anomaly -> pre-eruption | inert gold statue -> faint gold in the eyes -> pressure ripple expands |

Rules:

- Camera energy comes from changes in scale, distance, and contact across shots, not from hiding uncertainty under motion blur.
- Let only one major element change drastically within a single action window.
- The most valuable frame is often immediately before contact, at first contact, or while the aftershock is still unresolved.

## 4. Density guide

| Passage type | Starting number of shots per 100 Chinese characters, or equivalent source density |
|---|---:|
| High density: microdetail, sound, emotion, several actions | 4–6 |
| Standard narrative: action, dialogue, emotion | 2–4 |
| Transition or environment | 1–2 |
| Climax: dense action and emotional release | 3–5 |

Use this as a diagnostic, not a quota.

## 5. Concrete `shotDescription`

| Abstract | Filmable |
|---|---|
| She is sad. | Her shoulders fall; her fingers slide from the armrest; a tear stays at the corner of her eye. |
| He is furious. | A vein rises at his temple; his fist closes until the knuckles pale; his throat moves but no shout comes. |
| The room is dark. | The only light squeezes through the door gap and cuts a dust-filled column through the room. |
| No response. | His pupils do not contract, breathing does not change, and the corner of his mouth holds exactly the same curve. |

## 6. Eight special shot forms

General rules:

- If a focus or interaction layer includes part of a known character, attach that character reference when the shot-size policy allows it.
- State every character's orientation precisely.
- Use foreground, midground, and background unless an intimate composition deliberately collapses depth.
- Decide `cameraPosition`, `cameraAngle`, `relationComposition`, and `compositionMethod` together.

### 1. Over the shoulder

Use for dialogue, scrutiny, or pressure. Keep a blurred back-of-head or shoulder in foreground and the focused character frontal or three-quarter.

### 2. Dialogue singles

Do not alternate mechanically. Ask who exerts pressure, who absorbs it, and whose response is worth the shot.

### 3. Two-shot

- Power difference: asymmetry or scale difference.
- Intimacy: proximity or contact.
- Confrontation: opposed sides or controlled symmetry.
- Estrangement: depth separation or negative space.

### 4. Point of view

The viewer-character is normally not fully visible; a hand or weapon may anchor foreground.

### 5. Mirror or reflection

The body and reflection may use the same identity reference.

### 6. Frame within frame

The foreground frame must express confinement, surveillance, separation, or another story function.

### 7. Low-angle hero shot

The low angle needs a dramatic reason, not a default desire to make every character powerful.

### 8. High or overhead view

Use to express being diminished, swallowed, observed, or arranged by a larger system.

## 7. Eyeline control

```text
Mutual gaze: place each person on one side and keep tension space between them.
One-way gaze: place the watcher nearer an edge and the watched subject more centrally.
Several gazes converging: their target becomes the focal point.
Gazes dispersing: useful for fracture and alienation.
```

## 8. Dialogue coverage

| Strategy | Use | Caution |
|---|---|---|
| Standard singles | Ordinary conversation | After roughly six exchanges, use a two-shot or another spatial reset |
| Over-shoulder opposition | Negotiation or argument | Do not randomly swap which shoulder anchors foreground |
| Progressive approach | Escalating argument or confession | Every move closer must accompany new content |
| Abrupt scale jumps | Psychological contest | Use selectively |
| Wide plus close inserts | Class, council, meeting | Use the wide to orient, not to stall |

## 9. Coarse versus fine decomposition

Example: an opening with Wukong and Erlang Shen.

**Coarse, six shots:** cloud sea; faces of the gods; seated Wukong; Erlang Shen entering; knee tap, wine placement, and gold light forced into one shot; gold flare.

**Fine, fourteen shots:** cloud sea expanding; array of divine faces; sound visualized as synchronized particles; seated Wukong; extreme close-up of his lashes; Erlang Shen enters; footsteps lift dust; passage through the golden bodies; flask placed down; two fingers rise; contact at the knee; web fracture aftershock; Erlang Shen leans in to challenge; gold light appears in Wukong's eye.

The fine version adds 67% more shots, three sound translations instead of none, two microdetails instead of none, and two critical performance frames instead of none. The point is not the number: it is that every independent dramatic event receives a readable image.
