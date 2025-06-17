-- Create tables for Pensive app

-- Content table
CREATE TABLE IF NOT EXISTS public.content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT NOT NULL,
  hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create unique constraint on user_id and hash for deduplication
CREATE UNIQUE INDEX IF NOT EXISTS content_user_id_hash_idx ON public.content (user_id, hash);

-- Analysis table
CREATE TABLE IF NOT EXISTS public.analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL REFERENCES public.content(id) ON DELETE CASCADE,
  summary JSONB NOT NULL,
  entities JSONB NOT NULL,
  tags TEXT[] NOT NULL,
  priority TEXT NOT NULL,
  full_content TEXT,
  confidence FLOAT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create index on content_id
CREATE INDEX IF NOT EXISTS analysis_content_id_idx ON public.analysis (content_id);

-- Concepts table
CREATE TABLE IF NOT EXISTS public.concepts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  frequency INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create unique constraint on user_id, name and type
CREATE UNIQUE INDEX IF NOT EXISTS concepts_user_id_name_type_idx ON public.concepts (user_id, name, type);

-- Relationships table
CREATE TABLE IF NOT EXISTS public.relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_concept_id UUID NOT NULL REFERENCES public.concepts(id) ON DELETE CASCADE,
  to_concept_id UUID NOT NULL REFERENCES public.concepts(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  strength FLOAT NOT NULL,
  content_id UUID NOT NULL REFERENCES public.content(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create unique constraint on user_id, from_concept_id, to_concept_id and content_id
CREATE UNIQUE INDEX IF NOT EXISTS relationships_user_from_to_content_idx ON public.relationships (user_id, from_concept_id, to_concept_id, content_id);

-- Feeds table
CREATE TABLE IF NOT EXISTS public.feeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  fetch_interval INTEGER NOT NULL DEFAULT 3600,
  last_fetched TIMESTAMP WITH TIME ZONE,
  last_item_date TIMESTAMP WITH TIME ZONE,
  item_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  etag TEXT,
  last_modified TEXT
);

-- Create unique constraint on user_id and url
CREATE UNIQUE INDEX IF NOT EXISTS feeds_user_id_url_idx ON public.feeds (user_id, url);

-- Digests table
CREATE TABLE IF NOT EXISTS public.digests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  content_ids TEXT[] NOT NULL,
  status TEXT NOT NULL,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Jobs table
CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create index on status and scheduled_at for job processing
CREATE INDEX IF NOT EXISTS jobs_status_scheduled_idx ON public.jobs (status, scheduled_at);

-- User settings table
CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  digest_email TEXT,
  digest_frequency TEXT NOT NULL DEFAULT 'WEEKLY',
  theme TEXT NOT NULL DEFAULT 'light',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create unique constraint on user_id
CREATE UNIQUE INDEX IF NOT EXISTS user_settings_user_id_idx ON public.user_settings (user_id);

-- Set up RLS (Row Level Security)
ALTER TABLE public.content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.digests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can only access their own content"
  ON public.content
  FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can only access their own analysis"
  ON public.analysis
  FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can only access their own concepts"
  ON public.concepts
  FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can only access their own relationships"
  ON public.relationships
  FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can only access their own feeds"
  ON public.feeds
  FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can only access their own digests"
  ON public.digests
  FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can only access their own jobs"
  ON public.jobs
  FOR ALL
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can only access their own settings"
  ON public.user_settings
  FOR ALL
  USING (auth.uid() = user_id);

-- Create functions and triggers
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user settings when a new user signs up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at columns
CREATE TRIGGER update_content_updated_at
  BEFORE UPDATE ON public.content
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

CREATE TRIGGER update_concepts_updated_at
  BEFORE UPDATE ON public.concepts
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

CREATE TRIGGER update_feeds_updated_at
  BEFORE UPDATE ON public.feeds
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
