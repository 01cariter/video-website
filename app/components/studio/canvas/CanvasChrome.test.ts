import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { StudioNode } from '@/lib/studio/types';
import {
  canvasReferenceOptions,
  selectionChromePlacement,
  selectionIntersectsViewport,
} from './CanvasChrome.logic';

function imageNode(
  id: string,
  src?: string,
  patch: Partial<StudioNode['data']> = {},
): StudioNode {
  return {
    id,
    type: 'image',
    x: 0,
    y: 0,
    width: 300,
    height: 300,
    rotation: 0,
    zIndex: 1,
    data: {
      kind: 'image',
      title: id,
      prompt: '',
      status: 'ready',
      aspect: '1:1',
      src,
      ...patch,
    },
  };
}

describe('studio node overlay visibility', () => {
  const viewport = { width: 800, height: 600, leftInset: 200, rightInset: 300 };

  it('keeps overlays while any part of the selection remains visible', () => {
    assert.equal(
      selectionIntersectsViewport(
        { left: 180, top: 20, right: 240, bottom: 80, width: 60, height: 60 },
        viewport,
      ),
      true,
    );
  });

  it('hides overlays after the selection leaves the usable viewport', () => {
    assert.equal(
      selectionIntersectsViewport(
        { left: 510, top: 20, right: 620, bottom: 80, width: 110, height: 60 },
        viewport,
      ),
      false,
    );
    assert.equal(
      selectionIntersectsViewport(
        { left: 220, top: 620, right: 320, bottom: 700, width: 100, height: 80 },
        viewport,
      ),
      false,
    );
  });
});

describe('selection toolbar placement', () => {
  const stage = { width: 1000, height: 700 };
  const node = {
    left: 400,
    top: 300,
    right: 600,
    bottom: 500,
    width: 200,
    height: 200,
  };

  it('centres the toolbar on the selection and sits it above', () => {
    assert.deepEqual(
      selectionChromePlacement({
        rect: node,
        stage,
        surface: { width: 300, height: 44 },
      }),
      { left: 350, top: 246, visible: true },
    );
  });

  it('places generator toolbars below the selection', () => {
    assert.equal(
      selectionChromePlacement({
        rect: node,
        stage,
        surface: { width: 300, height: 44 },
        below: true,
      }).top,
      510,
    );
  });

  // The measured box drives the maths, so a toolbar measured from a previous,
  // wider selection used to land hundreds of pixels off.
  it('follows the measured toolbar width rather than a stale one', () => {
    const narrow = selectionChromePlacement({
      rect: node,
      stage,
      surface: { width: 300, height: 44 },
    });
    const stale = selectionChromePlacement({
      rect: node,
      stage,
      surface: { width: 900, height: 116 },
    });
    assert.equal(narrow.left, 350);
    assert.equal(stale.left, 50);
  });

  it('keeps the toolbar inside the insets and the stage', () => {
    const placement = selectionChromePlacement({
      rect: { left: 500, top: 10, right: 700, bottom: 210, width: 200, height: 200 },
      stage,
      surface: { width: 300, height: 44 },
      leftInset: 264,
      rightInset: 380,
    });
    assert.equal(placement.visible, true);
    assert.equal(placement.left, 310);
    assert.equal(placement.top, 10);
  });

  it('hides the toolbar until the stage has been measured', () => {
    assert.deepEqual(
      selectionChromePlacement({
        rect: node,
        stage: { width: 0, height: 0 },
        surface: { width: 300, height: 44 },
      }),
      { left: 0, top: 0, visible: false },
    );
    assert.deepEqual(
      selectionChromePlacement({
        rect: null,
        stage,
        surface: { width: 300, height: 44 },
      }),
      { left: 0, top: 0, visible: false },
    );
  });
});

describe('canvas reference image options', () => {
  it('returns unique visible image assets and excludes the active node', () => {
    const duplicate = imageNode('duplicate', 'https://example.com/one.png');
    const hidden = imageNode('hidden', 'https://example.com/hidden.png', {
      hidden: true,
    });
    const text = imageNode('text', 'https://example.com/text.png');
    text.type = 'text';
    text.data.kind = 'text';

    assert.deepEqual(
      canvasReferenceOptions(
        [
          imageNode('active', 'https://example.com/active.png'),
          imageNode('one', 'https://example.com/one.png'),
          duplicate,
          hidden,
          text,
          imageNode('empty'),
        ],
        ['active'],
      ),
      [
        {
          id: 'one',
          title: 'one',
          src: 'https://example.com/one.png',
        },
      ],
    );
  });
});
