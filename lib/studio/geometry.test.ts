import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  arrangeStudioNodes,
  containedNodeIdsForSection,
  expandSectionsForExplicitChildren,
  findOpenStudioPosition,
  resolveStudioResizeDirection,
  resolveStudioResizeSnap,
  topStudioContentNodeAtPoint,
} from './geometry';
import type { StudioNode } from './types';

function node(id: string, x: number, y: number): StudioNode {
  return {
    id,
    type: 'image',
    x,
    y,
    width: 100,
    height: 80,
    rotation: 0,
    zIndex: Number(id.slice(1)),
    data: {
      kind: 'image',
      title: id,
      prompt: '',
      status: 'ready',
      aspect: '5:4',
    },
  };
}

describe('studio multi-selection arrangement', () => {
  it('organizes selected nodes into an evenly spaced grid', () => {
    const arranged = arrangeStudioNodes(
      [
        node('n1', 10, 20),
        node('n2', 420, 30),
        node('n3', 20, 360),
        node('n4', 390, 340),
      ],
      ['n1', 'n2', 'n3', 'n4'],
      'tidy',
    );

    assert.deepEqual(
      arranged.map(({ x, y }) => ({ x, y })),
      [
        { x: 10, y: 20 },
        { x: 134, y: 20 },
        { x: 10, y: 124 },
        { x: 134, y: 124 },
      ],
    );
  });

  it('aligns selected nodes without moving unselected nodes', () => {
    const arranged = arrangeStudioNodes(
      [node('n1', 10, 20), node('n2', 300, 90), node('n3', 600, 180)],
      ['n1', 'n2'],
      'align-top',
    );

    assert.deepEqual(
      arranged.map(({ x, y }) => ({ x, y })),
      [
        { x: 10, y: 20 },
        { x: 300, y: 20 },
        { x: 600, y: 180 },
      ],
    );
  });
});

describe('explicit Agent workflow groups', () => {
  it('keeps later members attached and expands the group around them', () => {
    const section: StudioNode = {
      ...node('n0', 0, 0),
      type: 'section',
      width: 300,
      height: 200,
      data: { ...node('n0', 0, 0).data, kind: 'section' },
    };
    const child = {
      ...node('n1', 420, 240),
      data: { ...node('n1', 420, 240).data, groupId: section.id },
    };

    assert.deepEqual(containedNodeIdsForSection([section, child], section.id), [
      child.id,
    ]);
    const expanded = expandSectionsForExplicitChildren([section, child]);
    const nextSection = expanded[0];
    assert.ok(nextSection.width >= child.x + child.width + 24 - section.x);
    assert.ok(nextSection.height >= child.y + child.height + 24 - section.y);
  });

  it('prefers a content node over the group behind it at the same point', () => {
    const section: StudioNode = {
      ...node('n0', 0, 0),
      type: 'section',
      width: 600,
      height: 400,
      zIndex: -1,
      data: { ...node('n0', 0, 0).data, kind: 'section' },
    };
    const child = node('n1', 48, 72);

    assert.equal(
      topStudioContentNodeAtPoint([section, child], { x: 80, y: 100 })?.id,
      child.id,
    );
  });
});

describe('studio resize snapping', () => {
  it('falls back to the active resize handle when editor.scale omits direction', () => {
    assert.equal(resolveStudioResizeDirection(undefined, undefined, 3), 3);
  });

  it('snaps the active resize edge to another node', () => {
    const result = resolveStudioResizeSnap(
      {
        left: 0,
        top: 0,
        right: 197,
        bottom: 120,
        width: 197,
        height: 120,
      },
      [
        {
          left: 200,
          top: 0,
          right: 320,
          bottom: 120,
          width: 120,
          height: 120,
        },
      ],
      3,
      6,
    );

    assert.equal(result.snappedX, true);
    assert.equal(result.bounds.right, 200);
    assert.equal(result.bounds.width, 200);
  });
});

describe('studio collision-free placement', () => {
  it('keeps the preferred position when it is open', () => {
    assert.deepEqual(
      findOpenStudioPosition(
        [node('n1', 0, 0)],
        { x: 240, y: 0 },
        {
          width: 100,
          height: 80,
        },
      ),
      { x: 240, y: 0 },
    );
  });

  it('moves a new node away from occupied content', () => {
    const position = findOpenStudioPosition(
      [node('n1', 0, 0)],
      { x: 0, y: 0 },
      { width: 100, height: 80 },
    );

    assert.ok(
      position.x + 100 <= -28 ||
        position.x >= 128 ||
        position.y + 80 <= -28 ||
        position.y >= 108,
    );
  });

  it('does not treat sections as content blockers', () => {
    const section = {
      ...node('n1', 0, 0),
      type: 'section' as const,
      data: { ...node('n1', 0, 0).data, kind: 'section' as const },
    };
    assert.deepEqual(
      findOpenStudioPosition(
        [section],
        { x: 0, y: 0 },
        {
          width: 100,
          height: 80,
        },
      ),
      { x: 0, y: 0 },
    );
  });

  it('keeps collision checks correct across negative spatial-grid cells', () => {
    const blockers = [
      node('n1', -410, -220),
      node('n2', -282, -220),
      node('n3', -154, -220),
    ];
    const position = findOpenStudioPosition(
      blockers,
      { x: -410, y: -220 },
      { width: 100, height: 80 },
    );

    assert.deepEqual(position, { x: -410, y: -112 });
  });

  it('falls back safely for an oversized legacy blocker', () => {
    const oversized = {
      ...node('n1', 0, 0),
      width: 1_000_000_000,
      height: 1_000_000_000,
    };
    const position = findOpenStudioPosition(
      [oversized],
      { x: 0, y: 0 },
      { width: 100, height: 80 },
    );

    assert.equal(Number.isFinite(position.x), true);
    assert.equal(Number.isFinite(position.y), true);
    assert.ok(
      position.x + 100 <= -28 ||
        position.x >= 1_000_000_028 ||
        position.y + 80 <= -28 ||
        position.y >= 1_000_000_028,
    );
  });

  it('falls back safely for an oversized placement query', () => {
    const position = findOpenStudioPosition(
      [node('n1', 0, 0)],
      { x: 0, y: 0 },
      { width: 1_000_000_000, height: 1_000_000_000 },
    );

    assert.equal(Number.isFinite(position.x), true);
    assert.equal(Number.isFinite(position.y), true);
  });

  it('places a large Agent workflow region on the canvas grid', () => {
    const blockers = [node('n1', 0, 0), node('n2', 128, 0)];
    const position = findOpenStudioPosition(
      blockers,
      { x: 18, y: 10 },
      { width: 1032, height: 744 },
      { gap: 48, grid: 24 },
    );

    assert.equal(Math.abs(position.x % 24), 0);
    assert.equal(Math.abs(position.y % 24), 0);
    assert.equal(
      blockers.every(
        (blocker) =>
          position.x + 1032 + 48 <= blocker.x ||
          position.x >= blocker.x + blocker.width + 48 ||
          position.y + 744 + 48 <= blocker.y ||
          position.y >= blocker.y + blocker.height + 48,
      ),
      true,
    );
  });
});
