-- Raise the community post limit from the old database check constraint.
-- Run this once in the Supabase SQL Editor.

alter table if exists public.posts
    drop constraint if exists posts_content_check;

alter table if exists public.posts
    add constraint posts_content_check
    check (char_length(content) <= 20000);
