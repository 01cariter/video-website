export type FeedMode = 'all' | 'study' | 'play';
export type VideoCategory = Exclude<FeedMode, 'all'>;
export type FeedFilter =
  | { kind: 'foryou' }
  | { kind: 'following' }
  | { kind: 'category'; category: VideoCategory };
export type MediaKind = 'image' | 'video';

export interface AppUser {
  id: string;
  display_name: string;
  handle: string | null;
  email: string | null;
  avatar_url: string | null;
  avatar_color: string;
  xp: number;
  level: number;
  followers_count: number;
}

export interface VideoAsset {
  media_id: number;
  kind: MediaKind;
  mime: string;
  url: string | null;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  position: number;
}

export interface Video {
  id: number;
  title: string | null;
  description: string | null;
  category: VideoCategory;
  label: string | null;
  size: string;
  duration: string;
  created_at: string;
  likes_count: number;
  saves_count: number;
  comments_count: number;
  views_count: number;
  author_id: string;
  author_handle: string | null;
  author_name: string;
  author_color: string;
  author_avatar: string | null;
  author_bio: string | null;
  collection_id: number | null;
  collection_title: string | null;
  author_followers: number;
  poster_url: string | null;
  poster_w: number | null;
  poster_h: number | null;
  video_url: string | null;
  video_mime: string | null;
  video_w: number | null;
  video_h: number | null;
  /** Ordered carousel items (0–20). Empty for legacy text-only / unloaded. */
  assets: VideoAsset[];
  liked: boolean;
  saved: boolean;
  following: boolean;
}

export interface Collection {
  id: number;
  title: string;
  description: string | null;
  owner_id: string;
  owner_handle: string | null;
  owner_name: string;
  owner_color: string;
  owner_avatar: string | null;
  posts_count: number;
  created_at: string;
}

/** A collection reduced to what an episode switcher draws. */
export interface CollectionEpisode {
  id: number;
  title: string;
  poster_url: string | null;
  duration: string;
  created_at: string;
}

export interface CollectionSummary {
  id: number;
  title: string;
  owner_id: string;
  posts_count: number;
}

export const MAX_COLLECTION_TITLE_LENGTH = 60;
export const MAX_POST_ASSETS = 20;
export const MAX_POST_BODY_LENGTH = 4000;

export interface Profile {
  user_id: string;
  handle: string | null;
  display_name: string;
  bio: string | null;
  avatar_color: string;
  avatar_url: string | null;
  avatar_media_id: number | null;
  xp: number;
  level: number;
  followers_count: number;
  posts_count: number;
  total_likes: number;
  following: boolean;
}

export interface ProfileSummary {
  user_id: string;
  handle: string | null;
  display_name: string;
  bio: string | null;
  avatar_color: string;
  avatar_url: string | null;
  followers_count: number;
  posts_count: number;
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
  author_avatar: string | null;
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
