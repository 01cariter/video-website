---
name: multi-model-scriptwriting-pipeline
description: Develop a premise into a production-ready screenplay through a duration-aware six-stage planning, research, localization, and drafting pipeline.
---

# Multi-Model Scriptwriting Pipeline

This workflow turns a one-line idea into a professional screenplay. Its governing principle is: **ask for episode count and episode length first, then derive everything from total running time**. Episode count determines arc complexity, episode length determines beat density, and total duration determines world depth, cast size, and subplot capacity.

The stages describe specialist roles. Run them sequentially with the current Agent. If model routing is enabled in this product, a suitable available model may be assigned to each role; do not imply that DeepSeek, GPT, Gemini, Kimi, Qwen, or Claude has been called unless the product actually routed a request to it.

## Pipeline

```text
One-line idea
  -> Stage 0: collect creative boundaries and calculate duration
  -> Stage 1: develop concept, characters, and world
  -> Stage 2: build episode arcs, beat sheets, scenes, and screen-time plan
  -> Stage 3: optional research and continuity audit
  -> Stage 4: localize and merge everything into one master outline
  -> Stage 5: draft scene by scene, polish dialogue, and review the result
```

Stage 2 must generate long series one episode at a time to avoid truncation. Every beat must include `environment` and `timeOfDay`. Stage 4 produces the sole downstream source of truth. Stage 5 must write by act or scene and cap each beat at `durationMinutes * 180` Chinese characters, or the equivalent spoken duration in another language.

## Stage 0 — Creative control desk

Do not enter Stage 1 until all material boundaries are known. If the user supplied some answers, ask only for the missing ones.

### Intake

Ask:

1. **Episode count:** 1, 3, 6, 12, 24, or custom.
2. **Minutes per episode:** 1–2, 2–3, 5, 10, 20, 30, 45, 90–120, or custom.
3. **Genre and tone:** mystery, comedy, romance, science fiction, realism, fantasy, horror, period drama, adventure, slice of life, or a described hybrid.
4. **Core drivers:** required devices such as a reversal, time travel, rebirth, revenge, or romantic payoff; the primary emotional effect; and any must-have set pieces.

Use a concise interactive form such as:

```text
Before developing the idea, I need four production boundaries:
1. How many episodes?
2. How many minutes per episode?
3. What genre and tone?
4. Which required devices, primary emotion, and must-have scenes should drive it?
```

### Calculate duration

```text
totalDuration = episodeCount * episodeDuration
```

Examples: 6 * 10 = 60 minutes; 12 * 20 = 240 minutes; 24 * 30 = 720 minutes.

### Total-duration structure map

| Total duration | Complexity | Structure | Suggested cast ceiling | Subplots |
|---|---|---|---:|---:|
| 1–3 min | Minimal | Hook -> one conflict -> reversal or ending | 2–3 | 0 |
| 5–10 min | Simple | Two acts: setup -> confrontation -> ending | 3–5 | 0–1 |
| 10–30 min | Standard | Three acts: setup -> confrontation -> climax -> ending | 5–8 | 1–2 |
| 30–60 min | Rich | Three acts with one or two interwoven B stories | 8–12 | 2–3 |
| 60–120 min | Layered | Four acts with A/B stories and payoffs | 10–15 | 3–4 |
| 120–240 min | Complex | Multiple acts, subplots, and character arcs | 15–25 | 4–6 |
| 240–480 min | Epic | Chapter episodes, season arc, multiple viewpoints | 20–40 | 6–10 |
| 480+ min | Expansive | Multi-season arcs, episodic units, universe building | 30+ | 10+ |

### Per-episode timing map

