-- Drop group-related tables to eliminate infinite recursion completely
-- This will remove group chat functionality but fix message sending

DROP TABLE IF EXISTS public.group_members CASCADE;
DROP TABLE IF EXISTS public.group_chats CASCADE;

-- Remove group_id column from messages table
ALTER TABLE public.messages DROP COLUMN IF EXISTS group_id;
