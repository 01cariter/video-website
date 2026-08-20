export const MAX_ACTIVE_STUDIO_SKILLS = 3;

export const BUILT_IN_STUDIO_SKILLS = [
  {
    id: 'one-line-story-to-script',
    name: 'One-Line Story to Script',
    description: 'Turn a single story premise into a structured screenplay.',
    category: 'Writing',
  },
  {
    id: 'multi-model-scriptwriting-pipeline',
    name: 'Multi-Model Scriptwriting Pipeline',
    description:
      'Develop, challenge, and refine a screenplay through staged roles.',
    category: 'Writing',
  },
  {
    id: 'script-to-storyboard-video',
    name: 'Script to Storyboard Video',
    description:
      'Direct camera, staging, performance, and motion from a script.',
    category: 'Direction',
  },
  {
    id: 'script-to-keyframe-prompts',
    name: 'Script to Keyframe Prompts',
    description:
      'Compile screenplay beats into production-ready keyframe prompts.',
    category: 'Storyboarding',
  },
  {
    id: 'script-assets-to-images',
    name: 'Script Assets to Images',
    description:
      'Extract recurring story assets and generate a consistent visual set.',
    category: 'Visual development',
  },
  {
    id: 'atomic-storyboard-keyframes',
    name: 'Atomic Storyboard Keyframes',
    description:
      'Break scenes into atomic shots and precise cinematic keyframes.',
    category: 'Storyboarding',
  },
  {
    id: 'scene-concept-design',
    name: 'Scene Concept Design',
    description:
      'Build an art-directed environment concept from narrative intent.',
    category: 'Visual development',
  },
  {
    id: 'multi-angle-grid',
    name: 'Multi-Angle Grid',
    description: 'Create a consistent nine-view study of one subject or scene.',
    category: 'Visual development',
  },
  {
    id: 'asset-multiview-generation',
    name: 'Asset Multiview Generation',
    description:
      'Generate continuity-safe orthographic and cinematic asset views.',
    category: 'Visual development',
  },
  {
    id: 'progressive-asset-design',
    name: 'Progressive Asset Design',
    description:
      'Evolve an asset through structured aesthetic exploration and review.',
    category: 'Visual development',
  },
  {
    id: 'continuous-shot-four-panel',
    name: 'Continuous Shot Four-Panel',
    description:
      'Design four connected frames with continuous action and geography.',
    category: 'Storyboarding',
  },
  {
    id: 'audiovisual-director',
    name: 'Audiovisual Director',
    description:
      'Shape a complete next-generation cinematic audiovisual treatment.',
    category: 'Direction',
  },
] as const;

export type StudioSkill = (typeof BUILT_IN_STUDIO_SKILLS)[number];
export type StudioSkillId = StudioSkill['id'];

const STUDIO_SKILL_IDS = new Set<string>(
  BUILT_IN_STUDIO_SKILLS.map((skill) => skill.id),
);

export function isStudioSkillId(value: unknown): value is StudioSkillId {
  return typeof value === 'string' && STUDIO_SKILL_IDS.has(value);
}

export function normalizeStudioSkillIds(value: unknown): StudioSkillId[] {
  if (!Array.isArray(value)) return [];
  const unique: StudioSkillId[] = [];
  for (const candidate of value) {
    if (!isStudioSkillId(candidate) || unique.includes(candidate)) continue;
    unique.push(candidate);
    if (unique.length === MAX_ACTIVE_STUDIO_SKILLS) break;
  }
  return unique;
}

export function studioSkillById(id: StudioSkillId) {
  return BUILT_IN_STUDIO_SKILLS.find((skill) => skill.id === id)!;
}
