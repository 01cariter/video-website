# Appendix D — Full Worked Example

This example demonstrates script -> accepted assets -> shot decomposition -> compilation -> generation and review. It focuses on lightweight `fromPrev`/`toNext`, scene anchors, a rolling reference, `shotNarrativeMode`, `qualityFloor`, and `identityLock`.

## Input

```text
Scene S01: Apprenticeship in the bamboo courtyard.
Ye Chen pushes open the gate and sees Elder Liu waiting in the courtyard. Ye
Chen stops, lowers his head, raises his eyes, walks to the cushion, and kneels.
Elder Liu bends and offers a disciple's robe. Ye Chen's eyes redden, but the
tears do not fall.
```

## Step 1 — Visual Bible summary

```json
{
  "visualDNA": "period Chinese cultivation fantasy, ink atmosphere with cinematic realism",
  "styleMedium": "cinematic Chinese xianxia, ink-painting spatial language with photoreal motivated light, muted elegant palette",
  "qualityFloor": "cinematic Chinese xianxia, ink atmosphere, precise natural material",
  "cultureAnchor": "fictional period Chinese architecture, bamboo-and-stone courtyard construction",
  "cultureNegative": "European medieval architecture, Gothic ornament, modern buildings"
}
```

## Step 2 — Shot decomposition

| `shotId` | Description | Mode | `fromPrev` | `toNext` |
|---|---|---|---|---|
| S01-01 | Bamboo courtyard establishing view | `establish` | opening | gate remains half open, anticipating entry |
| S01-02 | Ye Chen pushes through the gate | `establish` | half-open gate | his body's forward inertia stops |
| S01-03 | He stops and lowers his head | `narrative` | residual momentum after entry | lowered gaze is about to rise |
| S01-04 | He raises his eyes to Elder Liu | `intimate` | gaze beginning to lift | confirms the elder and decides to approach |
| S01-05 | Walks to the cushion and kneels | `narrative` | resolve after recognition | kneeling posture waits for acceptance |
| S01-06 | Elder Liu bends and offers the robe | `narrative` | Ye Chen is kneeling | robe pauses halfway between them |
| S01-07 | Tears remain in Ye Chen's eyes | `intimate` | robe suspended mid-offer | final emotional suspension |

Rhythm:

```text
establish -> establish -> narrative -> intimate -> narrative -> narrative -> intimate
three or more consecutive impact: none
four or more consecutive establish: none
single mode for entire scene: no
PASS
```

Performance card for S01-07:

```json
{
  "performanceCard": {
    "performanceBeat": "reverence at its limit; tears almost falling",
    "criticalFrame": "the tear reaches the lower eyelid but remains held",
    "emotionCarrier": "held tear, whitening fingertips, robe suspended halfway",
    "whyThisNeedsOwnShot": "This is the scene's emotional anchor and cannot be absorbed into the kneeling action."
  }
}
```

Freeze frame:

```yaml
shotId: S01-07
visualFreezeFrame:
  subject: Ye Chen
  bodyState: "kneeling on the cushion, weight on both knees, torso slightly forward"
  handState: "palms together at his chest, fingertips whitening with pressure"
  headState: "chin lifted 15 degrees, gaze directed to Elder Liu's face"
  expressionState: "tears held at the lower eyelids, lower lip trembling, brows gently drawn"
  environmentRelation: "cushion at the courtyard's right side, bamboo around him, morning side-backlight"
  propInteraction: "disciple robe paused halfway forward in Elder Liu's hands"
```

## Step 3 — Asset matching

Accepted identity locks:

```yaml
Ye Chen — child:
  tag: "<YC-child>"
  coreFeatures:
    - "boy around ten with a round youthful face"
    - "short unruly black hair"
    - "large bright attentive eyes"
    - "small slender frame around 130 cm"
    - "plain gray cotton training robe"
  signatureAccessory: "worn leather bracelet on the left wrist"

Elder Liu:
  tag: "<LZL>"
  coreFeatures:
    - "man in his sixties with a white beard to the chest"
    - "deep-set steady eyes with crow's feet"
    - "tall upright frame around 180 cm"
    - "flowing white and pale-blue elder robe with a cloud pattern"
    - "silver hair in a topknot with a jade hairpin"
  signatureAccessory: "jade hairpin in the topknot"
```

## Step 4 — Joint composition decision for S01-07

```json
{
  "jointCompositionDecision": {
    "shotIntent": "The audience feels Ye Chen struggling to contain emotion at the moment of acceptance.",
    "cameraPosition": "slightly low, just in front of the cushion",
    "cameraAngle": "slightly low angle",
    "relationComposition": "asymmetrical two-shot with scale contrast",
    "compositionMethod": "triangular composition",
    "figureOrientation": "Ye Chen faces upper frame-right; Elder Liu faces lower frame-left",
    "spatialAnchor": {
      "Ye Chen": {
        "position": "lower center-left",
        "facing": "upward toward frame-right"
      },
      "Elder Liu": {
        "position": "upper center",
        "facing": "downward toward frame-left"
      },
      "disciple robe": {
        "position": "between them, slightly above center"
      }
    }
  }
}
```

