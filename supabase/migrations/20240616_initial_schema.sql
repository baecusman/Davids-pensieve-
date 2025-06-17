-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table (extends Supabase auth.users)
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  digest_frequency TEXT DEFAULT 'WEEKLY' CHECK (digest_frequency IN ('WEEKLY', 'MONTHLY', 'NEVER')),
  digest_email TEXT,
  timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create content table
CREATE TABLE public.content (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  url TEXT,
  content TEXT NOT NULL,
  source TEXT NOT NULL,
  hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, hash)
);

-- Create analysis table
CREATE TABLE public.analysis (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  content_id UUID REFERENCES public.content(id) ON DELETE CASCADE NOT NULL,
  summary JSONB NOT NULL,
  entities JSONB NOT NULL,
  tags TEXT[] DEFAULT '{}',
  priority TEXT DEFAULT 'READ' CHECK (priority IN ('skim', 'read', 'deep_dive')),
  full_content TEXT,
  confidence DECIMAL DEFAULT 0.8,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create concepts table
CREATE TABLE public.concepts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  frequency INTEGER DEFAULT 1,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, name, type)
);

-- Create relationships table
CREATE TABLE public.relationships (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  from_concept_id UUID REFERENCES public.concepts(id) ON DELETE CASCADE NOT NULL,
  to_concept_id UUID REFERENCES public.concepts(id) ON DELETE CASCADE NOT NULL,
  content_id UUID REFERENCES public.content(id) ON DELETE CASCADE NOT NULL,
  type TEXT DEFAULT 'RELATES_TO',
  strength DECIMAL DEFAULT 0.5,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, from_concept_id, to_concept_id, content_id)
);

-- Create feeds table
CREATE TABLE public.feeds (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  type TEXT DEFAULT 'RSS' CHECK (type IN ('RSS', 'PODCAST', 'TWITTER', 'MANUAL')),
  is_active BOOLEAN DEFAULT true,
  last_fetched TIMESTAMP WITH TIME ZONE,
  etag TEXT,
  last_modified TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, url)
);

-- Create digests table
CREATE TABLE public.digests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('WEEKLY', 'MONTHLY', 'QUARTERLY')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  content_ids UUID[] DEFAULT '{}',
  status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SCHEDULED', 'SENT', 'FAILED')),
  scheduled_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_content_user_created ON public.content(user_id, created_at DESC);
CREATE INDEX idx_content_user_source ON public.content(user_id, source);
CREATE INDEX idx_analysis_user_priority ON public.analysis(user_id, priority);
CREATE INDEX idx_analysis_content ON public.analysis(content_id);
CREATE INDEX idx_concepts_user_frequency ON public.concepts(user_id, frequency DESC);
CREATE INDEX idx_relationships_from_concept ON public.relationships(from_concept_id);
CREATE INDEX idx_relationships_to_concept ON public.relationships(to_concept_id);
CREATE INDEX idx_feeds_user_active ON public.feeds(user_id, is_active);
CREATE INDEX idx_digests_user_type_status ON public.digests(user_id, type, status);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.digests ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can only see their own data
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view own content" ON public.content FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own content" ON public.content FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own content" ON public.content FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own content" ON public.content FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own analysis" ON public.analysis FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own analysis" ON public.analysis FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own analysis" ON public.analysis FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own analysis" ON public.analysis FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own concepts" ON public.concepts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own concepts" ON public.concepts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own concepts" ON public.concepts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own concepts" ON public.concepts FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own relationships" ON public.relationships FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own relationships" ON public.relationships FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own relationships" ON public.relationships FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own relationships" ON public.relationships FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own feeds" ON public.feeds FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own feeds" ON public.feeds FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own feeds" ON public.feeds FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own feeds" ON public.feeds FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own digests" ON public.digests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own digests" ON public.digests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own digests" ON public.digests FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own digests" ON public.digests FOR DELETE USING (auth.uid() = user_id);

-- Function to handle user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_content_updated_at BEFORE UPDATE ON public.content FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_concepts_updated_at BEFORE UPDATE ON public.concepts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_feeds_updated_at BEFORE UPDATE ON public.feeds FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
