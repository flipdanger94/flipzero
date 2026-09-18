CREATE TABLE IF NOT EXISTS "wiki_pages" (
 "id" text PRIMARY KEY NOT NULL,
 "space_id" text NOT NULL REFERENCES "spaces"("id") ON DELETE cascade,
 "author_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
 "slug" text NOT NULL,
 "title" text NOT NULL,
 "summary" text,
 "content" text NOT NULL,
 "revision" integer DEFAULT 1 NOT NULL,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "wiki_pages_space_slug_unique" ON "wiki_pages" ("space_id","slug");
CREATE INDEX IF NOT EXISTS "wiki_pages_space_updated_idx" ON "wiki_pages" ("space_id","updated_at");
CREATE TABLE IF NOT EXISTS "wiki_revisions" (
 "id" text PRIMARY KEY NOT NULL,
 "page_id" text NOT NULL REFERENCES "wiki_pages"("id") ON DELETE cascade,
 "editor_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
 "revision" integer NOT NULL,
 "title" text NOT NULL,
 "summary" text,
 "content" text NOT NULL,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "wiki_revisions_page_revision_unique" ON "wiki_revisions" ("page_id","revision");
CREATE INDEX IF NOT EXISTS "wiki_revisions_page_idx" ON "wiki_revisions" ("page_id");
