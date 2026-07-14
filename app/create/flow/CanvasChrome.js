'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  Maximize2,
  PanelRightClose,
  PanelRightOpen,
  Undo2,
} from 'lucide-react';

const SAVE_LABELS = {
  idle: '等待保存',
  saving: '保存中',
  saved: '已保存',
  error: '保存失败',
};

export default function CanvasChrome({
  agentOpen,
  aiReady,
  canUndo,
  onFitView,
  onToggleAgent,
  onUndo,
  saveState,
}) {
  const saveLabel = SAVE_LABELS[saveState] || SAVE_LABELS.idle;

  return (
    <header className="canvas-chrome" aria-label="画布控制">
      <div className="canvas-chrome__group">
        <Link className="canvas-icon-button" href="/create" aria-label="返回创建页" title="返回创建页">
          <ArrowLeft aria-hidden="true" />
        </Link>
        <span className="save-indicator" data-state={saveState} role="status" aria-live="polite">
          <span className="save-indicator__dot" aria-hidden="true" />
          <span className="sr-only">{saveLabel}</span>
        </span>
        {!aiReady ? <span className="canvas-demo" title="当前使用本地降级模式">demo</span> : null}
      </div>

      <div className="canvas-chrome__group">
        <button
          className="canvas-icon-button"
          type="button"
          aria-label="撤销"
          title="撤销"
          disabled={!canUndo}
          onClick={onUndo}
        >
          <Undo2 aria-hidden="true" />
        </button>
        <button
          className="canvas-icon-button"
          type="button"
          aria-label="适配画布"
          title="适配画布"
          onClick={onFitView}
        >
          <Maximize2 aria-hidden="true" />
        </button>
        <button
          className="canvas-icon-button"
          type="button"
          aria-label={agentOpen ? '关闭 Agent' : '打开 Agent'}
          title={agentOpen ? '关闭 Agent' : '打开 Agent'}
          aria-pressed={agentOpen}
          onClick={onToggleAgent}
        >
          {agentOpen ? <PanelRightClose aria-hidden="true" /> : <PanelRightOpen aria-hidden="true" />}
        </button>
      </div>
    </header>
  );
}
