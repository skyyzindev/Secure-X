-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  company TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Create applications table
CREATE TABLE public.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  url TEXT,
  file_path TEXT,
  technology_stack TEXT[],
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'scanning', 'completed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on applications
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

-- Applications policies
CREATE POLICY "Users can view their own applications"
  ON public.applications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own applications"
  ON public.applications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own applications"
  ON public.applications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own applications"
  ON public.applications FOR DELETE
  USING (auth.uid() = user_id);

-- Create security_scans table
CREATE TABLE public.security_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  scan_type TEXT NOT NULL DEFAULT 'full' CHECK (scan_type IN ('full', 'quick', 'custom')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  overall_score INTEGER CHECK (overall_score >= 0 AND overall_score <= 100),
  risk_level TEXT CHECK (risk_level IN ('critical', 'high', 'medium', 'low', 'secure')),
  vulnerabilities_found INTEGER DEFAULT 0,
  scan_duration INTEGER,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on security_scans
ALTER TABLE public.security_scans ENABLE ROW LEVEL SECURITY;

-- Security scans policies
CREATE POLICY "Users can view scans of their applications"
  ON public.security_scans FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.applications
      WHERE applications.id = security_scans.application_id
      AND applications.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create scans for their applications"
  ON public.security_scans FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.applications
      WHERE applications.id = application_id
      AND applications.user_id = auth.uid()
    )
  );

-- Create vulnerabilities table
CREATE TABLE public.vulnerabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID NOT NULL REFERENCES public.security_scans(id) ON DELETE CASCADE,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  affected_component TEXT,
  cve_id TEXT,
  cvss_score DECIMAL(3,1),
  recommendation TEXT NOT NULL,
  code_snippet TEXT,
  line_number INTEGER,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'fixed', 'false_positive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on vulnerabilities
ALTER TABLE public.vulnerabilities ENABLE ROW LEVEL SECURITY;

-- Vulnerabilities policies
CREATE POLICY "Users can view vulnerabilities of their scans"
  ON public.vulnerabilities FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.security_scans
      JOIN public.applications ON applications.id = security_scans.application_id
      WHERE security_scans.id = vulnerabilities.scan_id
      AND applications.user_id = auth.uid()
    )
  );

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_applications_updated_at
  BEFORE UPDATE ON public.applications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();