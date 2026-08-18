import { createElement, type ReactNode } from 'react';
import {
  Box as LeaferBox,
  Frame as LeaferFrame,
  Group as LeaferGroup,
  Image as LeaferImage,
  Line as LeaferLine,
  Rect as LeaferRect,
  Text as LeaferText,
} from 'leafer-editor';
import { registerElement } from './element-registry';

registerElement('Box', LeaferBox as never);
registerElement('Frame', LeaferFrame as never);
registerElement('Group', LeaferGroup as never);
registerElement('Image', LeaferImage as never);
registerElement('Line', LeaferLine as never);
registerElement('Rect', LeaferRect as never);
registerElement('Text', LeaferText as never);

type LeaferElementProps = Record<string, unknown> & { children?: ReactNode };

function defineLeaferElement(tag: string) {
  function Component({ children, ...props }: LeaferElementProps): ReactNode {
    return createElement(tag, props, children);
  }
  Component.displayName = `Leafer${tag}`;
  return Component;
}

export const Box = defineLeaferElement('Box');
export const Frame = defineLeaferElement('Frame');
export const Group = defineLeaferElement('Group');
export const Img = defineLeaferElement('Image');
export const Line = defineLeaferElement('Line');
export const Rect = defineLeaferElement('Rect');

export function Txt({ children, text, ...props }: LeaferElementProps) {
  return createElement('Text', { ...props, text: text ?? children });
}
