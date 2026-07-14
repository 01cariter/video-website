'use client';

import { useEffect, useRef } from 'react';
import {
  Hand,
  Image as ImageIcon,
  Maximize2,
  MousePointer2,
  Plus,
  Video,
} from 'lucide-react';

export default function CanvasToolbar({
  addMenuOpen,
  onAdd,
  onCloseAddMenu,
  onFitView,
  onToggleAddMenu,
  onToolChange,
  toolMode,
}) {
  const addRef = useRef(null);

  useEffect(() => {
    if (!addMenuOpen) return undefined;

    const onPointerDown = (event) => {
      if (addRef.current && !addRef.current.contains(event.target)) onCloseAddMenu();
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onCloseAddMenu();
    };

    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [addMenuOpen, onCloseAddMenu]);

  return (
    <nav className="canvas-toolbar" aria-label="画布工具">
      <div className="canvas-toolbar__add" ref={addRef}>
        <button
          className="canvas-tool-button canvas-tool-button--primary"
          type="button"
          aria-label="添加节点"
          title="添加节点"
          aria-expanded={addMenuOpen}
          onClick={onToggleAddMenu}
        >
          <Plus aria-hidden="true" />
        </button>
        {addMenuOpen ? (
          <div className="canvas-add-menu" role="menu">
            <button type="button" role="menuitem" onClick={() => onAdd('video')}>
              <Video aria-hidden="true" />
              <span><b>视频场景</b><small>文生视频 / 关键帧</small></span>
            </button>
            <button type="button" role="menuitem" onClick={() => onAdd('image')}>
              <ImageIcon aria-hidden="true" />
              <span><b>图片生成</b><small>文生图</small></span>
            </button>
          </div>
        ) : null}
      </div>

      <span className="canvas-toolbar__divider" aria-hidden="true" />

      <button
        className="canvas-tool-button"
        type="button"
        aria-label="选择工具"
        title="选择工具"
        aria-pressed={toolMode === 'select'}
        onClick={() => onToolChange('select')}
      >
        <MousePointer2 aria-hidden="true" />
      </button>
      <button
        className="canvas-tool-button"
        type="button"
        aria-label="平移画布"
        title="平移画布"
        aria-pressed={toolMode === 'pan'}
        onClick={() => onToolChange('pan')}
      >
        <Hand aria-hidden="true" />
      </button>
      <button
        className="canvas-tool-button"
        type="button"
        aria-label="适配画布"
        title="适配画布"
        onClick={onFitView}
      >
        <Maximize2 aria-hidden="true" />
      </button>
    </nav>
  );
}