| Episode length | Internal structure | Beat density | Hard constraint |
|---|---|---|---|
| 1–2 min | Hook 0:00–0:10 -> conflict 0:10–1:20 -> final reversal in last 10 sec | New information every 15–20 sec | Capture attention immediately; reserve final 3 sec for a hook or reversal |
| 2–3 min | Hook 0:00–0:15 -> setup 0:15–0:45 -> escalation 0:45–2:00 -> climax 2:00–2:45 -> hook 2:45–3:00 | Beat every 20–30 sec | Enter the central conflict within 90 sec |
| 5 min | Hook 0:00–0:20 -> setup 0:20–1:00 -> development 1:00–2:30 -> turn 2:30–3:30 -> climax 3:30–4:30 -> ending 4:30–5:00 | Beat every 40–60 sec | Reveal the central contradiction within 2 min |
| 10 min | Hook 0:00–0:30 -> Act I 0:30–3:00 -> inciting event at 3:00 -> Act II 3:00–7:00 with midpoint at 5:00 -> climax 7:00–9:00 -> ending 9:00–10:00 | Micro-reversal every 2–3 min | First reversal within 3 min |
| 20 min | Cold open 0:00–1:00 -> Act I 1:00–5:00 -> trigger at 5:00 -> II-A 5:00–10:00 -> midpoint at 10:00 -> II-B 10:00–15:00 -> crisis at 15:00 -> Act III 15:00–18:00 -> ending 18:00–20:00 | Beat every 3–5 min | Major midpoint turn at 10 min |
| 30 min | Cold open 0:00–2:00 -> Act I 2:00–8:00 -> turn at 8:00 -> II-A 8:00–15:00 -> midpoint 15:00 -> II-B 15:00–22:00 -> turn at 22:00 -> Act III 22:00–28:00 -> ending | Beat every 4–6 min | Interweave a subplot |
| 45 min | Cold open 0:00–3:00 -> Act I 3:00–12:00 -> turn -> II-A 12:00–22:00 -> midpoint -> II-B 22:00–34:00 -> lowest point -> Act III 34:00–42:00 -> ending | Beat every 5–8 min | Four-act A/B-story structure |
| 90–120 min | Three acts at 25% / 50% / 25%, containing 6–8 sequences | Sequence every 10–15 min | A 15-beat feature model may be used when appropriate |

### Cross-episode arc templates

For more than one episode, add an explicit season arc.

```text
3 episodes
  E1 setup + first major turn
  E2 development + midpoint reversal
  E3 crisis + climax + resolution

6 episodes
  E1 establish world and cast; pose the central mystery
  E2 deepen the world; first challenge or case
  E3 midpoint revelation overturns the audience's assumptions
  E4 deepen relationships; antagonist or obstacle escalates
  E5 comprehensive crisis and lowest point
  E6 counterattack, climax, resolution, optional continuation hook

12 episodes
  E1–3 Act I: world, cast, and central conflict
  E4–6 Act II-A: development, subplots, midpoint in E6
  E7–9 Act II-B: intensification, relationship turns, major reversal
  E10–11 early Act III: crisis and lowest point
  E12 climax and resolution

24 episodes
  E1–6 first mini-season with a complete local arc and larger setup
  E7–12 second arc with deepening and a midpoint reversal
  E13–18 escalation and a new force
  E19–24 convergence, climax, and ending
  Treat each six-episode block as a complete mini-season.
```

### Ending-hook rules

| Position | Ending | Strategy |
|---|---|---|
| Episode 1 | Suspense bomb | Reveal destabilizing information or pose an apparently impossible problem |
| Middle episodes | Emotional or plot hook | Leave an unfinished statement, decision, or imminent event |
| Penultimate episode | Lowest point | Make defeat appear complete so the finale can counterattack |
| Finale | Closed or open | Pay off the planted material, or resolve the core arc while opening a larger world |

### Stage 0 contract

```json
{
  "userInput": {
    "oneLiner": "The user's original premise",
    "episodeCount": 6,
    "episodeDuration": 10,
    "totalDuration": 60,
    "genre": "mystery thriller",
    "coreDrive": {
      "mustHaveElements": ["reversal", "locked room"],
      "primaryEmotion": "tension and catharsis",
      "wishlistScenes": ["the truth becomes clear in the final minute"]
    }
  },
  "structureTemplate": {
    "narrativeComplexity": "rich",
    "actStructure": "three acts with subplots",
    "maxCharacters": 12,
    "maxSubplots": 3,
    "beatDensity": "one micro-reversal every 2–3 minutes",
    "episodeArcTemplate": "six-episode short season",
    "perEpisodeStructure": "ten-minute template"
  },
  "crossEpisodeArc": {
    "ep1": "world and cast; central mystery",
    "ep2": "deeper world and first challenge",
    "ep3": "midpoint revelation",
    "ep4": "relationship and antagonist escalation",
    "ep5": "crisis and lowest point",
    "ep6": "counterattack, climax, and resolution"
  }
}
```

