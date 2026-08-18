import type { App, UI } from 'leafer-editor';

export interface LeaferHostInstance {
  instance: UI | { __text: string };
  type: string;
  props: Record<string, unknown>;
}

export interface LeaferRootContainer {
  app: App;
  children: LeaferHostInstance[];
}
