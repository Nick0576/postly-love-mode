-- Add music clip columns to profiles table
ALTER TABLE profiles 
ADD COLUMN chat_bubble_music_clip_start INTEGER DEFAULT NULL,
ADD COLUMN chat_bubble_music_clip_end INTEGER DEFAULT NULL;

-- Create a function to update the columns when music is set
CREATE OR REPLACE FUNCTION update_music_clip_columns()
RETURNS TRIGGER AS $$
BEGIN
  -- If music video ID is being set, ensure clip columns exist
  IF NEW.chat_bubble_music_video_id IS NOT NULL THEN
    -- Default clip: first 30 seconds if no clip is set
    IF NEW.chat_bubble_music_clip_start IS NULL THEN
      NEW.chat_bubble_music_clip_start := 0;
    END IF;
    IF NEW.chat_bubble_music_clip_end IS NULL THEN
      NEW.chat_bubble_music_clip_end := 30;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for profiles table
CREATE TRIGGER set_default_music_clip
BEFORE INSERT OR UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION update_music_clip_columns();