### Duration controls for later stages

| Stage | Short, up to 10 min | Medium, 10–60 min | Long, 60–240 min | Very long, 240+ min |
|---|---|---|---|---|
| Concept | One conflict, 2–3 characters | Main plus one secondary conflict, 5–8 characters | Multiple conflicts, 10–15 biographies | World laws, factions, 20+ characters, detailed history |
| Structure | Single-line beat sheet | Main beats plus 1–2 subplots | Multi-line beats and cross-episode arc | Chapter structure, seasonal arcs, character growth arcs |
| Research | May skip | Basic logic check | Deep logic, specialist facts, timeline | Full world consistency, relationships, payoff ledger |
| Localization | Maximum hook and payoff | Pace and contemporary dialogue | Emotional layers and pacing curve | Cultural resonance and long-range empathy |
| Draft | Roughly 150–200 Chinese characters per minute | Standard screenplay format | Full screenplay and directing notes | Script volumes, character guide, production advice |

## Stage 1 — Concept and world development

Develop the premise at a depth proportional to `totalDuration`.

1. **Central conflict:** State the protagonist's ultimate goal and largest irreconcilable obstacle. For work longer than 30 minutes, add internal and subplot conflicts. Explain how pressure escalates from first to last episode.
2. **Character biographies:** Stay under `maxCharacters`. For each character provide name, age, identity, one-sentence core temperament, desire, A-to-B arc, and key episodes.
3. **World and background rules:** Define the ability, boundary, and cost of speculative systems. For realism, establish society, period, and geography. Above 120 minutes, add factions, power structure, and relevant history.
4. **Fit audit:** Confirm that character count, conflict network, and world depth match the available time.

| Total duration | Conflict | Character treatment | World treatment |
|---|---|---|---|
| up to 10 min | One conflict in one sentence | 2–3, about 50 Chinese characters each | 1–2 sentences |
| 10–30 min | Main plus one secondary conflict | 3–5, about 100 characters each | One paragraph |
| 30–60 min | Main plus two secondary conflicts | 5–8, about 150 characters and an arc each | Complete world paragraph |
| 60–120 min | Main plus 2–3 secondary conflicts and escalation | 8–12; lead about 300, supporting about 150 | World plus faction relationships |
| 120–240 min | Network of main and secondary conflicts | 10–15 detailed biographies and relationship map | Rules and history |
| 240+ min | Layered conflicts and thematic questions | 20+ character guide | World encyclopedia, factions, chronology |

Output:

```json
{
  "coreConcept": {
    "mainConflict": "A precise conflict",
    "subConflicts": ["Secondary conflict A", "Secondary conflict B"],
    "conflictEscalation": "How pressure escalates"
  },
  "characters": [{
    "name": "Character name",
    "age": 25,
    "identity": "Identity",
    "corePersonality": "One-sentence temperament",
    "motivation": "What this person wants",
    "arc": "From A to B",
    "keyEpisodes": [1, 3, 6]
  }],
  "worldBuilding": {
    "setting": "Background",
    "rules": "System or social rules",
    "factions": ["Faction A", "Faction B"],
    "history": "Relevant backstory"
  },
  "durationFitCheck": {
    "characterCountOK": true,
    "conflictComplexityOK": true,
    "worldDepthOK": true,
    "notes": "Audit notes"
  }
}
```

## Stage 2 — Structure and logic plan

Build the story skeleton from Stage 0 and Stage 1. Derive every beat from the exact running time.

1. **Season arc:** For each episode state its chapter function, ending-hook type, main-plot progress, and where every subplot begins, intersects, and resolves.
2. **Episode beat sheets:** For more than three episodes, produce one episode per pass. Every beat requires a timestamp, beat name, one-sentence scene action, characters, emotion direction, `environment` (`interior` or `exterior`), and `timeOfDay` (`day` or `night`).
3. **Scene inventory:** List scenes by episode, mark reusable locations to control production cost, and give each an emotional color.
4. **Screen-time map:** Mark each character's focus episodes and arc turning point. No important character should silently disappear.

