import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  arrangeStudioNodes,
  resolveStudioResizeDirection,
  resolveStudioResizeSnap,
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
