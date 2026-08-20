# Appendix D: End-to-End Worked Example

This example applies the workflow to `Lin_Daiyu_Uproots_a_Willow_script.md` and closes with an asset document a downstream storyboard workflow can inherit.

## Step 0: start checks

User:

> Read `Lin_Daiyu_Uproots_a_Willow_script.md` and begin asset design. The project ID is `12345`.

Agent checks that the target project exists when project persistence is available, identifies an enabled image model, and uses the current Canvas as the working area. It does not claim a library path or upload target that the product cannot actually access.

## Step 0.5: reuse

Evidence from the current project:

- Lin Daiyu: no usable asset, `New`.
- Jia Baoyu: no usable asset, `New`.
- Zijuan: no usable asset, `New`.
- Weeping willow outside Xiaoxiang House: no usable asset, `New`.
- Bird's-nest soup bowl: no usable asset, `New`.

## Step 1: inventory

User-facing summary:

> The script is a period contrast comedy. `MustGenerate`: Lin Daiyu, Jia Baoyu, and the weeping willow outside Xiaoxiang House. `ShouldGenerate`: Zijuan and the bird's-nest soup bowl. `RegisterOnly`: two maids and Xue Baochai's cameo. Two viable routes are restrained Chinese ink art with misty depth, or premium CG fantasy with large-format cinematic lighting and strong character dimensionality. After you select a route, I will map space and viewpoint needs before character design.

## Step 1.5: space and viewpoint planning

### `sceneSpaceMap`

```json
[
  {
    "sceneId": "S01",
    "sceneName": "Weeping willow outside Xiaoxiang House",
    "spatialType": "exterior",
    "entry": "Stone-path entry at rear-left of frame",
    "exit": "Courtyard gate at front-right",
    "mainAxis": "Lin Daiyu moves from rear-left toward the willow at front-right",
    "keyPositions": {
      "weepingWillow": "center-right",
      "stoneTable": "front-left",
      "courtyardGate": "front-right",
      "rockery": "rear-left"
    },
    "heightRelation": "The willow is several times taller than the characters; hanging branches create overhead pressure",
    "lightSource": "Diffused morning mist as key, with side-backlight through willow leaves",
    "forbiddenFlip": "Stone-path entry remains rear-left and the gate remains front-right",
    "cameraZones": [
      {
        "zoneId": "CZ-01",
        "position": "Low position before the tree",
        "lookAt": "Lin Daiyu and the willow",
        "usage": "Contrasting character introduction",
        "viewType": "low-angle-character-tree"
      },
      {
        "zoneId": "CZ-02",
        "position": "Inside the courtyard gate looking outward",
        "lookAt": "Stone-path entry and willow",
        "usage": "Entrance or gate-opening shot",
        "viewType": "interior-facing-garden"
      }
    ]
  }
]
```

### Planning-stage `viewAngleManifest`

```json
{
  "characters": [
    {
      "assetName": "Lin Daiyu · moon-white-gown-state",
      "baseAngles": ["front", "three-quarter", "back"],
      "actionAngles": [
        {
          "angle": "front-lifting-tree",
          "reason": "In S01, Lin Daiyu uproots the tree front-on; this contrast is the episode's signature beat",
          "sourceScene": "S01",
          "priority": "high",
          "needsSeparateAsset": true,
          "assetName": "Lin Daiyu · moon-white-gown-state · front-lifting-tree",
          "coverUrl": null
        },
        {
          "angle": "side-look-smirk",
          "reason": "The S03 side-profile smirk appears once and can be described in the storyboard prompt",
          "sourceScene": "S03",
          "priority": "medium",
          "needsSeparateAsset": false,
          "assetName": null,
          "coverUrl": null
        }
      ],
      "generationPlan": "Base turnaround plus a front-lifting-tree reference"
    }
  ],
  "scenes": [
    {
      "assetName": "Weeping willow outside Xiaoxiang House",
      "baseAngles": ["standard-exterior"],
      "viewAngles": [
        {
          "angle": "interior-facing-garden",
          "reason": "S01 uses the gate-interior view toward the willow and stone path for the key entrance",
          "sourceScene": "S01",
          "cameraZone": "CZ-02",
          "priority": "high",
          "needsSeparateAsset": true,
          "assetName": "Xiaoxiang House willow · gate-facing-stone-path",
          "coverUrl": null
        }
      ],
      "generationPlan": "Standard exterior plus the gate-facing-stone-path view"
    }
  ],
  "props": [
    {
      "assetName": "bird's-nest soup bowl",
      "baseAngles": ["product-shot"],
      "stateAngles": [
        {
          "angle": "held-in-hand",
          "reason": "Zijuan carries the bowl once in S02; describe the held state downstream",
          "sourceScene": "S02",
          "priority": "medium",
          "needsSeparateAsset": false,
          "assetName": null,
          "coverUrl": null
        }
      ],
      "generationPlan": "Standard display image only"
    }
  ]
}
```

User-facing summary:

> Two references merit separate generation: Lin Daiyu's front-facing tree-lifting pose and the courtyard-gate view toward the stone path. Both recur or carry the core visual joke; all other unusual states can remain storyboard prompt instructions. This adds two images. Confirm before aesthetic convergence.

## Step 2: converge and compile

User:

> Choose premium CG fantasy, but keep the characters' classical restraint.

