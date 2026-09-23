-- New keynote storage only. Existing guest/storyboard tables and policies are untouched.
create schema if not exists keynote_private;
revoke all on schema keynote_private from public, anon;
grant usage on schema keynote_private to authenticated;

create table public.keynote_editors (
  project_slug text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (project_slug, user_id)
);
create table public.keynote_decks (
  project_slug text primary key,
  draft jsonb not null,
  draft_version bigint not null default 1 check (draft_version > 0),
  published_revision_id uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
create table public.keynote_revisions (
  id uuid primary key default gen_random_uuid(),
  project_slug text not null references public.keynote_decks(project_slug),
  document jsonb not null,
  published_at timestamptz not null default now(),
  published_by uuid references auth.users(id) on delete set null,
  unique(project_slug, id)
);
alter table public.keynote_decks add constraint keynote_published_revision_fk
  foreign key(project_slug, published_revision_id) references public.keynote_revisions(project_slug, id);
create index keynote_revision_history on public.keynote_revisions(project_slug, published_at desc);
create index keynote_editor_user on public.keynote_editors(user_id);
alter table public.keynote_editors enable row level security;
alter table public.keynote_decks enable row level security;
alter table public.keynote_revisions enable row level security;
revoke all on public.keynote_editors, public.keynote_decks, public.keynote_revisions from anon, authenticated;
grant select on public.keynote_editors, public.keynote_decks, public.keynote_revisions to authenticated;
grant all on public.keynote_editors, public.keynote_decks, public.keynote_revisions to service_role;
create policy keynote_own_membership on public.keynote_editors for select to authenticated
  using (user_id = (select auth.uid()) and coalesce((select auth.jwt()->>'is_anonymous'), 'false') = 'false');
create policy keynote_editor_draft on public.keynote_decks for select to authenticated
  using (exists(select 1 from public.keynote_editors e where e.project_slug = keynote_decks.project_slug and e.user_id = (select auth.uid())));
create policy keynote_editor_revisions on public.keynote_revisions for select to authenticated
  using (exists(select 1 from public.keynote_editors e where e.project_slug = keynote_revisions.project_slug and e.user_id = (select auth.uid())));

create function keynote_private.only_keys(v jsonb, allowed text[]) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(v) = 'object' and not exists(select 1 from jsonb_object_keys(v) k where not (k = any(allowed)));
$$;
-- Keep this validator aligned with src/lib/keynote/model.ts. No arbitrary HTML, URLs or marks.
create function keynote_private.validate_document(d jsonb, publishing boolean) returns void
language plpgsql set search_path = '' as $$
declare s jsonb; p jsonb; n jsonb; m jsonb; ids text[] := '{}';
begin
  if d is null or octet_length(d::text) > 600000 or not keynote_private.only_keys(d, array['schemaVersion','intro','slides','startSlideId'])
    or d->'schemaVersion' is distinct from '1'::jsonb
    or d->'intro' is distinct from '{"type":"title","durationMs":2000}'::jsonb
    or jsonb_typeof(d->'slides') is distinct from 'array'
    or jsonb_typeof(d->'startSlideId') is distinct from 'string' or length(d->>'startSlideId') > 100
  then raise exception 'Invalid deck' using errcode = '22023'; end if;
  if jsonb_array_length(d->'slides') > 60 then raise exception 'Too many slides' using errcode = '22023'; end if;
  for s in select value from jsonb_array_elements(d->'slides') loop
    if jsonb_typeof(s->'id') is distinct from 'string' or (s->>'id') !~ '^[a-zA-Z0-9_-]{1,100}$' or s->>'id' = any(ids)
      or jsonb_typeof(s->'name') is distinct from 'string' or length(btrim(s->>'name')) = 0 or length(s->>'name') > 120
    then raise exception 'Invalid slide identity' using errcode = '22023'; end if;
    ids := array_append(ids, s->>'id');
    if s->>'type' = 'title' and keynote_private.only_keys(s, array['id','name','type']) then continue; end if;
    if s->>'type' = 'video' and s->>'source' = 'moodfilm' and keynote_private.only_keys(s, array['id','name','type','source']) then continue; end if;
    if s->>'type' is distinct from 'text' or not keynote_private.only_keys(s, array['id','name','type','layout','density','heading','body'])
      or coalesce(s->>'layout','') not in ('short','headed')
      or (s ? 'density' and coalesce(s->>'density','') not in ('short','long'))
      or (s ? 'heading' and (jsonb_typeof(s->'heading') <> 'string' or length(s->>'heading') > 300))
      or not keynote_private.only_keys(s->'body', array['type','content'])
      or s->'body'->>'type' is distinct from 'doc' or jsonb_typeof(s->'body'->'content') is distinct from 'array'
    then raise exception 'Invalid slide content' using errcode = '22023'; end if;
    if jsonb_array_length(s->'body'->'content') not between 1 and 100 then raise exception 'Invalid paragraphs' using errcode = '22023'; end if;
    for p in select value from jsonb_array_elements(s->'body'->'content') loop
      if not keynote_private.only_keys(p,array['type','content']) or p->>'type' is distinct from 'paragraph'
        or (p ? 'content' and jsonb_typeof(p->'content') <> 'array') then raise exception 'Invalid paragraph' using errcode = '22023'; end if;
      if not (p ? 'content') then continue; end if;
      if jsonb_array_length(p->'content') > 2000 then raise exception 'Too many nodes' using errcode = '22023'; end if;
      for n in select value from jsonb_array_elements(p->'content') loop
        if n = '{"type":"hardBreak"}'::jsonb then continue; end if;
        if not keynote_private.only_keys(n,array['type','text','marks']) or n->>'type' is distinct from 'text'
          or jsonb_typeof(n->'text') is distinct from 'string' or length(n->>'text') not between 1 and 20000
          or (n ? 'marks' and jsonb_typeof(n->'marks') <> 'array') then raise exception 'Invalid text node' using errcode = '22023'; end if;
        if n ? 'marks' then
          if jsonb_array_length(n->'marks') > 1 then raise exception 'Invalid marks' using errcode = '22023'; end if;
          for m in select value from jsonb_array_elements(n->'marks') loop
            if m is distinct from '{"type":"emphasis"}'::jsonb then raise exception 'Invalid mark' using errcode = '22023'; end if;
          end loop;
        end if;
      end loop;
    end loop;
  end loop;
  if publishing and (cardinality(ids) = 0 or not (d->>'startSlideId' = any(ids))) then raise exception 'Choose a start slide' using errcode = '22023'; end if;
end;
$$;

-- Writes are deliberately not granted on tables. These narrow transactional entry points
-- need definer rights to perform writes, after checking a live membership and Auth user.
create function keynote_private.require_editor(project text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or coalesce(auth.jwt()->>'is_anonymous','false') <> 'false'
    or not exists(select 1 from public.keynote_editors e join auth.users u on u.id = e.user_id where e.project_slug = project and e.user_id = auth.uid())
  then raise exception 'Editor membership required' using errcode = '42501'; end if;
end;
$$;
create function keynote_private.save(project text, expected_version bigint, document jsonb) returns bigint
language plpgsql security definer set search_path = '' as $$
declare current_version bigint;
begin
  perform keynote_private.require_editor(project);
  perform keynote_private.validate_document(document, false);
  select draft_version into current_version from public.keynote_decks where project_slug = project for update;
  if current_version is null or expected_version is distinct from current_version then raise exception 'Draft conflict' using errcode = '40001'; end if;
  update public.keynote_decks set draft = document, draft_version = draft_version + 1, updated_at = now(), updated_by = auth.uid() where project_slug = project;
  return current_version + 1;
end;
$$;
create function keynote_private.publish(project text, expected_version bigint) returns uuid
language plpgsql security definer set search_path = '' as $$
declare d public.keynote_decks; revision uuid;
begin
  perform keynote_private.require_editor(project);
  select * into d from public.keynote_decks where project_slug = project for update;
  if d.project_slug is null or expected_version is distinct from d.draft_version then raise exception 'Draft conflict' using errcode = '40001'; end if;
  perform keynote_private.validate_document(d.draft, true);
  insert into public.keynote_revisions(project_slug, document, published_by) values(project, d.draft, auth.uid()) returning id into revision;
  update public.keynote_decks set published_revision_id = revision where project_slug = project;
  return revision;
end;
$$;
create function public.keynote_save(project text, expected_version bigint, document jsonb) returns bigint
language sql security invoker set search_path = '' as $$ select keynote_private.save(project, expected_version, document); $$;
create function public.keynote_publish(project text, expected_version bigint) returns uuid
language sql security invoker set search_path = '' as $$ select keynote_private.publish(project, expected_version); $$;
revoke all on all functions in schema keynote_private from public, anon, authenticated;
grant execute on function keynote_private.save(text,bigint,jsonb), keynote_private.publish(text,bigint) to authenticated;
revoke all on function public.keynote_save(text,bigint,jsonb), public.keynote_publish(text,bigint) from public, anon;
grant execute on function public.keynote_save(text,bigint,jsonb), public.keynote_publish(text,bigint) to authenticated;

-- One-time seed. ON CONFLICT never overwrites an editor's draft or published history.
do $seed$
declare inserted_project text; initial_revision uuid;
begin
  insert into public.keynote_decks(project_slug,draft) values('north-of-hell', $document${
  "schemaVersion": 1,
  "intro": {
    "type": "title",
    "durationMs": 2000
  },
  "startSlideId": "logline",
  "slides": [
    {
      "id": "title",
      "name": "Title",
      "type": "title"
    },
    {
      "id": "logline",
      "name": "Logline",
      "type": "text",
      "layout": "short",
      "body": {
        "type": "doc",
        "content": [
          {
            "type": "paragraph",
            "content": [
              {
                "type": "text",
                "text": "Along the arctic coast",
                "marks": [
                  {
                    "type": "emphasis"
                  }
                ]
              },
              {
                "type": "text",
                "text": " of 17th-century Norway,"
              }
            ]
          },
          {
            "type": "paragraph",
            "content": [
              {
                "type": "text",
                "text": "a troubled executioner, escorting a "
              },
              {
                "type": "text",
                "text": "pregnant witch",
                "marks": [
                  {
                    "type": "emphasis"
                  }
                ]
              },
              {
                "type": "text",
                "text": " to a royal outpost,"
              }
            ]
          },
          {
            "type": "paragraph",
            "content": [
              {
                "type": "text",
                "text": "becomes her "
              },
              {
                "type": "text",
                "text": "protector",
                "marks": [
                  {
                    "type": "emphasis"
                  }
                ]
              },
              {
                "type": "text",
                "text": " as desperate villagers hunt them."
              }
            ]
          }
        ]
      }
    },
    {
      "id": "film",
      "name": "Film",
      "type": "video",
      "source": "moodfilm"
    },
    {
      "id": "genre",
      "name": "Genre & Tone",
      "type": "text",
      "layout": "headed",
      "density": "short",
      "heading": "Genre & Tone",
      "body": {
        "type": "doc",
        "content": [
          {
            "type": "paragraph",
            "content": [
              {
                "type": "text",
                "text": "A Fury Road",
                "marks": [
                  {
                    "type": "emphasis"
                  }
                ]
              },
              {
                "type": "text",
                "text": " style chase through the true horrors"
              },
              {
                "type": "hardBreak"
              },
              {
                "type": "text",
                "text": "of one of history's deadliest witch hunts – with the moral weight of "
              },
              {
                "type": "text",
                "text": "Children of Men.",
                "marks": [
                  {
                    "type": "emphasis"
                  }
                ]
              }
            ]
          }
        ]
      }
    },
    {
      "id": "synopsis-1",
      "name": "Synopsis 1",
      "type": "text",
      "layout": "headed",
      "density": "long",
      "heading": "Synopsis",
      "body": {
        "type": "doc",
        "content": [
          {
            "type": "paragraph",
            "content": [
              {
                "type": "text",
                "text": "In 1662, "
              },
              {
                "type": "text",
                "text": "a series of deadly storms ravages Arctic Finnmark",
                "marks": [
                  {
                    "type": "emphasis"
                  }
                ]
              },
              {
                "type": "text",
                "text": ", plunging its fishing villages into famine. Denmark-Norway’s King Christian IV blames "
              },
              {
                "type": "text",
                "text": "the local storm witches",
                "marks": [
                  {
                    "type": "emphasis"
                  }
                ]
              },
              {
                "type": "text",
                "text": " and sends expeditions to the northern edge of his kingdom to find the guilty and "
              },
              {
                "type": "text",
                "text": "burn them.",
                "marks": [
                  {
                    "type": "emphasis"
                  }
                ]
              },
              {
                "type": "text",
                "text": " Over 100 die out of a population of 3,000, one of history's most intense witch hunts per capita."
              }
            ]
          },
          {
            "type": "paragraph",
            "content": [
              {
                "type": "text",
                "text": "Days before the last safe sailing date of the season, the expedition reaches a village hollowed out by hunger. "
              },
              {
                "type": "text",
                "text": "Three Sami sisters",
                "marks": [
                  {
                    "type": "emphasis"
                  }
                ]
              },
              {
                "type": "text",
                "text": " are accused of causing the storms. Thrown bound into freezing water to prove their "
              },
              {
                "type": "text",
                "text": "pact with the devil",
                "marks": [
                  {
                    "type": "emphasis"
                  }
                ]
              },
              {
                "type": "text",
                "text": ", the eldest, Siri, floats and is revealed to be eight months pregnant. By law, her execution must wait for the birth, so Thor, the expedition's "
              },
              {
                "type": "text",
                "text": "Danish headsman",
                "marks": [
                  {
                    "type": "emphasis"
                  }
                ]
              },
              {
                "type": "text",
                "text": ", is ordered to escort her north to a Royal fort. Three years earlier, Thor broke into a mill to feed his starving, pregnant wife. A man died in the raid, and Thor was sentenced to hang for it, spared only by agreeing to become the crown's executioner in the North."
              },
              {
                "type": "hardBreak"
              },
              {
                "type": "text",
                "text": "This escort is his ticket to freedom.",
                "marks": [
                  {
                    "type": "emphasis"
                  }
                ]
              }
            ]
          },
          {
            "type": "paragraph",
            "content": [
              {
                "type": "text",
                "text": "The journey turns violent",
                "marks": [
                  {
                    "type": "emphasis"
                  }
                ]
              },
              {
                "type": "text",
                "text": " almost immediately: their local escort, Peder, "
              },
              {
                "type": "text",
                "text": "tries to kill Siri and drown Thor at sea.",
                "marks": [
                  {
                    "type": "emphasis"
                  }
                ]
              },
              {
                "type": "text",
                "text": " Stranded and alone, Thor and Siri are "
              },
              {
                "type": "text",
                "text": "forced inland on foot",
                "marks": [
                  {
                    "type": "emphasis"
                  }
                ]
              },
              {
                "type": "text",
                "text": ", surviving a punishing landscape with help from a "
              },
              {
                "type": "text",
                "text": "Sami hunter.",
                "marks": [
                  {
                    "type": "emphasis"
                  }
                ]
              },
              {
                "type": "text",
                "text": " When Siri goes into "
              },
              {
                "type": "text",
                "text": "early labor",
                "marks": [
                  {
                    "type": "emphasis"
                  }
                ]
              },
              {
                "type": "text",
                "text": ", their small group is scattered by a search party. Thor watches Peder's men capture and beat the hunter, and is forced into an uneasy bargain with a half-drowned prisoner, Jacob, trading his help carrying the badly injured Siri for his freedom."
              }
            ]
          }
        ]
      }
    },
    {
      "id": "synopsis-2",
      "name": "Synopsis 2",
      "type": "text",
      "layout": "headed",
      "density": "long",
      "heading": "Synopsis",
      "body": {
        "type": "doc",
        "content": [
          {
            "type": "paragraph",
            "content": [
              {
                "type": "text",
                "text": "Shelter finds them in the flipped wreck of a ship, inhabited by "
              },
              {
                "type": "text",
                "text": "Russian castaways who turn on them in the night.",
                "marks": [
                  {
                    "type": "emphasis"
                  }
                ]
              },
              {
                "type": "text",
                "text": " Thor, Siri, and Jacob escape as the ship burns around its trapped inhabitants. Rebuilding a small boat from the wreckage, they're run down at sea and dragged to a village where Siri is imprisoned to be "
              },
              {
                "type": "text",
                "text": "forced into early labor.",
                "marks": [
                  {
                    "type": "emphasis"
                  }
                ]
              },
              {
                "type": "text",
                "text": " Thor burns the village's food stores and "
              },
              {
                "type": "text",
                "text": "injures Peder to free her",
                "marks": [
                  {
                    "type": "emphasis"
                  }
                ]
              },
              {
                "type": "text",
                "text": ", and the three flee by boat through a narrow archipelago as the entire village gives chase."
              }
            ]
          },
          {
            "type": "paragraph",
            "content": [
              {
                "type": "text",
                "text": "In a wild chase",
                "marks": [
                  {
                    "type": "emphasis"
                  }
                ]
              },
              {
                "type": "text",
                "text": ", Siri is speared through the lung and Jacob is lost overboard. Alone with Thor on a sinking boat in open water, Siri unleashes "
              },
              {
                "type": "text",
                "text": "a massive storm",
                "marks": [
                  {
                    "type": "emphasis"
                  }
                ]
              },
              {
                "type": "text",
                "text": " she'd secretly prepared for, "
              },
              {
                "type": "text",
                "text": "drowning their pursuers as she gives birth.",
                "marks": [
                  {
                    "type": "emphasis"
                  }
                ]
              },
              {
                "type": "text",
                "text": " She dies in the storm's final surge, and it dies with her. Thor swims her newborn to shore."
              }
            ]
          },
          {
            "type": "paragraph",
            "content": [
              {
                "type": "text",
                "text": "At dawn",
                "marks": [
                  {
                    "type": "emphasis"
                  }
                ]
              },
              {
                "type": "text",
                "text": ", walking the coastline with the child, Thor looks up to see the Royal fort emerging from the fog, and "
              },
              {
                "type": "text",
                "text": "has to decide what happens next.",
                "marks": [
                  {
                    "type": "emphasis"
                  }
                ]
              }
            ]
          }
        ]
      }
    }
  ]
}
$document$::jsonb) on conflict(project_slug) do nothing returning project_slug into inserted_project;
  if inserted_project is not null then
    insert into public.keynote_revisions(project_slug,document) select project_slug,draft from public.keynote_decks where project_slug = inserted_project returning id into initial_revision;
    update public.keynote_decks set published_revision_id = initial_revision where project_slug = inserted_project;
  end if;
end;
$seed$;