### Beat-sheet precision

For a three-minute episode, use second-level precision:

```text
00:00–00:05 impact opening, possibly a flash-forward
00:05–00:15 establish identity in one decisive image
00:15–00:35 fracture in normal life
00:35–01:00 irreversible inciting event
01:00–01:30 first attempt using an old method; failure
01:30–02:00 escalation and first reversal
02:00–02:20 forced decision
02:20–02:45 dramatic peak
02:45–02:55 resolution or second reversal
02:55–03:00 final hook for a series
```

For a ten-minute episode, use minute-level precision:

```text
00:00–00:30 cold open or hook
00:30–02:00 establish the episode problem
02:00–03:00 inciting event
03:00–05:00 protagonist's offensive, with small progress
05:00–05:30 midpoint revelation or reversal
05:30–07:00 counterattack or increased difficulty
07:00–08:00 crisis and lowest point
08:00–09:30 confrontation, decision, or truth
09:30–10:00 new problem or suspense hook
```

For a 45-minute episode, use minute and scene precision:

```text
00:00–02:30 cold open, flashback, or answer to prior suspense
02:30–05:00 current life and new equilibrium
05:00–08:00 inciting problem
08:00–12:00 first turning point; leave the comfort zone
12:00–15:00 B story begins
15:00–18:00 trials, allies, and losses
18:00–22:00 major midpoint where A and B meet
22:00–25:00 antagonist pressure increases
25:00–30:00 subplot and relationship turn
30:00–34:00 comprehensive crisis
34:00–38:00 inner decision
38:00–42:00 decisive confrontation
42:00–44:00 aftermath and new equilibrium
44:00–45:00 next-episode hook
```

Output:

```json
{
  "crossEpisodeArc": {
    "episodes": [{
      "epNumber": 1,
      "chapterRole": "setup and entry point",
      "endingHookType": "suspense bomb",
      "mainPlotProgress": "10%",
      "subplotNodes": ["Subplot A begins"]
    }]
  },
  "episodeBeatSheets": [{
    "epNumber": 1,
    "beats": [{
      "timeStart": "00:00",
      "timeEnd": "00:30",
      "durationMinutes": 0.5,
      "beatName": "cold open",
      "sceneDescription": "One-sentence action",
      "characters": ["Character A", "Character B"],
      "emotionCurve": "up",
      "sceneName": "Scene name",
      "environment": "interior",
      "timeOfDay": "night"
    }]
  }],
  "sceneList": [{
    "sceneName": "Scene name",
    "episodes": [1, 3, 5],
    "moodColor": "Emotional color"
  }],
  "characterScreenTime": [{
    "character": "Character name",
    "keyEpisodes": [1, 3, 6],
    "arcTurningPoint": "Episode 3"
  }]
}
```

## Stage 3 — Optional research and continuity audit

Run when `totalDuration >= 30` or the genre depends on medicine, law, history, science, or another specialist field. Use web research only when authorized and available; otherwise flag claims that need verification rather than inventing facts. If skipped, pass an explicit empty patch:

```json
{
  "logicIssues": [],
  "backgroundEnrichment": [],
  "foreshadowingChecklist": [],
  "productionNotes": [],
  "skipped": true
}
```

Audit:

- Each action has a credible motive in that episode.
- Event order, travel, and spatial continuity work; nobody teleports.
- A character only acts on information previously obtained.
- Cross-episode setups pay off and episodes do not contradict each other.
- Specialist scenes use accurate procedural detail, industry language, or period behavior.
- At 60 minutes or more, maintain a ledger of every planted and harvested element; find forgotten setups and unseeded payoffs.
- Mark expensive or difficult scenes and offer lower-cost alternatives when budget matters.

Output:

