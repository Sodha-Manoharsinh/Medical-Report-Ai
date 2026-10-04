import { createClient, SupabaseClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Table candidates for flexible schema matching with user's existing Supabase tables
export const TABLE_CANDIDATES: Record<string, string[]> = {
  users: ['users'],
  otp_codes: ['otp_codes', 'otp', 'otpCodes', 'user_otps'],
  sessions: ['sessions', 'user_sessions', 'userSessions'],
  documents: ['documents', 'patient_documents'],
  document_extractions: ['document_extractions', 'extractions', 'documentExtractions'],
  extracted_facts: ['extracted_facts', 'facts', 'extractedFacts'],
  patient_profiles: ['patient_profiles', 'profiles', 'patientProfiles'],
  medical_summaries: ['medical_summaries', 'summaries', 'medicalSummaries'],
  symptom_reports: ['symptom_reports', 'symptoms', 'symptomReports'],
  qa_conversations: ['qa_conversations', 'qa_history', 'qaConversations', 'qaHistory'],
};

// Cache for confirmed working table names
const resolvedTables: Record<string, string> = {};

let supabaseInstance: SupabaseClient | null = null;
let isConfigured = false;
let migrationAttempted = false;

export function getSupabaseCredentials(): { url: string; key: string } | null {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    'https://byorfonxmgmitvwflofx.supabase.co';

  const key =
    process.env.SUPABASE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    'sb_publishable_Zw3Gp1Vojw2GQfWKmUz2Jg_ruFJUoCw';

  if (
    url &&
    key &&
    url.startsWith('http') &&
    key.length > 10 &&
    !url.includes('your_supabase') &&
    !key.includes('your_supabase')
  ) {
    return { url: url.trim(), key: key.trim() };
  }
  return null;
}

export function isSupabaseConfigured(): boolean {
  return isConfigured;
}

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseInstance) return supabaseInstance;

  const creds = getSupabaseCredentials();
  if (!creds) {
    return null;
  }

  try {
    supabaseInstance = createClient(creds.url, creds.key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    isConfigured = true;
    console.log('[Supabase] Initialized client connected to:', creds.url);
    return supabaseInstance;
  } catch (err: any) {
    console.error('[Supabase] Failed to initialize client:', err.message || err);
    return null;
  }
}

/**
 * Resolves the actual working table name for an entity, trying candidates if needed.
 */
export async function resolveTable(
  supabase: SupabaseClient,
  entityKey: keyof typeof TABLE_CANDIDATES
): Promise<string> {
  if (resolvedTables[entityKey]) {
    return resolvedTables[entityKey];
  }

  const candidates = TABLE_CANDIDATES[entityKey] || [entityKey];
  for (const candidate of candidates) {
    try {
      const { error } = await supabase.from(candidate).select('id').limit(1);
      if (
        !error ||
        (error.code !== 'PGRST205' &&
          error.code !== '42P01' &&
          !error.message.includes('does not exist') &&
          !error.message.includes('not find'))
      ) {
        resolvedTables[entityKey] = candidate;
        return candidate;
      }
    } catch {
      // try next
    }
  }

  const fallback = candidates[0];
  resolvedTables[entityKey] = fallback;
  return fallback;
}

/**
 * Safe, idempotent one-time migration from existing JSON file if Supabase tables are empty.
 */
