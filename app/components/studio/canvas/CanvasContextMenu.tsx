'use client';

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
  RectangleHorizontal,
  Trash2,
  Type,
  Video,
  Wand2,
} from 'lucide-react';
import type { StudioNodeKind } from '@/lib/studio/types';
import { isGeneratorNode } from '@/lib/studio/geometry';
import { useStudioCanvas } from './studio-context';
import type { StudioCanvasMenuState } from './useLeaferStudioRuntime';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';

const KIND_LABEL: Record<StudioNodeKind, string> = {
  image: 'Image',
  video: 'Video',
  text: 'Text',
  section: 'Group',
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
  menu: StudioCanvasMenuState | null;
  onClose: () => void;
}) {
  const {
    nodes,
    addNode,
    generateNode,
    removeNode,
    removeNodes,
    duplicateNode,
    duplicateNodes,
    bringToFront,
    sendToBack,
    setTool,
    changeZoom,
    fitView,
  } = useStudioCanvas();

  if (!menu) return null;

  const node =
    menu.type === 'node'
      ? nodes.find((item) => item.id === menu.nodeId)
      : undefined;
  const data = node?.data;
  const generator =
    node && node.type !== 'section' ? isGeneratorNode(node.data) : false;
  const hasSrc = Boolean(data?.src);
  const hasText = Boolean(data?.text);

  return (
    <DropdownMenu
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DropdownMenuTrigger asChild>
        <span
          aria-hidden
          className="pointer-events-none fixed size-px"
          style={{ left: menu.x, top: menu.y }}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="bottom"
        className="min-w-48"
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        {menu.type === 'pane' ? (
          <>
            <DropdownMenuLabel className="text-[11px] font-medium text-muted-foreground">
              Add here
            </DropdownMenuLabel>
            <DropdownMenuItem
              onSelect={() =>
                addNode('image', {
                  position: { x: menu.canvas.x - 150, y: menu.canvas.y - 150 },
                })
              }
            >
              <ImageIcon /> Image generator
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() =>
                addNode('video', {
                  position: { x: menu.canvas.x - 150, y: menu.canvas.y - 84 },
                })
              }
            >
              <Video /> Video generator
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() =>
                addNode('text', {
                  position: { x: menu.canvas.x - 140, y: menu.canvas.y - 88 },
                })
              }
            >
              <FileText /> Text
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() =>
                addNode('section', {
                  position: { x: menu.canvas.x - 240, y: menu.canvas.y - 160 },
                })
              }
            >
              <RectangleHorizontal /> Group
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => fitView()}>
              <Maximize2 /> Fit canvas
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => changeZoom(1)}>
              Zoom to 100%
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setTool('select')}>
              <MousePointer2 /> Select tool
              <DropdownMenuShortcut>V</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setTool('pan')}>
              <Hand /> Pan tool
              <DropdownMenuShortcut>H</DropdownMenuShortcut>
            </DropdownMenuItem>
          </>
        ) : null}

        {menu.type === 'node' && node && data ? (
          <>
            <DropdownMenuLabel className="text-[11px] font-medium text-muted-foreground">
              {data.title || KIND_LABEL[node.type]}
            </DropdownMenuLabel>
            {node.type !== 'section' && data.status !== 'generating' ? (
              <DropdownMenuItem
                onSelect={() => void generateNode(menu.nodeId)}
              >
                <Wand2 /> {generator ? 'Generate' : 'Regenerate'}
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onSelect={() => duplicateNode(menu.nodeId)}>
              <Copy /> Duplicate
            </DropdownMenuItem>
            {node.type === 'text' && hasText ? (
              <DropdownMenuItem
                onSelect={() => {
                  void navigator.clipboard.writeText(String(data.text));
                }}
              >
                <Type /> Copy text
              </DropdownMenuItem>
            ) : null}
            {hasSrc ? (
              <>
                <DropdownMenuItem
                  onSelect={() =>
                    window.open(String(data.src), '_blank', 'noopener')
                  }
                >
                  <ExternalLink /> Open in new tab
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() =>
                    downloadSrc(
                      String(data.src),
                      String(data.title || node.type),
                    )
                  }
                >
                  <Download /> Download
                </DropdownMenuItem>
              </>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => bringToFront(menu.nodeId)}>
              <ArrowUpToLine /> Bring to front
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => sendToBack(menu.nodeId)}>
              <ArrowDownToLine /> Send to back
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => removeNode(menu.nodeId)}
            >
              <Trash2 /> Delete
            </DropdownMenuItem>
          </>
        ) : null}

        {menu.type === 'selection' ? (
          <>
            <DropdownMenuLabel className="text-[11px] font-medium text-muted-foreground">
              {menu.ids.length} selected
            </DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => duplicateNodes(menu.ids)}>
              <Copy /> Duplicate selected
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => removeNodes(menu.ids)}
            >
              <Trash2 /> Delete selected
            </DropdownMenuItem>
          </>
        ) : null}

        {menu.type === 'node' && !node ? (
          <DropdownMenuItem disabled>Node no longer exists</DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