```json
{
  "logicIssues": [{
    "type": "motivation gap",
    "location": "Episode 3, 15:00",
    "description": "Character A changes allegiance without setup",
    "fixSuggestion": "Add a secret encounter in Episode 2"
  }],
  "backgroundEnrichment": [{
    "scene": "Courtroom",
    "addedDetail": "Relevant procedural detail",
    "source": "Verified professional reference or verification note"
  }],
  "foreshadowingChecklist": [{
    "item": "Planted detail",
    "plantedAt": "Episode 1, 05:00",
    "harvestedAt": "Episode 5, 40:00",
    "status": "paid off"
  }],
  "productionNotes": [{
    "scene": "Scene name",
    "difficulty": "high",
    "simplificationOption": "Lower-cost approach"
  }]
}
```

## Stage 4 — Localization and the master outline

Adapt tone to the audience the user named. The source workflow targets Chinese internet audiences; for another market, replace local slang and cultural references with equivalents natural to that audience. Never force a meme merely because it is current.

### Short episodes, up to five minutes

- Put a payoff, pain point, or new information roughly every 15 seconds.
- Start at high intensity and design the first image to stop scrolling.
- Make reversals legible and consequential within the short window.
- Give each episode title a compelling promise without misleading clickbait.
- Seed lines or turns likely to prompt audience reaction.

### Medium episodes, 10–20 minutes

- Alternate high-energy passages with breathing room.
- Aim for a memorable, shareable line every 2–3 minutes without making dialogue sound written for screenshots.
- Use productive character contrast.
- Build lows that make the highs matter.

### Long episodes, 30 minutes or more

- Prefer emotional recognition over nonstop gratification.
- Make changes in allegiance and personality gradual.
- Connect social themes to character decisions instead of inserting commentary.
- Develop lasting lines rather than disposable slang.
- Design at least one replay-worthy scene per episode.
- Accumulate romantic and emotional turns before the release.

For every length, heighten conflict appropriately, mark the emotional push-pull of each scene, and design one or two involuntary audience-reaction moments per episode.

**Mandatory merge:** Combine the Stage 2 structure, every accepted Stage 3 correction, scene metadata, and localization decision into one `masterOutline`. Downstream drafting must not reconcile multiple contradictory documents.

```json
{
  "masterOutline": {
    "_comment": "Sole source of truth: structure, corrections, and localization merged",
    "episodes": [{
      "epNumber": 1,
      "title": "Audience-appropriate title",
      "hookSummary": "Hook",
      "beats": [{
        "timeStamp": "00:00-00:30",
        "durationMinutes": 0.5,
        "sceneDescription": "Final scene action",
        "emotionStrategy": "Push-pull strategy",
        "dialogueDirection": "Voice or memorable-line seed",
        "viralMoment": "Audience-reaction point",
        "environment": "interior",
        "timeOfDay": "night"
      }],
      "endingHook": "Final localized hook"
    }]
  },
  "buzzwordBank": ["Reusable but natural line seeds"],
  "viralMoments": [{
    "episode": 1,
    "timestamp": "02:30",
    "description": "Reaction moment",
    "expectedReaction": "Expected response"
  }]
}
```

## Stage 5 — Scene drafting and final polish

Read only the accepted concept material and Stage 4 `masterOutline` as the structural authority. Draft one act, episode, or manageable scene batch at a time.

### Duration and word budget

For Chinese-language scripts:

- Action scene: about 150–200 characters per minute.
- Dialogue scene: about 200–280 characters per minute.
- Visual montage: about 80–120 characters per minute.
- General episode target: `episodeDuration * 180` characters.

Reference targets: 3 minutes about 540 characters; 10 minutes about 1,800; 20 minutes about 3,600; 45 minutes about 8,100. For another language, estimate spoken and visual screen time rather than copying Chinese character counts.

Before drafting each beat, read `durationMinutes` and enforce a local upper bound of `durationMinutes * 180` Chinese characters or the language-equivalent screen time. Do not spend the finale's budget in the opening.

### Screenplay format

```text
1. INT./EXT. — LOCATION — DAY/NIGHT                 [estimate: 20 sec]

(Present-tense, filmable action. Use concrete behavior, sound, and image.)

CHARACTER
(delivery, emotion, or playable subtext)
Dialogue.
```

