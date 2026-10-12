-- Video files are uploaded with short-lived signed upload tokens issued by
-- the authenticated storyboard API. Readers use public object URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('storyboard-videos', 'storyboard-videos', true, 52428800,
        array['video/mp4','video/webm'])
on conflict (id) do nothing;
