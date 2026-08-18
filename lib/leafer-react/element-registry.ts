import type { UI } from 'leafer-editor';

const registry = new Map<string, new (props?: Record<string, unknown>) => UI>();

export function registerElement(
  tag: string,
  constructor: new (props?: Record<string, unknown>) => UI,
) {
  registry.set(tag, constructor);
}

export function getElement(tag: string): new (props?: Record<string, unknown>) => UI {
  const constructor = registry.get(tag);
  if (!constructor) {
    throw new Error(`Unknown Leafer element: <${tag}>.`);
  }
  return constructor;
}