Read interior/exterior and day/night directly from the master outline. Give every scene an estimated duration. Action must be specific enough to suggest coverage: prefer “He crosses the threshold in two strides; his heel hammers the stone” over “He walks over.”

### Dialogue polish

- Give each character a distinct pace, vocabulary, habitual phrasing, and sentence shape.
- Use subtext and silence. Replace a declaration such as “I feel terrible” with behavior, evasion, or a restrained line that lets the audience infer it.
- Alternate long and short turns, direct and oblique answers, weight and release.

### Character visual cards

After the cast list, add an 80–120 Chinese-character visual card, or an equivalent concise paragraph, for every principal and important supporting character. Cover sex or gender presentation when relevant, age range, build and perceived height, hair, recognizable facial traits, signature clothing or accessory, and overall aura. This is a visual clue for the downstream asset skill, not a full art bible or an image prompt.

Example:

> **Ye Chen:** A ten-year-old boy, small and lean, with unruly short black hair, a round face, alert wide eyes, and a worn leather cord around his left wrist. His plain gray training robe and clean, stubborn bearing make him recognizable at a glance.

### Draft header and scene example

```text
TITLE
Genre: {genre}
Episodes: {episodeCount}
Minutes per episode: {episodeDuration}
Version: Final draft V1.0

CAST
Name ........ age / identity / one-line temperament

CHARACTER VISUAL CARDS
...

EPISODE 1 — “TITLE”
Estimated duration: {episodeDuration} minutes

1. EXT. CITY SKYLINE — DUSK                         [estimate: 20 sec]

(Aerial. Sunset fragments across glass towers like thousands of gold scales.
Traffic streams silently along the overpass.)

VOICE-OVER
Everyone thinks they are the protagonist of this city.

(The camera descends through traffic toward the window of an aging apartment block.)

2. INT. RENTED ROOM — DUSK                          [estimate: 45 sec]

(Takeout cartons crowd the counter. A young man curls on the sofa; phone light
cuts across his exhausted face.)

LI MING
(reading it like a weather report)
Insufficient balance.

(He places the phone face down. Three seconds of silence. Then he buries his
face in the cushion. The doorbell rings.)
```

### Review report

From a third-person consultant perspective:

- Compare total script length to target screen time.
- Verify every episode-ending hook, core driver, and beat density.
- Give the director two or three practical notes on casting, coverage, or key images.
- Give the editor pacing notes: where to cut rapidly, hold a long take, or let music lead.
- For a series, append a text relationship map, setup/payoff ledger, and one-line episode summaries.

Self-check each scene by type:

```text
dialogue minutes = characters / 240
action minutes = characters / 175
visual-only minutes = characters / 100
episode estimate = sum of scene estimates

within 10% of target: pass
10–20% deviation: trim redundancy or add necessary detail
over 20% deviation: structural rewrite
```

## End-to-end example

Premise: “A courier discovers that the parcel he is delivering contains a severed head.”

Parameters: six ten-minute mystery episodes; required reversal; tense, cathartic emotion; final-minute truth reveal. Therefore total duration is 60 minutes, with a rich three-act structure, up to 12 characters, 2–3 subplots, and a reversal every 2–3 minutes.

Possible season arc:

```text
E1 The courier finds the head, is pulled into the case, and asks who sent it.
E2 He traces the sender, finds a suspect, and identifies the apparent victim.
E3 Midpoint: the victim may be alive, the head may be fabricated, and the courier may be the real target.
E4 His hidden connection to the case surfaces.
E5 He is framed; every clue points toward him.
E6 The culprit and the courier's lost past are revealed; planted clues pay off.
```

Concept fragment:

