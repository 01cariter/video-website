import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { StudioNode } from '@/lib/studio/types';
import {
  canvasReferenceOptions,
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
