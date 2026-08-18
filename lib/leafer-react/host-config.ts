import { DefaultEventPriority } from 'react-reconciler/constants';
import { Frame, Group, type UI } from 'leafer-editor';
import { getElement } from './element-registry';
import type { LeaferHostInstance, LeaferRootContainer } from './types';

type LeaferInstance = UI;

const HTML_CONTAINER_TAGS = new Set([
  'div',
  'span',
  'section',
  'article',
  'main',
  'header',
  'footer',
  'nav',
  'aside',
]);

const PROP_ALIAS_MAP: Record<string, string> = {
  backgroundColor: 'fill',
};

const EVENT_NAME_MAP: Record<string, string> = {
  onClick: 'tap',
  onTap: 'tap',
  onDoubleClick: 'double_tap',
  onPointerDown: 'pointer.down',
  onPointerUp: 'pointer.up',
  onPointerMove: 'pointer.move',
  onPointerEnter: 'pointer.enter',
  onPointerLeave: 'pointer.leave',
  onImageLoaded: 'image.loaded',
  onImageError: 'image.error',
  onResize: 'bounds.resize',
  onChildMounted: 'child.mounted',
};

function normalizeProps(props: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(props)) {
    result[PROP_ALIAS_MAP[key] || key] = props[key];
  }
  return result;
}

function isVisualContainer(props: Record<string, unknown>) {
  return 'fill' in props || 'stroke' in props || 'borderRadius' in props;
}

function isEventProp(key: string) {
  return key.startsWith('on') && key.length > 2;
}

function eventName(reactEventName: string) {
  return (
    EVENT_NAME_MAP[reactEventName] ||
    reactEventName.charAt(2).toLowerCase() + reactEventName.slice(3)
  );
}

function isInternalProp(key: string) {
  return key === 'children' || key === 'key' || key === 'ref' || key === 'onCreated';
}

function applyProps(instance: LeaferInstance, props: Record<string, unknown>) {
  const writable = instance as unknown as Record<string, unknown>;
  for (const key of Object.keys(props)) {
    if (isInternalProp(key)) continue;
    const value = props[key];
    if (isEventProp(key) && typeof value === 'function') {
      instance.on(eventName(key), value as never);
    } else {
      writable[key] = value;
    }
  }
}

function removeEvents(instance: LeaferInstance, props: Record<string, unknown>) {
  for (const key of Object.keys(props)) {
    const value = props[key];
    if (isEventProp(key) && typeof value === 'function') {
      instance.off(eventName(key), value as never);
    }
  }
}

function updateProps(
  instance: LeaferInstance,
  oldProps: Record<string, unknown>,
  newProps: Record<string, unknown>,
) {
  for (const key of Object.keys(oldProps)) {
    if (!isEventProp(key)) continue;
    if (oldProps[key] !== newProps[key] && typeof oldProps[key] === 'function') {
      instance.off(eventName(key), oldProps[key] as never);
    }
  }
  for (const key of Object.keys(newProps)) {
    if (!isEventProp(key)) continue;
    if (oldProps[key] !== newProps[key] && typeof newProps[key] === 'function') {
      instance.on(eventName(key), newProps[key] as never);
    }
  }

  const writable = instance as unknown as Record<string, unknown>;
  for (const key of Object.keys(newProps)) {
    if (isInternalProp(key) || isEventProp(key)) continue;
    if (oldProps[key] !== newProps[key]) writable[key] = newProps[key];
  }
  for (const key of Object.keys(oldProps)) {
    if (isInternalProp(key) || isEventProp(key)) continue;
    if (!(key in newProps)) writable[key] = undefined;
  }
}

