ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS chat_bubble_music_video_id text,
  ADD COLUMN IF NOT EXISTS chat_bubble_music_title text;