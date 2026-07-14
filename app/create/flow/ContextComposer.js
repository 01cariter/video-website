'use client';

import {
  ArrowUp,
  Image as ImageIcon,
  Link2,
  LoaderCircle,
  Video,
} from 'lucide-react';

import {
  DURATIONS,
  IMAGE_MODELS,
  IMAGE_STYLES,
  RATIOS,
  VIDEO_MODELS,
  VIDEO_MODES,
} from './flow-options';

export default function ContextComposer({
  draftPrompt,
  incomingRefs,
  onDraftChange,
  onPatch,
  onSubmit,
  selected,
}) {
  if (!selected) return null;

  const isImage = selected.type === 'image';
  const running = selected.data.status === 'running';
  const KindIcon = isImage ? ImageIcon : Video;

  return (
    <form
      className="context-composer"
      onSubmit={onSubmit}
      aria-label={`${selected.data.title || '节点'}生成设置`}
    >
      <div className="context-composer__identity">
        <KindIcon aria-hidden="true" />
        <span>{selected.data.title || (isImage ? 'Image' : 'Scene')}</span>
      </div>

      {incomingRefs.length ? (
        <div className="context-composer__refs" aria-label="参考节点">
          <Link2 aria-hidden="true" />
          {incomingRefs.map((ref) => (
            <span className="reference-chip" key={ref.id} title={ref.title}>
              {ref.poster ? <img src={ref.poster} alt="" /> : null}
              <span>{ref.title}</span>
            </span>
          ))}
        </div>
      ) : null}

      <textarea
        value={draftPrompt}
        onChange={(event) => onDraftChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) onSubmit(event);
        }}
        placeholder={isImage ? '描述要生成的图片…' : '描述这一镜的画面…'}
        rows={3}
      />

      {selected.data.error ? (
        <p className="context-composer__error" role="alert">
          {selected.data.error}，修改提示词或直接重试。
        </p>
      ) : null}

      <div className="context-composer__footer">
        <div className="context-composer__params">
          {isImage ? (
            <>
              <select
                aria-label="图片风格"
                value={selected.data.style || IMAGE_STYLES[0].id}
                onChange={(event) => onPatch({ style: event.target.value })}
              >
                {IMAGE_STYLES.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <select
                aria-label="图片模型"
                value={selected.data.model || IMAGE_MODELS[0].id}
                onChange={(event) => onPatch({ model: event.target.value })}
              >
                {IMAGE_MODELS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <select
                aria-label="图片比例"
                value={selected.data.ratio || '1:1'}
                onChange={(event) => onPatch({ ratio: event.target.value })}
              >
                {RATIOS.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </>
          ) : (
            <>
              <select
                aria-label="视频模式"
                value={selected.data.mode || VIDEO_MODES[0]}
                onChange={(event) => onPatch({ mode: event.target.value })}
              >
                {VIDEO_MODES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <select
                aria-label="视频模型"
                value={selected.data.model || VIDEO_MODELS[0].id}
                onChange={(event) => onPatch({ model: event.target.value })}
              >
                {VIDEO_MODELS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <select
                aria-label="视频比例"
                value={selected.data.ratio || '16:9'}
                onChange={(event) => onPatch({ ratio: event.target.value })}
              >
                {RATIOS.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <select
                aria-label="视频时长"
                value={selected.data.duration || DURATIONS[0]}
                onChange={(event) => onPatch({ duration: event.target.value })}
              >
                {DURATIONS.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </>
          )}
        </div>

        <button
          className="context-composer__submit"
          type="submit"
          aria-label={running ? '正在生成' : '生成'}
          title={running ? '正在生成' : '生成'}
          disabled={running || !draftPrompt.trim()}
        >
          {running ? <LoaderCircle className="is-spinning" aria-hidden="true" /> : <ArrowUp aria-hidden="true" />}
        </button>
      </div>
    </form>
  );
}
