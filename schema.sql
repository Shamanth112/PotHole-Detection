-- Schema for Pothole Detection App (Supabase/PostgreSQL)

-- 1. Users table (Extends Supabase Auth)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'citizen' CHECK (role IN ('citizen', 'municipal', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Storage configuration (Run this in the SQL Editor)
-- Create the bucket if it doesn't exist (Supabase doesn't have a direct SQL command for this, 
-- but you can set up policies for it)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('pothole-images', 'pothole-images', true);

-- Storage Policies for 'pothole-images' bucket
CREATE POLICY "Public Access" ON storage.objects
  FOR SELECT USING (bucket_id = 'pothole-images');

CREATE POLICY "Authenticated Upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'pothole-images' AND 
    auth.role() = 'authenticated'
  );

CREATE POLICY "Authenticated Update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'pothole-images' AND 
    auth.role() = 'authenticated'
  );

-- 2. Permitted Users (Whitelist for roles)
CREATE TABLE IF NOT EXISTS public.permitted_users (
  email TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('municipal', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Potholes table
CREATE TABLE IF NOT EXISTS public.potholes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  address TEXT,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  status TEXT DEFAULT 'reported' CHECK (status IN ('reported', 'in-progress', 'resolved', 'dismissed')),
  report_image_url TEXT,
  resolved_image_url TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permitted_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.potholes ENABLE ROW LEVEL SECURITY;

-- Policies for 'users' table
CREATE POLICY "Users can view their own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Policies for 'potholes' table
CREATE POLICY "Anyone can view potholes" ON public.potholes
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can report potholes" ON public.potholes
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Municipal and Admin users can update potholes" ON public.potholes
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('municipal', 'admin')
    )
  );

-- Policies for 'permitted_users' table
CREATE POLICY "Admin users can manage permitted users" ON public.permitted_users
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
