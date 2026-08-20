import 'server-only';

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  normalizeStudioSkillIds,
  studioSkillById,
  type StudioSkillId,
} from './catalog';

const STUDIO_SKILL_RESOURCES: Record<StudioSkillId, readonly string[]> = {
  'one-line-story-to-script': ['SKILL.md'],
  'multi-model-scriptwriting-pipeline': ['SKILL.md'],
  'script-to-storyboard-video': ['SKILL.md'],
  'script-to-keyframe-prompts': ['SKILL.md'],
  'script-assets-to-images': ['SKILL.md'],
  'atomic-storyboard-keyframes': [
    'SKILL.md',
    'references/appendix-A-script-decomposition.md',
    'references/appendix-B-composition-camera.md',
    'references/appendix-C-prompt-compiler.md',
    'references/appendix-D-full-example.md',
  ],
  'scene-concept-design': ['SKILL.md'],
  'multi-angle-grid': ['SKILL.md'],
  'asset-multiview-generation': ['SKILL.md'],
  'progressive-asset-design': [
    'SKILL.md',
    'references/appendix-A-style-ip-library.md',
    'references/appendix-B-aesthetic-systems.md',
    'references/appendix-C-prompt-templates.md',
    'references/appendix-D-full-example.md',
    'references/appendix-E-checklist.md',
    'references/appendix-F-user-prompts.md',
  ],
  'continuous-shot-four-panel': ['SKILL.md'],
  'audiovisual-director': ['SKILL.md'],
};

export function studioSkillSelectionText(value: unknown) {
  const skillIds = normalizeStudioSkillIds(value);
  if (!skillIds.length) return '';
  return skillIds
    .map((id) => {
      const skill = studioSkillById(id);
      const resources = STUDIO_SKILL_RESOURCES[id].join(', ');
      return `- ${skill.name} (${id}): ${skill.description}\n  Allowed resources: ${resources}`;
    })
    .join('\n');
}

export async function readStudioSkillResource(
  selectedSkillIds: readonly StudioSkillId[],
  skillId: StudioSkillId,
  resource: string,
) {
  if (!selectedSkillIds.includes(skillId)) {
    throw new Error('That skill is not active for this request.');
  }
  if (!STUDIO_SKILL_RESOURCES[skillId].includes(resource)) {
    throw new Error('That resource is not available for this skill.');
  }
  const filePath = join(
    process.cwd(),
    'lib',
    'studio',
    'skills',
    'builtin',
    skillId,
    resource,
  );
  return readFile(filePath, 'utf8');
}
