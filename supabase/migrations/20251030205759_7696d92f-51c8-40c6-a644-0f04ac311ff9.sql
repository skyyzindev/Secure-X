-- Add DELETE policy for security_scans
CREATE POLICY "Users can delete their own scans"
ON security_scans FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM applications
    WHERE applications.id = security_scans.application_id
    AND applications.user_id = auth.uid()
  )
);

-- Add UPDATE and DELETE policies for vulnerabilities
CREATE POLICY "Users can update vulnerability status"
ON vulnerabilities FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM security_scans
    JOIN applications ON applications.id = security_scans.application_id
    WHERE security_scans.id = vulnerabilities.scan_id
    AND applications.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete vulnerabilities"
ON vulnerabilities FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM security_scans
    JOIN applications ON applications.id = security_scans.application_id
    WHERE security_scans.id = vulnerabilities.scan_id
    AND applications.user_id = auth.uid()
  )
);

-- Enhance handle_new_user function with validation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate user ID
  IF NEW.id IS NULL THEN
    RAISE EXCEPTION 'Invalid user ID';
  END IF;
  
  -- Sanitize and validate full_name (max 100 characters, trim whitespace)
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      SUBSTRING(TRIM(NULLIF(NEW.raw_user_meta_data->>'full_name', '')), 1, 100),
      ''
    )
  );
  RETURN NEW;
END;
$$;