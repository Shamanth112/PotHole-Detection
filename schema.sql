-- Schema for Pothole Detection App (Supabase/PostgreSQL)

-- 1. Users table (Extends Supabase Auth)
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
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
  user_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  address TEXT,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  status TEXT DEFAULT 'reported' CHECK (status IN ('reported', 'verified', 'fixing', 'in-progress', 'resolved', 'dismissed')),
  report_image_url TEXT,
  resolved_image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permitted_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.potholes ENABLE ROW LEVEL SECURITY;

-- Policies for 'users' table
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid()::text 
    AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_municipal_or_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid()::text 
    AND role IN ('municipal', 'admin')
  );
$$ LANGUAGE sql SECURITY DEFINER;

CREATE POLICY "Users can view their own profile" ON public.users
  FOR SELECT USING (auth.uid()::text = id);

CREATE POLICY "Users can update their own profile" ON public.users
  FOR UPDATE USING (auth.uid()::text = id);

CREATE POLICY "Admins can view all profiles" ON public.users
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can update all profiles" ON public.users
  FOR UPDATE USING (public.is_admin());

-- Policies for 'potholes' table
CREATE POLICY "Anyone can view potholes" ON public.potholes
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can report potholes" ON public.potholes
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Municipal and Admin users can update potholes" ON public.potholes
  FOR UPDATE USING (public.is_municipal_or_admin());

-- Policies for 'permitted_users' table
CREATE POLICY "Admin users can manage permitted users" ON public.permitted_users
  FOR ALL USING (public.is_admin());
