export interface MediaMapItem {
  id: string;
  thumbnail_url: string;
  lat: number;
  lon: number;
  heading: number;
  captured_at: string;
  story_id: string | null;
}

export interface SpatialSample {
  t_ms: number;
  lat: number;
  lon: number;
  altitude?: number;
  heading?: number;
  pitch?: number;
  roll?: number;
  yaw?: number;
  speed?: number;
  horizontal_accuracy?: number;
}

export interface UserMedia {
  id: string;
  user_token?: string | null;
  username?: string | null;
  file_url: string;
  thumbnail_url: string;
  lat: number;
  lon: number;
  altitude: number;
  captured_at: string;
  heading: number;
  pitch?: number | null;
  roll?: number | null;
  yaw?: number | null;
  location?: string | null;
  description?: string | null;
  hash: string;
  upvotes: number;
  downvotes: number;
  view_count: number;
  is_mock?: boolean;
  samples?: SpatialSample[];
}

export interface Story {
  id: string;
  title: string;
  summary: string;
  category: string;
  location: string | null;
  event_lat: number | null;
  event_lon: number | null;
  event_time: string | null;
  importance_score: number;
  article_count: number;
  media_count: number;
  source_icons?: string[];
}