The Agent locks the route, classical-plus-superhuman contrast, `qualityProfile`, and exclusions. It does not add unconfirmed comic exaggeration.

## Step 3: character approval and `identityLock`

User:

> Lin Daiyu should appear physically delicate while hiding immense strength; Jia Baoyu is an endearingly naive young master; Zijuan is quiet and controlled.

After written proposals and approved validation images, the Agent records:

```yaml
identityLock:
  tag: "<LDY>"
  coreFeatures:
    - "long straight black hair reaching the waist"
    - "willow-shaped eyebrows, almond eyes, tiny tear mole beneath the left eye"
    - "slender delicate frame, approximately 165 cm"
    - "pale porcelain complexion"
    - "flowing moon-white period gown with faint jade-green accents"
  signatureAccessory: "jade tassel pendant at the waist"
  preferredAngle: "3/4 view"
  colorPalette:
    hair: "#1a1a1a"
    skin: "#f4e7dc"
    costume_primary: "#f7f7f2"
    costume_accent: "#b7d4c2"
```

## Step 4: environment, prop, and special-angle plan

Base assets: Lin Daiyu, Jia Baoyu, Zijuan, the willow environment, and the soup bowl.

Separate-angle assets:

- `Lin Daiyu · moon-white-gown-state · front-lifting-tree`
- `Xiaoxiang House willow · gate-facing-stone-path`

These names must exactly match the manifest. After each generation returns a persistent URL, write it back to the originating entry.

## Step 5: generate and validate

The Agent creates generator nodes with the approved quality package, visible cost, prompt, aspect ratio, model, and reference attachments. It validates text absence, identity/style, and environment topology. It records only actual node IDs and media URLs.

Required downstream fields include `coverUrl`, `characterSheetUrl`, `assetName`, `lockDescription`, `identityLock`, `sceneSpaceMap`, and `viewAngleManifest`; `emotionSheetUrl` is required only for `MustGenerate` characters. Preserve legacy IDs only when a real upstream system supplied them.

## Step 6: final document extract

```yaml
- name: "Lin Daiyu"
  assetName: "Lin Daiyu · moon-white-gown-state"
  level: "MustGenerate"
  coverUrl: "https://cdn.example.com/lin-daiyu-cover.png"
  characterSheetUrl: "https://cdn.example.com/lin-daiyu-turnaround.png"
  emotionSheetUrl: "https://cdn.example.com/lin-daiyu-emotions.png"
  lockDescription: "waist-length straight black hair; willow brows and almond eyes; tear mole beneath left eye; slender frame; moon-white gown with jade accents; jade waist tassel"
  identityLock:
    tag: "<LDY>"
    coreFeatures:
      - "long straight black hair reaching the waist"
      - "willow-shaped eyebrows, almond eyes, tiny tear mole beneath the left eye"
      - "slender delicate frame, approximately 165 cm"
      - "pale porcelain complexion"
      - "flowing moon-white period gown with faint jade-green accents"
    signatureAccessory: "jade tassel pendant at the waist"
    preferredAngle: "3/4 view"
    colorPalette:
      hair: "#1a1a1a"
      skin: "#f4e7dc"
      costume_primary: "#f7f7f2"
      costume_accent: "#b7d4c2"
```

Final manifest extract:

```json
{
  "characters": [
    {
      "assetName": "Lin Daiyu · moon-white-gown-state",
      "baseAngles": ["front", "three-quarter", "back"],
      "actionAngles": [
        {
          "angle": "front-lifting-tree",
          "reason": "The S01 front-facing tree lift is the episode's signature contrast",
          "sourceScene": "S01",
          "priority": "high",
          "needsSeparateAsset": true,
          "assetName": "Lin Daiyu · moon-white-gown-state · front-lifting-tree",
          "coverUrl": "https://cdn.example.com/lin-daiyu-lifting-tree.png"
        }
      ],
      "generationPlan": "Base turnaround plus the front-lifting-tree reference"
    }
  ],
  "scenes": [
    {
      "assetName": "Weeping willow outside Xiaoxiang House",
      "baseAngles": ["standard-exterior"],
      "viewAngles": [
        {
          "angle": "interior-facing-garden",
          "reason": "The S01 gate-interior view is a key entrance angle",
          "sourceScene": "S01",
          "cameraZone": "CZ-02",
          "priority": "high",
          "needsSeparateAsset": true,
          "assetName": "Xiaoxiang House willow · gate-facing-stone-path",
          "coverUrl": "https://cdn.example.com/xiaoxiang-gate-view.png"
        }
      ],
      "generationPlan": "Standard exterior plus the gate-facing-stone-path view"
    }
  ]
}
```

| assetName | type | angle or pose | sourceScene | needsSeparateAsset | coverUrl |
|---|---|---|---|---|---|
| Lin Daiyu · moon-white-gown-state · front-lifting-tree | character | front-lifting-tree | S01 | true | https://cdn.example.com/lin-daiyu-lifting-tree.png |
| Xiaoxiang House willow · gate-facing-stone-path | environment | interior-facing-garden | S01 | true | https://cdn.example.com/xiaoxiang-gate-view.png |

Final user summary reports five standard assets, two special-angle assets, complete downstream fields, any failures, and that the storyboard workflow can inherit `sceneSpaceMap`, `viewAngleManifest`, and `identityLock` directly.
