# Appendix E: Validation Checklist

Run the relevant checks before a paid batch, before preview approval, and before final delivery.

## A. Start

- [ ] `projectId` is confirmed only when project persistence is requested.
- [ ] The selected `modelId` is currently enabled and supports the required references and parameters.
- [ ] `fallbackPermission` is explicit and defaults to `false`.
- [ ] Only the truly blocking question was asked; the user was not given a parameter dump.

## B. Reuse

- [ ] Existing character, environment, and prop assets available in the current project context were checked.
- [ ] Every item has `assetSource: New | Inherited | Changed`.
- [ ] A real `sourceMaterialId` or `sourceNodeId` is present for reusable items when available.
- [ ] Every reusable item has a concise `reuseReason`.
- [ ] `Inherited` items are excluded from generation.

## C. Scope

- [ ] Every asset has `generationPriority`.
- [ ] `MustGenerate` contains only story-critical assets.
- [ ] `ShouldGenerate` does not consume the core batch budget prematurely.
- [ ] `RegisterOnly` items are excluded from generator nodes.
- [ ] The user understands that complete registration is not full generation.

## D. Space and viewpoints

- [ ] Each included action-bearing scene has `sceneSpaceMap`.
- [ ] `entry`, `exit`, `mainAxis`, and elevation follow action evidence.
- [ ] `cameraZones[]` correspond to actual actions or shot needs.
- [ ] `forbiddenFlip` is explicit and internally consistent.
- [ ] `viewAngleManifest` covers included characters, scenes, and props.
- [ ] Every `needsSeparateAsset: true` item has `reason` and `sourceScene`.
- [ ] Reused special views become assets; one-off states remain prompt notes when appropriate.
- [ ] Special-angle names include a stable pose or viewpoint suffix.
- [ ] The user approved the extra count and cost.
- [ ] `RegisterOnly` scenes were not over-analyzed.

## E. Character prompt and identity

- [ ] The prompt begins with a clear subject and visual medium, not token-count folklore or an unsupported model syntax.
- [ ] Cultural context follows the biography, references, and approved brief without stereotypes.
- [ ] The base asset contains `standing in A-pose, full body, character reference sheet` when appropriate.
- [ ] Lighting and material behavior are explicit.
- [ ] Character prompts contain no unrelated environment, story action, or unapproved prop.
- [ ] The prompt is detailed enough for consistency without padding to an arbitrary character count.
- [ ] `lockDescription` contains the name plus two or three recognition features.
- [ ] `characterDescBrief` contains two or three concise English anchors when the document uses that field.
- [ ] Every approved character has a unique `identityLock.tag`.
- [ ] `identityLock.coreFeatures` has five English items and agrees with `lockDescription`.
- [ ] `signatureAccessory`, `preferredAngle`, and `colorPalette` are present.
- [ ] Colors come from the approved validation image.
- [ ] A separate-pose prompt contains `lockDescription`, exact pose, route package, and matching `assetName`.

## F. Environments and props

- [ ] Environments are empty unless a justified crowd exception applies.
- [ ] Any crowd is low-detail, non-hero, and coherent with the setting.
- [ ] Environment prompts establish foreground, midground, and background.
- [ ] Architecture and production design match the confirmed culture and world.
- [ ] Character, environment, and prop media routes remain consistent.
- [ ] Props use a clean white or neutral display ground unless the brief specifies another standard.
- [ ] Prop material and wear belong to the same visual constitution.
- [ ] Every special environment view uses its `cameraZone.position` and `lookAt`.
- [ ] A special view matches base style, palette, architecture, topology, and `viewType`.

## G. Preview and batching

- [ ] Protagonists receive two written options when genuine ambiguity exists; functional roles do not receive wasteful alternatives.
- [ ] Up to four characters are reviewed individually; five to eight are split; larger casts use batches of three or four supporting characters.
- [ ] The user is not forced to approve too many images in one turn.
- [ ] `Inherited` items are absent from preview generation.
- [ ] Every generator node shows model, prompt, parameters, references, and credit cost before the action.

## H. Results and delivery

- [ ] Every stored `coverUrl` comes from a successful result.
- [ ] `characterSheetUrl` and applicable `emotionSheetUrl` are present.
- [ ] Real Canvas node IDs are recorded where useful; no unavailable media-library IDs are fabricated.
- [ ] A failed asset is isolated rather than silently poisoning the batch.
- [ ] The summary includes successes, failures, failed items, and next steps.
- [ ] The document contains full `sceneSpaceMap[]` and `viewAngleManifest` sections.
- [ ] Every separate-angle URL is written back to its exact manifest entry.
- [ ] Every separate-angle `assetName` exactly matches the plan.
- [ ] `qualityProfile` contains `route`, `globalBase`, `characterPackage`, `scenePackage`, `propPackage`, `negativeLocks`, and `qualityFloor`.
- [ ] `qualityFloor` is no more than 20 words, contains only reusable style/quality anchors, and excludes asset-specific materials.