```json
{
  "coreConcept": {
    "mainConflict": "Courier Zhang Bei has 48 hours to prove his innocence; doing so exposes his identity before amnesia",
    "subConflicts": [
      "Who was Zhang Bei, and how did he know the victim?",
      "Detective Lin Yu discovers pressure from her superior to close the case"
    ],
    "conflictEscalation": "parcel -> identity -> memory -> truth -> larger conspiracy"
  },
  "characters": [{
    "name": "Zhang Bei",
    "age": 28,
    "identity": "courier; formerly an investigative reporter",
    "corePersonality": "apparently timid, fundamentally stubborn, clearest when cornered",
    "motivation": "prove innocence -> recover memory -> expose the truth",
    "arc": "fugitive to hunter",
    "keyEpisodes": [1, 2, 3, 4, 5, 6]
  }, {
    "name": "Lin Yu",
    "age": 32,
    "identity": "criminal investigator",
    "corePersonality": "controlled and rational, with protected tenderness",
    "motivation": "solve the case -> recognize interference -> choose justice",
    "arc": "enforcer to dissenter",
    "keyEpisodes": [1, 2, 4, 5, 6]
  }]
}
```

Episode 1 beat fragment:

```text
00:00–00:30 Hands wrap an unseen object in darkness; a drop of blood.
00:30–01:30 Zhang Bei's anonymous delivery routine through the city.
01:30–02:30 Last order: isolated address, heavy parcel, strange smell.
02:30–03:30 The damaged parcel opens and reveals a head.
03:30–05:00 Panic, flight, return—the parcel is gone.
05:00–06:00 Police find nothing and doubt him.
06:00–07:00 Surveillance shows only Zhang Bei carrying the parcel; no sender.
07:00–08:30 Every trace suggests he sent it to himself.
08:30–09:30 A number on the waybill answers and addresses him by another name.
09:30–10:00 “You finally called. Zhang Bei—or should I use your real name?”
```

## Quality checklist

- [ ] Stage 0 confirmed episode count and episode duration.
- [ ] `totalDuration` is calculated correctly.
- [ ] Structure complexity, cast ceiling, and subplot capacity fit that duration.
- [ ] Beat intervals fit episode length.
- [ ] A multi-episode work has a complete cross-episode arc and strong ending hook for every episode.
- [ ] Principal character arcs are complete and their screen time is tracked.
- [ ] All setups pay off; mandatory for work of 60 minutes or more.
- [ ] Final word count is within 10% of target screen time.
- [ ] Localization feels natural rather than trend-chasing.
- [ ] Every required device, primary emotion, and requested set piece appears.
- [ ] Dialogue has playable subtext and does not sound machine-generated.
- [ ] Professional scene headings, action, dialogue, and duration estimates are present.
- [ ] Every stage's depth is duration-sensitive.

## Common failures and repairs

| Failure | Cause | Repair |
|---|---|---|
| Ten characters in a three-minute story | Cast not capped by duration | Return to the Stage 0 map |
| Slow ten-minute episode | Beat density not derived from time | Rebuild Stage 2 with a turn every 2–3 minutes |
| Thin world in a long series | Stage 1 depth not scaled | Expand laws, history, and factions to fit duration |
| Dull middle episodes | No season arc | Give each episode an independent function and ending hook |
| Draft too long or short | No duration budget | Recalculate scene budgets and adjust |
| Character vanishes | No screen-time map | Repair the Stage 2 distribution |
| Artificial dialogue | Insufficient Stage 5 polish | Add voice distinction, subtext, and silence |
| Forgotten setup | No payoff ledger | Audit in Stage 3 |
| Short episode lacks impact | Wrong localization strategy | Rebuild Stage 4 around concise hooks and reversals |
| Writing begins before duration is known | Intake skipped | Stop and collect episode count and duration |
| User says only “write a script” | Boundaries absent | Complete the Stage 0 intake before planning |

## Downstream handoff

The final screenplay can feed the asset and storyboard skills:

- Character visual cards -> starting appearance notes for character assets.
- Scene inventory with interior/exterior and day/night -> location inventory and spatial map.
- World description -> cultural and aesthetic anchors.
- Key-prop descriptions -> prop inventory.
- Cast ages, identities, and temperaments -> design reference.
- Episode count and length -> episode-aware asset extraction.
- Genre and scene descriptions -> storyboard decomposition and keyframe prompts.

The visual cards are only starting evidence; the asset skill should perform its own progressive visual development. If the screenplay explicitly names a style such as ink-wash fantasy or cyberpunk, carry it forward as an initial direction, not as permission to ignore later user choices.
