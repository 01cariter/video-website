export type FeedMode = 'all' | 'study' | 'play';
export type VideoCategory = Exclude<FeedMode, 'all'>;
export type MediaKind = 'image' | 'video';

export interface AppUser {
  id: string;
  display_name: string;
  handle: string | null;
  email: string | null;
  avatar_url: string | null;
  avatar_color: string;
  level: number;
  streak: number;
  followers_count: number;
}

export interface Video {
  id: number;
  title: string;
  description: string | null;
  category: VideoCategory;
  label: string | null;
  size: string;
  duration: string;
  likes_count: number;
  saves_count: number;
  comments_count: number;
  views_count: number;
  author_id: string;
  author_handle: string | null;
  author_name: string;
  author_color: string;
  author_bio: string | null;
  author_followers: number;
  poster_url: string | null;
  poster_w: number | null;
  poster_h: number | null;
  video_url: string | null;
  video_mime: string | null;
  video_w: number | null;
  video_h: number | null;
  liked: boolean;
  saved: boolean;
  following: boolean;
}

export interface Comment {
  id: number;
  body: string;
  created_at: string;
  user_id: string;
  author_name: string;
  author_handle: string | null;
  author_color: string;
}

export interface Media {
  id: number;
  kind: MediaKind;
  mime: string;
  url: string | null;
  data?: Buffer | Uint8Array | string | null;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  created_at?: string;
}

export interface SocialToggle {
  liked?: boolean;
  saved?: boolean;
  following?: boolean;
  likes_count?: number;
  saves_count?: number;
  followers_count?: number;
}

export interface FeedPage {
  videos: Video[];
  nextCursor: string | null;
}
