import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BUILT_IN_STUDIO_SKILLS,
  MAX_ACTIVE_STUDIO_SKILLS,
  isStudioSkillId,
  normalizeStudioSkillIds,
} from './catalog';

test('ships twelve unique English skill definitions', () => {
  assert.equal(BUILT_IN_STUDIO_SKILLS.length, 12);
  assert.equal(
    new Set(BUILT_IN_STUDIO_SKILLS.map((skill) => skill.id)).size,
    BUILT_IN_STUDIO_SKILLS.length,
  );
  for (const skill of BUILT_IN_STUDIO_SKILLS) {
    assert.equal(
      /[\u3400-\u9fff]/u.test(`${skill.name}${skill.description}`),
      false,
    );
  }
});

test('normalizes, deduplicates, and caps untrusted skill ids', () => {
  const first = BUILT_IN_STUDIO_SKILLS[0].id;
  const normalized = normalizeStudioSkillIds([
    first,
    'not-a-skill',
    first,
    ...BUILT_IN_STUDIO_SKILLS.slice(1, 6).map((skill) => skill.id),
  ]);
  assert.equal(normalized.length, MAX_ACTIVE_STUDIO_SKILLS);
  assert.deepEqual(normalized.slice(0, 2), [
    first,
    BUILT_IN_STUDIO_SKILLS[1].id,
  ]);
  assert.equal(isStudioSkillId('not-a-skill'), false);
});
