import type { ReactNode } from 'react';
import ReactReconciler from 'react-reconciler';
import type { App } from 'leafer-editor';
import { hostConfig } from './host-config';
import type { LeaferRootContainer } from './types';

const reconciler = ReactReconciler(hostConfig);
const roots = new WeakMap<App, ReturnType<typeof reconciler.createContainer>>();

export function render(element: ReactNode, app: App) {
  let root = roots.get(app);
  if (!root) {
    const container: LeaferRootContainer = { app, children: [] };
    root = reconciler.createContainer(
      container,
      0,
      null,
      false,
      null,
      '',
      console.error,
      console.error,
      console.error,
      () => {},
    );
    roots.set(app, root);
  }
  reconciler.updateContainer(element, root, null, () => {});
}

export function unmount(app: App) {
  const root = roots.get(app);
  if (!root) return;
  reconciler.updateContainer(null, root, null, () => {});
  roots.delete(app);
}
