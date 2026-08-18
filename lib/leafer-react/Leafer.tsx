'use client';

import '@leafer-in/editor';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { App, type ILeaferConfig } from 'leafer-editor';
import { render, unmount } from './renderer';

export interface LeaferProps {
  fill?: string;
  editor?: boolean | Record<string, unknown>;
  tree?: Partial<ILeaferConfig>;
  wheel?: Record<string, unknown>;
  move?: Record<string, unknown>;
  zoom?: Record<string, unknown>;
  children?: ReactNode;
  onAppReady?: (app: App) => void;
  className?: string;
  style?: CSSProperties;
}

export function Leafer({
  fill,
  editor = false,
  tree,
  wheel,
  move,
  zoom,
  children,
  onAppReady,
  className,
  style,
}: LeaferProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<App | null>(null);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const view = containerRef.current;
    if (!view) return;

    const treeConfig: ILeaferConfig = {
      type: 'design',
      pixelSnap: true,
      pointSnap: true,
      smooth: true,
      webgl: true,
      fill,
      ...tree,
    };
    const app = new App({
      view,
      tree: treeConfig,
      ...(editor
        ? { editor: editor === true ? { hideOnMove: false, skewable: false } : editor }
        : {}),
      ...(wheel ? { wheel } : {}),
      ...(move ? { move } : {}),
      ...(zoom ? { zoom } : {}),
    });
    appRef.current = app;
    setReady(true);
    onAppReady?.(app);

    return () => {
      unmount(app);
      app.destroy();
      appRef.current = null;
    };
    // The canvas runtime is intentionally mounted once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const previousChildren = useRef<ReactNode>(undefined);
  useLayoutEffect(() => {
    if (!ready || !appRef.current || previousChildren.current === children) return;
    previousChildren.current = children;
    render(children, appRef.current);
  }, [children, ready]);

  useEffect(() => {
    const container = containerRef.current;
    const app = appRef.current;
    if (!container || !app) return;
    const resize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (width > 0 && height > 0) {
        app.resize({ width, height, pixelRatio: window.devicePixelRatio || 1 });
      }
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [ready]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: '100%', height: '100%', ...style }}
    />
  );
}