export async function migrateJsonDataToSupabaseIfEmpty(supabase: SupabaseClient): Promise<void> {
  if (migrationAttempted) return;

  try {
    const usersTable = await resolveTable(supabase, 'users');
    const { count, error } = await supabase
      .from(usersTable)
      .select('id', { count: 'exact', head: true });

    if (error) {
      // If table doesn't exist yet, wait until user creates it
      return;
    }

    migrationAttempted = true;

    // If Supabase already has data, do not overwrite or duplicate
    if (count !== null && count > 0) {
      console.log(`[Supabase Migration] Supabase tables already populated (${count} users found). Skipping JSON import.`);
      return;
    }

    if (!fs.existsSync(DB_FILE)) {
      return;
    }

    console.log('[Supabase Migration] Supabase is empty. Performing one-time migration from JSON database...');
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const data = JSON.parse(raw);

    // 1. Users
    if (Array.isArray(data.users) && data.users.length > 0) {
      for (const u of data.users) {
        await supabase.from(usersTable).upsert({
          id: u.id,
          email: u.email,
          phone: u.phone,
          full_name: u.full_name || null,
          created_at: u.created_at || new Date().toISOString(),
          last_login: u.last_login || null,
        });
      }
    }

    // 2. Patient Profiles
    if (Array.isArray(data.patientProfiles) && data.patientProfiles.length > 0) {
      const profilesTable = await resolveTable(supabase, 'patient_profiles');
      for (const p of data.patientProfiles) {
        await supabase.from(profilesTable).upsert({
          id: p.id,
          user_id: p.user_id,
          full_name: p.full_name || null,
          age: p.age || null,
          date_of_birth: p.date_of_birth || null,
          gender: p.gender || null,
          blood_group: p.blood_group || null,
          abha_id: p.abha_id || null,
          address: p.address || null,
          emergency_contact: p.emergency_contact || null,
          updated_at: p.updated_at || new Date().toISOString(),
        });
      }
    }

    // 3. Documents
    if (Array.isArray(data.documents) && data.documents.length > 0) {
      const docsTable = await resolveTable(supabase, 'documents');
      for (const d of data.documents) {
        await supabase.from(docsTable).upsert({
          id: d.id,
          user_id: d.user_id,
          filename: d.filename,
          original_filename: d.original_filename,
          file_type: d.file_type,
          file_size_bytes: d.file_size_bytes,
          upload_status: d.upload_status || 'extracted',
          uploaded_at: d.uploaded_at || new Date().toISOString(),
          extracted_at: d.extracted_at || null,
        });
      }
    }

    // 4. Extracted Facts
    if (Array.isArray(data.facts) && data.facts.length > 0) {
      const factsTable = await resolveTable(supabase, 'extracted_facts');
      for (let i = 0; i < data.facts.length; i += 50) {
        const chunk = data.facts.slice(i, i + 50).map((f: any) => ({
          id: f.id,
          document_id: f.document_id,
          user_id: f.user_id,
          category: f.category,
          field_name: f.field_name,
          field_value: f.field_value || '',
          unit: f.unit || null,
          reference_range: f.reference_range || null,
          status: f.status || 'found',
          flag: f.flag || null,
          report_date: f.report_date || null,
          source_text: f.source_text || null,
          extracted_at: f.extracted_at || new Date().toISOString(),
        }));
        await supabase.from(factsTable).upsert(chunk);
      }
    }

    // 5. Medical Summaries
    if (Array.isArray(data.summaries) && data.summaries.length > 0) {
      const summariesTable = await resolveTable(supabase, 'medical_summaries');
      for (const s of data.summaries) {
        await supabase.from(summariesTable).upsert({
          id: s.id,
          user_id: s.user_id,
          title: s.title || 'Medical Summary Report',
          summary_type: s.summary_type || 'comprehensive',
          content: s.content,
          generated_at: s.generated_at || new Date().toISOString(),
          document_ids: s.document_ids || [],
        });
      }
    }

    // 6. Symptom Reports
    if (Array.isArray(data.symptomReports) && data.symptomReports.length > 0) {
      const symptomTable = await resolveTable(supabase, 'symptom_reports');
      for (const sr of data.symptomReports) {
        await supabase.from(symptomTable).upsert({
          id: sr.id,
          user_id: sr.user_id,
          primary_symptom: sr.primary_symptom,
          duration: sr.duration,
          severity: sr.severity,
          associated_symptoms: sr.associated_symptoms || [],
          notes: sr.notes || '',
          assessment: sr.assessment || {},
          created_at: sr.created_at || new Date().toISOString(),
        });
      }
    }

    // 7. QA Conversations
    if (Array.isArray(data.qaConversations) && data.qaConversations.length > 0) {
      const qaTable = await resolveTable(supabase, 'qa_conversations');
      for (const q of data.qaConversations) {
        await supabase.from(qaTable).upsert({
          id: q.id,
          user_id: q.user_id,
          question: q.question,
          answer: q.answer,
          created_at: q.created_at || new Date().toISOString(),
        });
      }
    }

    // 8. Sessions
    if (Array.isArray(data.sessions) && data.sessions.length > 0) {
      const sessionsTable = await resolveTable(supabase, 'sessions');
      for (const s of data.sessions) {
        await supabase.from(sessionsTable).upsert({
          id: s.id,
          user_id: s.user_id,
          token: s.token,
          expires_at: s.expires_at,
          created_at: s.created_at || new Date().toISOString(),
        });
      }
    }

    // 9. OTP Codes
    if (Array.isArray(data.otpCodes) && data.otpCodes.length > 0) {
      const otpTable = await resolveTable(supabase, 'otp_codes');
      for (const o of data.otpCodes) {
        await supabase.from(otpTable).upsert({
          id: o.id,
          user_id: o.user_id,
          code: o.code,
          expires_at: o.expires_at,
          used: o.used,
          created_at: o.created_at || new Date().toISOString(),
        });
      }
    }

    console.log('[Supabase Migration] ✅ One-time migration completed.');
  } catch (err: any) {
    console.error('[Supabase Migration] Error during migration:', err.message || err);
  }
}
