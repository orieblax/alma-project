-- ==============================================================================
-- Alma Project - Supabase PostgreSQL & pgvector Setup Script
-- ==============================================================================

-- 1. Enable pgvector extension for high-dimensional vector similarity
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Verify or create table 'todos' for SSR diagnostic and quickstart testing
CREATE TABLE IF NOT EXISTS public.todos (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    is_complete BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Enable Row Level Security (RLS) on todos and allow public select
ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'todos' AND policyname = 'allow_anon_select'
    ) THEN
        CREATE POLICY allow_anon_select ON public.todos
            FOR SELECT TO anon, authenticated USING (true);
    END IF;
END $$;

-- 4. Seed initial diagnostic verification row if empty
INSERT INTO public.todos (title, is_complete)
SELECT 'Verificar conexión Supabase pgvector', true
WHERE NOT EXISTS (SELECT 1 FROM public.todos);

-- 5. Grant permissions to anon and authenticated roles
GRANT ALL ON public.todos TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE todos_id_seq TO anon, authenticated, service_role;

-- 6. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
