export const VIDEO_MODELS = [
  { id: 'runway-gen3', name: 'Runway Gen-3' },
  { id: 'luma-dream', name: 'Luma Dream Machine' },
  { id: 'kling-1.5', name: 'Kling 1.5' },
  { id: 'pika-2', name: 'Pika 2.0' },
  { id: 'sora', name: 'Sora' },
];

export const IMAGE_MODELS = [
  { id: 'imagen-4-fast', name: 'Imagen 4 Fast' },
  { id: 'flux-pro', name: 'FLUX Pro' },
  { id: 'seedream', name: 'Seedream' },
];

export const RATIOS = ['16:9', '9:16', '1:1'];
export const DURATIONS = ['5s', '10s'];
export const VIDEO_MODES = ['文生视频', '首尾帧'];

export const IMAGE_STYLES = [
  { id: 'cinematic', name: '电影感' },
  { id: 'photoreal', name: '写实照片' },
  { id: 'anime', name: '动漫' },
  { id: '3d', name: '3D 渲染' },
  { id: 'watercolor', name: '水彩' },
  { id: 'cyberpunk', name: '赛博朋克' },
  { id: 'none', name: '无风格' },
];

export const QUICK_ACTIONS = [
  { action: 'prompt', label: 'Prompt 生成', hint: '把想法改写成可用的生成提示词' },
  { action: 'brainstorm', label: '头脑风暴', hint: '给出多个创意方向' },
  { action: 'styles', label: '风格变体', hint: '产出 4 种风格变体节点' },
  { action: 'organize', label: '整理节点', hint: '自动排版画布' },
  { action: 'pipeline', label: '生成分镜', hint: '一句话到剧本到多分镜全流程' },
];
