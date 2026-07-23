export type AbsoluteUrl = `http://${string}` | `https://${string}`;

export type UrlCategory =
  | 'short_video_entertainment'
  | 'social_feed'
  | 'competitive_progression_games'
  | 'deep_work_productivity'
  | 'longform_deep_reading'
  | 'passive_long_video'
  | 'im_social_adjunct'
  | 'hybrid_learning_cognition'
  | 'low_load_utility'
  | 'shopping_reward_social'
  | 'audio_low_visual';