ALTER TABLE public.profiles ADD COLUMN chat_bubble_text text;
ALTER TABLE public.profiles ADD COLUMN chat_bubble_enabled boolean DEFAULT false;
