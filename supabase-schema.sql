-- =====================================================================
-- Medical Report AI - Complete Supabase PostgreSQL Schema & Migration
-- =====================================================================
-- Run this complete script in your Supabase SQL Editor:
-- 1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/_
-- 2. Click on "SQL Editor" in the left sidebar
-- 3. Click "New query", paste this entire script, and click "Run" (▶)
-- =====================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. Table: users
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- ---------------------------------------------------------------------
-- 2. Table: patient_profiles
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.patient_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  full_name TEXT,
  age TEXT,
  date_of_birth TEXT,
  gender TEXT,
  blood_group TEXT,
  abha_id TEXT,
  address TEXT,
  emergency_contact TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_patient_profiles_user UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_patient_profiles_user_id ON public.patient_profiles(user_id);

-- ---------------------------------------------------------------------
-- 3. Table: documents
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL DEFAULT 0,
  upload_status TEXT NOT NULL DEFAULT 'processing',
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  extracted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_at ON public.documents(uploaded_at DESC);

-- ---------------------------------------------------------------------
-- 4. Table: document_extractions
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.document_extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  raw_text TEXT NOT NULL,
  extraction_method TEXT NOT NULL DEFAULT 'rule_based',
  extracted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_extractions_document_id ON public.document_extractions(document_id);

-- ---------------------------------------------------------------------
-- 5. Table: extracted_facts
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.extracted_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  field_name TEXT NOT NULL,
  field_value TEXT NOT NULL,
  unit TEXT,
  reference_range TEXT,
  status TEXT DEFAULT 'found',
  flag TEXT,
  report_date TEXT,
  source_text TEXT,
  extracted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_facts_user_id ON public.extracted_facts(user_id);
CREATE INDEX IF NOT EXISTS idx_facts_document_id ON public.extracted_facts(document_id);
CREATE INDEX IF NOT EXISTS idx_facts_category ON public.extracted_facts(category);

-- ---------------------------------------------------------------------
-- 6. Table: medical_summaries
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.medical_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Medical Summary Report',
  summary_type TEXT NOT NULL DEFAULT 'comprehensive',
  content TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  document_ids JSONB DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_summaries_user_id ON public.medical_summaries(user_id);
CREATE INDEX IF NOT EXISTS idx_summaries_generated_at ON public.medical_summaries(generated_at DESC);

-- ---------------------------------------------------------------------
-- 7. Table: symptom_reports
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.symptom_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  primary_symptom TEXT NOT NULL,
  duration TEXT,
  severity INTEGER NOT NULL DEFAULT 5,
  associated_symptoms JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  assessment JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_symptoms_user_id ON public.symptom_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_symptoms_created_at ON public.symptom_reports(created_at DESC);

-- ---------------------------------------------------------------------
-- 8. Table: qa_conversations
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.qa_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qa_user_id ON public.qa_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_qa_created_at ON public.qa_conversations(created_at DESC);

-- ---------------------------------------------------------------------
-- 9. Table: sessions
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON public.sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON public.sessions(user_id);

-- ---------------------------------------------------------------------
-- 10. Table: otp_codes
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_user_code ON public.otp_codes(user_id, code);

-- =====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Ensures anon / authenticated client API keys have full access
-- =====================================================================

DO $$
BEGIN
  -- users
  ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Allow all on users" ON public.users;
  CREATE POLICY "Allow all on users" ON public.users FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

  -- patient_profiles
  ALTER TABLE public.patient_profiles ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Allow all on patient_profiles" ON public.patient_profiles;
  CREATE POLICY "Allow all on patient_profiles" ON public.patient_profiles FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

  -- documents
  ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Allow all on documents" ON public.documents;
  CREATE POLICY "Allow all on documents" ON public.documents FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

  -- document_extractions
  ALTER TABLE public.document_extractions ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Allow all on document_extractions" ON public.document_extractions;
  CREATE POLICY "Allow all on document_extractions" ON public.document_extractions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

  -- extracted_facts
  ALTER TABLE public.extracted_facts ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Allow all on extracted_facts" ON public.extracted_facts;
  CREATE POLICY "Allow all on extracted_facts" ON public.extracted_facts FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

  -- medical_summaries
  ALTER TABLE public.medical_summaries ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Allow all on medical_summaries" ON public.medical_summaries;
  CREATE POLICY "Allow all on medical_summaries" ON public.medical_summaries FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

  -- symptom_reports
  ALTER TABLE public.symptom_reports ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Allow all on symptom_reports" ON public.symptom_reports;
  CREATE POLICY "Allow all on symptom_reports" ON public.symptom_reports FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

  -- qa_conversations
  ALTER TABLE public.qa_conversations ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Allow all on qa_conversations" ON public.qa_conversations;
  CREATE POLICY "Allow all on qa_conversations" ON public.qa_conversations FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

  -- sessions
  ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Allow all on sessions" ON public.sessions;
  CREATE POLICY "Allow all on sessions" ON public.sessions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

  -- otp_codes
  ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Allow all on otp_codes" ON public.otp_codes;
  CREATE POLICY "Allow all on otp_codes" ON public.otp_codes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
END $$;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
