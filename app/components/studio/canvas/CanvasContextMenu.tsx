'use client';

import { useReactFlow, useStore } from '@xyflow/react';
import {
  ArrowDownToLine,
  ArrowUpToLine,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Hand,
  ImageIcon,
  Maximize2,
  MousePointer2,
  Trash2,
  Type,
  Video,
  Wand2,
} from 'lucide-react';
import type { StudioNodeData, StudioNodeKind } from '@/lib/studio/types';
import { isGeneratorNode } from '@/lib/studio/geometry';
import { useStudioCanvas } from './studio-context';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';

export type CanvasMenuState =
  | { type: 'pane'; x: number; y: number; flow: { x: number; y: number } }
  | { type: 'node'; x: number; y: number; nodeId: string }
  | { type: 'edge'; x: number; y: number; edgeId: string }
  | { type: 'selection'; x: number; y: number; ids: string[] };

const KIND_LABEL: Record<StudioNodeKind, string> = {
  image: '图片',
  video: '视频',
  text: '文本',
};

function downloadSrc(src: string, title: string) {
  const link = document.createElement('a');
  link.href = src;
  link.download = title || 'studio-asset';
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
}

export default function CanvasContextMenu({
  menu,
  onClose,
}: {
  menu: CanvasMenuState | null;
  onClose: () => void;
}) {
  const {
    addNode,
    generateNode,
    removeNode,
    removeNodes,
    duplicateNode,
    duplicateNodes,
    removeEdge,
    bringToFront,
    sendToBack,
    setTool,
  } = useStudioCanvas();
  const { fitView, zoomTo } = useReactFlow();
  const nodeLookup = useStore((state) => state.nodeLookup);

  if (!menu) return null;

  const node = menu.type === 'node' ? nodeLookup.get(menu.nodeId) : undefined;
  const data = node?.data as StudioNodeData | undefined;
  const kind = (node?.type || data?.kind) as StudioNodeKind | undefined;
  const generator = data ? isGeneratorNode(data) : false;
  const hasSrc = Boolean(data?.src);
  const hasText = Boolean(data?.text);

  return (
    <DropdownMenu open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DropdownMenuTrigger asChild>
        <span aria-hidden className="pointer-events-none fixed size-px" style={{ left: menu.x, top: menu.y }} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="bottom" className="min-w-48" onCloseAutoFocus={(event) => event.preventDefault()}>
        {menu.type === 'pane' ? (
          <>
            <DropdownMenuLabel className="text-[11px] font-medium text-muted-foreground">在此添加</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => addNode('image', { position: { x: menu.flow.x - 140, y: menu.flow.y - 120 } })}>
              <ImageIcon /> 图片生成器
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => addNode('video', { position: { x: menu.flow.x - 140, y: menu.flow.y - 120 } })}>
              <Video /> 视频生成器
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => addNode('text', { position: { x: menu.flow.x - 140, y: menu.flow.y - 120 } })}>
              <FileText /> 文本
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void fitView({ padding: 0.18, duration: 180 })}>
              <Maximize2 /> 适应画布
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void zoomTo(1, { duration: 160 })}>
              缩放到 100%
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setTool('select')}>
              <MousePointer2 /> 选择工具
              <DropdownMenuShortcut>V</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setTool('pan')}>
              <Hand /> 平移工具
              <DropdownMenuShortcut>H</DropdownMenuShortcut>
            </DropdownMenuItem>
          </>
        ) : null}

        {menu.type === 'node' && data && kind ? (
          <>
            <DropdownMenuLabel className="text-[11px] font-medium text-muted-foreground">
              {data.title || KIND_LABEL[kind]}
            </DropdownMenuLabel>
            {data.status !== 'generating' ? (
              <DropdownMenuItem onSelect={() => void generateNode(menu.nodeId)}>
                <Wand2 /> {generator ? '生成' : '重新生成'}
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onSelect={() => duplicateNode(menu.nodeId)}>
              <Copy /> 复制
            </DropdownMenuItem>
            {kind === 'text' && hasText ? (
              <DropdownMenuItem
                onSelect={() => {
                  void navigator.clipboard.writeText(String(data.text));
                }}
              >
                <Type /> 复制文本
              </DropdownMenuItem>
            ) : null}
            {hasSrc ? (
              <>
                <DropdownMenuItem onSelect={() => window.open(String(data.src), '_blank', 'noopener')}>
                  <ExternalLink /> 在新标签打开
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => downloadSrc(String(data.src), String(data.title || kind))}>
                  <Download /> 下载
                </DropdownMenuItem>
              </>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => bringToFront(menu.nodeId)}>
              <ArrowUpToLine /> 置于顶层
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => sendToBack(menu.nodeId)}>
              <ArrowDownToLine /> 置于底层
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => removeNode(menu.nodeId)}>
              <Trash2 /> 删除
            </DropdownMenuItem>
          </>
        ) : null}

        {menu.type === 'edge' ? (
          <>
            <DropdownMenuLabel className="text-[11px] font-medium text-muted-foreground">连线</DropdownMenuLabel>
            <DropdownMenuItem variant="destructive" onSelect={() => removeEdge(menu.edgeId)}>
              <Trash2 /> 删除连线
            </DropdownMenuItem>
          </>
        ) : null}

        {menu.type === 'selection' ? (
          <>
            <DropdownMenuLabel className="text-[11px] font-medium text-muted-foreground">
              已选 {menu.ids.length} 项
            </DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => duplicateNodes(menu.ids)}>
              <Copy /> 复制所选
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => removeNodes(menu.ids)}>
              <Trash2 /> 删除所选
            </DropdownMenuItem>
          </>
        ) : null}

        {menu.type === 'node' && !data ? (
          <DropdownMenuItem disabled>节点已不存在</DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