export const hostConfig = {
  supportsMutation: true,
  supportsPersistence: false,
  isPrimaryRenderer: true,
  supportsHydration: false,

  getRootHostContext() {
    return {};
  },
  getChildHostContext(parentHostContext: unknown) {
    return parentHostContext;
  },
  createInstance(
    type: string,
    props: Record<string, unknown>,
    _rootContainer: LeaferRootContainer,
  ): LeaferHostInstance {
    const { children: _children, ...restProps } = props;
    const normalizedProps = normalizeProps(restProps);
    const ElementClass = HTML_CONTAINER_TAGS.has(type)
      ? isVisualContainer(normalizedProps)
        ? Frame
        : Group
      : getElement(type);
    const instance = new ElementClass(
      normalizedProps as never,
    ) as unknown as LeaferInstance;
    applyProps(instance, normalizedProps);
    if (typeof props.onCreated === 'function') {
      props.onCreated(instance);
    }
    return { instance, type, props: normalizedProps };
  },
  createTextInstance(text: string): LeaferHostInstance {
    return { instance: { __text: text }, type: '#text', props: {} };
  },
  appendInitialChild(parentHost: LeaferHostInstance, childHost: LeaferHostInstance) {
    if (childHost.type === '#text') return;
    (parentHost.instance as UI).add(childHost.instance as never);
  },
  finalizeInitialChildren() {
    return false;
  },
  shouldSetTextContent() {
    return false;
  },
  getPublicInstance(hostInstance: LeaferHostInstance) {
    return hostInstance.instance;
  },
  prepareForCommit() {
    return null;
  },
  resetAfterCommit() {},
  preparePortalMount() {},
  scheduleTimeout: setTimeout,
  cancelTimeout: clearTimeout,
  noTimeout: -1,
  getCurrentEventPriority() {
    return DefaultEventPriority;
  },
  getInstanceFromNode() {
    return null;
  },
  beforeActiveInstanceBlur() {},
  afterActiveInstanceBlur() {},
  prepareScopeUpdate() {},
  getInstanceFromScope() {
    return null;
  },
  detachDeletedInstance() {},
  NotPendingTransition: null,
  HostTransitionContext: {
    $$typeof: Symbol.for('react.context'),
    _currentValue: null,
    _currentValue2: null,
    _threadCount: 0,
    Provider: null,
    Consumer: null,
  },
  setCurrentUpdatePriority() {},
  getCurrentUpdatePriority() {
    return DefaultEventPriority;
  },
  resolveUpdatePriority() {
    return DefaultEventPriority;
  },
  resetFormInstance() {},
  requestPostPaintCallback() {},
  shouldAttemptEagerTransition() {
    return false;
  },
  trackSchedulerEvent() {},
  resolveEventType() {
    return null;
  },
  resolveEventTimeStamp() {
    return 0;
  },
  maySuspendCommit() {
    return false;
  },
  preloadInstance() {
    return true;
  },
  startSuspendingCommit() {},
  suspendInstance() {},
  waitForCommitToBeReady() {
    return null;
  },
  appendChild(parentHost: LeaferHostInstance, childHost: LeaferHostInstance) {
    if (childHost.type === '#text') return;
    (parentHost.instance as UI).add(childHost.instance as never);
  },
  appendChildToContainer(container: LeaferRootContainer, childHost: LeaferHostInstance) {
    if (childHost.type === '#text') return;
    const target = container.app.tree || container.app;
    target.add(childHost.instance as never);
    container.children.push(childHost);
  },
  insertBefore(
    parentHost: LeaferHostInstance,
    childHost: LeaferHostInstance,
    beforeHost: LeaferHostInstance,
  ) {
    if (childHost.type === '#text') return;
    const parent = parentHost.instance as UI;
    parent.add(childHost.instance as never);
    const children = parent.children as UI[];
    const childIndex = children.indexOf(childHost.instance as UI);
    const beforeIndex = children.indexOf(beforeHost.instance as UI);
    if (childIndex !== -1 && beforeIndex !== -1 && childIndex > beforeIndex) {
      children.splice(childIndex, 1);
      children.splice(beforeIndex, 0, childHost.instance as UI);
    }
  },
  insertInContainerBefore(
    container: LeaferRootContainer,
    childHost: LeaferHostInstance,
    beforeHost: LeaferHostInstance,
  ) {
    if (childHost.type === '#text') return;
    const target = container.app.tree || container.app;
    target.add(childHost.instance as never);
    const children = target.children as UI[];
    const childIndex = children.indexOf(childHost.instance as UI);
    const beforeIndex = children.indexOf(beforeHost.instance as UI);
    if (childIndex !== -1 && beforeIndex !== -1 && childIndex > beforeIndex) {
      children.splice(childIndex, 1);
      children.splice(beforeIndex, 0, childHost.instance as UI);
    }
    container.children.splice(container.children.indexOf(beforeHost), 0, childHost);
  },
  removeChild(_parentHost: LeaferHostInstance, childHost: LeaferHostInstance) {
    if (childHost.type === '#text') return;
    removeEvents(childHost.instance as UI, childHost.props);
    (childHost.instance as UI).remove();
  },
  removeChildFromContainer(container: LeaferRootContainer, childHost: LeaferHostInstance) {
    if (childHost.type === '#text') return;
    removeEvents(childHost.instance as UI, childHost.props);
    (childHost.instance as UI).remove();
    const index = container.children.indexOf(childHost);
    if (index !== -1) container.children.splice(index, 1);
  },
  commitUpdate(
    hostInstance: LeaferHostInstance,
    _type: string,
    oldProps: Record<string, unknown>,
    newProps: Record<string, unknown>,
  ) {
    const normalizedOld = normalizeProps(oldProps);
    const normalizedNew = normalizeProps(newProps);
    updateProps(hostInstance.instance as UI, normalizedOld, normalizedNew);
    hostInstance.props = normalizedNew;
  },
  commitTextUpdate(textInstance: LeaferHostInstance, _oldText: string, newText: string) {
    (textInstance.instance as { __text: string }).__text = newText;
  },
  commitMount() {},
  resetTextContent() {},
  clearContainer(container: LeaferRootContainer) {
    for (const child of [...container.children]) {
      if (child.type === '#text') continue;
      removeEvents(child.instance as UI, child.props);
      (child.instance as UI).remove();
    }
    container.children.length = 0;
  },
  hideInstance(hostInstance: LeaferHostInstance) {
    (hostInstance.instance as UI).visible = false;
  },
  unhideInstance(hostInstance: LeaferHostInstance) {
    (hostInstance.instance as UI).visible = true;
  },
  hideTextInstance() {},
  unhideTextInstance() {},
  prepareUpdate(
    _instance: LeaferHostInstance,
    _type: string,
    oldProps: Record<string, unknown>,
    newProps: Record<string, unknown>,
  ) {
    const keys = new Set([...Object.keys(oldProps), ...Object.keys(newProps)]);
    for (const key of keys) {
      if (isInternalProp(key) || isEventProp(key)) continue;
      if (oldProps[key] !== newProps[key]) return true;
    }
    return null;
  },
} as never;
