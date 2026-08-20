# Appendix F: Invocation Examples

Users can invoke the workflow with a short contextual request; they do not need to reproduce its internal state machine.

## 1. New project

```text
Read `[script-file].md` and start progressive asset design.
This is a new project; the project ID is `[project-id]` if persistence is available.
Use `[enabled-model-id or default]`.
First show me the asset inventory, viewpoint implications, and two or three visual-route proposals.
```

## 2. Sequel or next episode with reuse

```text
Read `[episode-2-script].md` and extract its assets.
This continues an existing project. Check the project context for prior character, environment, and prop assets first.
Mark unchanged items `Inherited` and skip generation. Mark injured, older, or changed-wardrobe states `Changed` and preserve identity while changing only the state.
Show me the scope and reuse evidence before generating.
```

## 3. Large ensemble with a controlled budget

```text
Read `[ensemble-script].md` and inventory every asset, but apply strict generation priorities.
Only protagonists and the primary antagonists belong in `MustGenerate`.
Important supporting roles belong in `ShouldGenerate` for a later batch.
Non-speaking background roles and ordinary props belong in `RegisterOnly` and must not generate now.
Review supporting-character previews in batches of four.
```

## 4. Specific visual reference

```text
Read `[script].md` and begin asset design.
Do not freely diverge during route proposals: use `[reference work]` only to extract these approved traits: `[brush texture]`, `[hard high-contrast light]`, and `[industrial fantasy materials]`.
Do not copy its characters, symbols, or signature designs.
Show the first protagonist validation image before extending the route.
```

## 5. Add one asset without a full script

```text
Use progressive asset design without reading a script.
Add one character to the current project: `Nightingale, 25, assassin, cyberpunk setting, mechanical left arm, controlled and unsentimental.`
Reuse the project's confirmed visual constitution and show two written proposals before one validation image.
```

The minimum useful input is the script or asset brief plus enough project context to locate approved references. The Agent should ask only for missing information that materially changes or blocks the result.