## Step 5 — Compile, generate, and review S01-07

```json
{
  "compiledPromptPacket": {
    "subjectCore": "Ye Chen, boy around ten with a round youthful face, short unruly black hair, large bright attentive eyes, small slender frame around 130 cm, plain gray cotton training robe, facing upper frame-right, worn leather bracelet on the left wrist, maintaining exact facial features from the attached reference; Elder Liu, man in his sixties with a white beard to the chest, deep-set steady eyes with crow's feet, tall upright frame around 180 cm, flowing white and pale-blue robe with cloud pattern, facing lower frame-left, jade hairpin in his silver topknot, maintaining exact facial features from the attached reference",
    "actionRelation": "Ye Chen kneels on a woven straw cushion, palms pressed at his chest until the fingertips pale, chin raised 15 degrees toward Elder Liu, tears pooled at the lower eyelid without falling, lower lip trembling; Elder Liu bends forward with both hands holding the folded pale-blue disciple robe halfway between them",
    "sceneEnvironment": "bamboo courtyard, grove on both sides, stone floor, morning mist, attached environment reference",
    "styleMedium": "cinematic Chinese xianxia, ink-painting spatial language with photoreal motivated light, muted elegant palette",
    "cameraComposition": "medium close-up, slightly low angle, asymmetrical two-shot, triangular composition, Ye Chen lower center-left and Elder Liu upper center",
    "lightingColor": "morning side-backlight from the gate, warm rim on the robe edge and wet lower eyelid, restrained green bounce from bamboo",
    "qualityTexture": "precise cotton, straw, stone, skin moisture, and morning mist",
    "constraints": "no text, watermark, logo, extra limbs, merged bodies, face distortion, distant framing, full-body poster layout, European architecture, or modern buildings",
    "finalPrompt": "Medium close-up from slightly below eye level in a bamboo courtyard, picking up from the disciple robe suspended mid-reach in the previous shot. Ye Chen is lower center-left, facing upper frame-right and kneeling on a woven straw cushion: a boy around ten with a round youthful face, short unruly black hair, large bright attentive eyes, a small slender frame, a plain gray cotton training robe, and a worn leather bracelet on his left wrist, maintaining exact facial features from the attached reference. His palms press together at his chest until the fingertips pale; his chin lifts 15 degrees and tears gather at the lower eyelids without falling, while the lower lip trembles. Elder Liu bends from upper center toward lower frame-left, a man in his sixties with a chest-length white beard, steady deep-set eyes, a tall upright frame, a white and pale-blue cloud-pattern robe, and a jade hairpin in his silver topknot, maintaining exact facial features from the attached reference. Both hands hold the folded pale-blue disciple robe halfway between them, leaving the emotion unresolved. Warm morning side-backlight from the gate rims the sleeve and makes the held tear the brightest point. Foreground: soft straw texture. Midground: both figures and the robe in sharp relational focus. Background: bamboo and morning mist. Asymmetrical triangular composition, cinematic Chinese xianxia with ink-painting space and precise natural material. Avoid text, watermark, extra limbs, merged bodies, face distortion, distant full-body poster framing, European architecture, and modern buildings."
  }
}
```

Product-native references:

```json
{
  "primaryPayload": {
    "reference_images": [
      {
        "assetName": "Ye Chen — child",
        "tier": "P0",
        "source": "asset_anchor"
      },
      {
        "assetName": "Bamboo courtyard — looking inward from gate",
        "tier": "P0.5",
        "source": "asset_anchor"
      },
      {
        "assetName": "S01-06 accepted output",
        "source": "rolling_ref"
      }
    ],
    "assetCalls": {
      "Ye Chen": "attached character reference",
      "Bamboo courtyard": "attached environment reference"
    }
  }
}
```

S01-07 uses S01-06 as the most recent accepted rolling reference. If the selected image model accepts fewer references, preserve the character anchor first and choose the scene or rolling image according to shot scale.

Review:

```json
{
  "shotId": "S01-07",
  "attempt": 1,
  "verdict": "pass",
  "reviewChecklist": {
    "characterConsistency": "pass",
    "framingExecution": "pass",
    "actionExpression": "pass",
    "sceneConsistency": "pass",
    "noDefects": "pass",
    "figureOrientation": "pass"
  },
  "failedItems": [],
  "fixApplied": "",
  "finalImageUrl": "generated output attached to the Canvas node"
}
```

## Scene summary

```text
S01 — Apprenticeship in the bamboo courtyard, seven shots
  Passed first attempt: S01-01, S01-02, S01-04, S01-05, S01-07 = 5
  Passed retry 1: S01-03, after simplifying the action = 1
  Passed retry 2: S01-06, after correcting framing and moving it earlier = 1
  Manual review: 0

Generated comparisons: 5*1 + 1*2 + 1*3 = 10 images, average 1.43 per shot.
```

In the current product, each retry should be a new Canvas generator node or revision node so the accepted and rejected attempts remain visible for comparison.
