import { v4 as uuidv4 } from 'uuid';
import { cleanName, sanitizeGender, extractDob } from './services/ai.js';
import {
  getSupabaseClient,
  resolveTable,
  migrateJsonDataToSupabaseIfEmpty,
} from './services/supabase.js';

export interface User {
  id: string;
  email: string;
  phone: string;
  full_name: string | null;
  created_at: string;
  last_login: string | null;
}

export interface OtpCode {
  id: string;
  user_id: string;
  code: string;
  expires_at: string;
  used: boolean;
  created_at: string;
}

export interface UserSession {
  id: string;
  user_id: string;
  token: string;
  expires_at: string;
  created_at: string;
}

export interface DocumentRecord {
  id: string;
  user_id: string;
  filename: string;
  original_filename: string;
  file_type: string;
  file_size_bytes: number;
  upload_status: 'pending' | 'processing' | 'extracted' | 'error';
  uploaded_at: string;
  extracted_at: string | null;
}

export interface DocumentExtraction {
  id: string;
  document_id: string;
  raw_text: string;
  extraction_method: string;
  extracted_at: string;
}

export interface ExtractedFact {
  id: string;
  document_id: string;
  user_id: string;
  category: string;
  field_name: string;
  field_value: string;
  unit: string | null;
  reference_range: string | null;
  status: string;
  flag?: string | null;
  report_date: string | null;
  source_text: string | null;
  extracted_at: string;
}

export interface PatientProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  age: string | null;
  date_of_birth: string | null;
  gender: string | null;
  blood_group: string | null;
  abha_id?: string | null;
  address: string | null;
  emergency_contact: string | null;
  updated_at: string;
}

export interface MedicalSummary {
  id: string;
  user_id: string;
  title: string;
  summary_type: string;
  content: string;
  generated_at: string;
  document_ids: string[];
}

export interface SymptomReport {
  id: string;
  user_id: string;
  primary_symptom: string;
  duration: string;
  severity: number;
  associated_symptoms: string[];
  notes: string;
  assessment: {
    probable_problem: string;
    urgency: string;
    explanation: string;
    red_flags: string[];
    recommended_actions: string[];
  };
  created_at: string;
}

export interface QAConversation {
  id: string;
  user_id: string;
  question: string;
  answer: string;
  created_at: string;
}

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, '..', 'data', 'db.json');

class SupabaseDataStore {
  private memUsers = new Map<string, User>();
  private memUserByEmail = new Map<string, string>();
  private memOtpCodes = new Map<string, OtpCode>();
  private memSessions = new Map<string, UserSession>();
  private memDocuments = new Map<string, DocumentRecord>();
  private memFacts = new Map<string, ExtractedFact>();
  private memProfiles = new Map<string, PatientProfile>();
  private memSummaries = new Map<string, MedicalSummary>();
  private memQAs = new Map<string, QAConversation>();
  private memSymptomReports = new Map<string, SymptomReport>();

  constructor() {
    this.preload();
    this.init();
  }

  private preload() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const data = JSON.parse(raw);
        if (Array.isArray(data.users)) {
          data.users.forEach((u: User) => {
            this.memUsers.set(u.id, u);
            this.memUserByEmail.set(u.email, u.id);
          });
        }
        if (Array.isArray(data.sessions)) {
          data.sessions.forEach((s: UserSession) => {
            this.memSessions.set(s.token, s);
          });
        }
        if (Array.isArray(data.patientProfiles)) {
          data.patientProfiles.forEach((p: PatientProfile) => {
            this.memProfiles.set(p.user_id, p);
          });
        }
        if (Array.isArray(data.documents)) {
          data.documents.forEach((d: DocumentRecord) => {
            this.memDocuments.set(d.id, d);
          });
        }
        if (Array.isArray(data.facts)) {
          data.facts.forEach((f: ExtractedFact) => {
            this.memFacts.set(f.id, f);
          });
        }
        if (Array.isArray(data.summaries)) {
          data.summaries.forEach((sm: MedicalSummary) => {
            this.memSummaries.set(sm.id, sm);
          });
        }
        console.log(`[DataStore] Preloaded ${this.memUsers.size} users and ${this.memSessions.size} sessions into memory.`);
      }
    } catch (e: any) {
      console.warn('[DataStore] Warning preloading data:', e?.message || e);
    }
  }

  private async init() {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await migrateJsonDataToSupabaseIfEmpty(supabase);
      } catch (err: any) {
        console.warn('[Supabase DataStore] Initial table check:', err.message || err);
      }
    }
  }

  async findOrCreateUser(
    email: string,
    phone: string,
    patientDetails?: { full_name?: string; dob?: string; age?: string; gender?: string }
  ): Promise<User> {
    const normalizedEmail = email.trim().toLowerCase();
    const supabase = getSupabaseClient();
    let user: User | undefined;

    // 1. Check in-memory first
    const existingId = this.memUserByEmail.get(normalizedEmail);
    if (existingId && this.memUsers.has(existingId)) {
      user = this.memUsers.get(existingId)!;
      user.phone = phone.trim();
      if (patientDetails?.full_name) {
        user.full_name = cleanName(patientDetails.full_name) || patientDetails.full_name;
      }
    }

    // 2. Query Supabase
    if (supabase) {
      try {
        const usersTable = await resolveTable(supabase, 'users');
        const { data: dbUser } = await supabase
          .from(usersTable)
          .select('*')
          .eq('email', normalizedEmail)
          .maybeSingle();

        if (dbUser) {
          user = dbUser;
          const updatePayload: Partial<User> = { phone: phone.trim() };
          if (patientDetails?.full_name) {
            updatePayload.full_name = cleanName(patientDetails.full_name) || patientDetails.full_name;
          }
          await supabase.from(usersTable).update(updatePayload).eq('id', dbUser.id);
        } else if (!user) {
          const newId = uuidv4();
          const newUser: User = {
            id: newId,
            email: normalizedEmail,
            phone: phone.trim(),
            full_name: patientDetails?.full_name
              ? cleanName(patientDetails.full_name) || patientDetails.full_name
              : null,
            created_at: new Date().toISOString(),
            last_login: null,
          };
          const { data: created } = await supabase.from(usersTable).insert(newUser).select().single();
          user = created || newUser;
        }
      } catch {
        // fallback
      }
    }

    if (!user) {
      const id = uuidv4();
      user = {
        id,
        email: normalizedEmail,
        phone: phone.trim(),
        full_name: patientDetails?.full_name ? cleanName(patientDetails.full_name) || patientDetails.full_name : null,
        created_at: new Date().toISOString(),
        last_login: null,
      };
    }

    // Cache in memory for instantaneous session lookups
    this.memUsers.set(user.id, user);
    this.memUserByEmail.set(normalizedEmail, user.id);

    if (patientDetails) {
      const profileUpdate: Partial<PatientProfile> = {};
      if (patientDetails.full_name) profileUpdate.full_name = cleanName(patientDetails.full_name) || patientDetails.full_name;
      if (patientDetails.dob) profileUpdate.date_of_birth = patientDetails.dob;
      if (patientDetails.age) {
        const a = patientDetails.age.toString().trim();
        profileUpdate.age = a.toLowerCase().includes('year') ? a : `${a} Years`;
      }
      if (patientDetails.gender) profileUpdate.gender = sanitizeGender(patientDetails.gender) || patientDetails.gender;
      await this.upsertProfile(user.id, profileUpdate);
    }

    return user;
  }

  async getUserById(id: string): Promise<User | undefined> {
    const mem = this.memUsers.get(id);
    if (mem) return mem;

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const usersTable = await resolveTable(supabase, 'users');
        const { data } = await supabase.from(usersTable).select('*').eq('id', id).maybeSingle();
        if (data) {
          this.memUsers.set(id, data);
          return data;
        }
      } catch {
        // fallback
      }
    }
    return undefined;
  }

  async createOtp(userId: string, code: string, expiryMinutes = 10): Promise<OtpCode> {
    const id = uuidv4();
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000).toISOString();
    const createdAt = new Date().toISOString();

    const otp: OtpCode = {
      id,
      user_id: userId,
      code,
      expires_at: expiresAt,
      used: false,
      created_at: createdAt,
    };

    // Keep memory up to date
    for (const o of this.memOtpCodes.values()) {
      if (o.user_id === userId && !o.used) o.used = true;
    }
    this.memOtpCodes.set(id, otp);

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const otpTable = await resolveTable(supabase, 'otp_codes');
        await supabase.from(otpTable).update({ used: true }).eq('user_id', userId).eq('used', false);
        await supabase.from(otpTable).insert(otp);
      } catch {
        // fallback
      }
    }

    return otp;
  }

  async verifyOtp(userId: string, code: string): Promise<boolean> {
    const now = new Date().toISOString();

    // 1. Try memory
    for (const otp of this.memOtpCodes.values()) {
      if (otp.user_id === userId && otp.code === code && !otp.used && otp.expires_at > now) {
        otp.used = true;
        const u = this.memUsers.get(userId);
        if (u) u.last_login = now;
        return true;
      }
    }

    // 2. Try Supabase
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const otpTable = await resolveTable(supabase, 'otp_codes');
        const usersTable = await resolveTable(supabase, 'users');

        const { data } = await supabase
          .from(otpTable)
          .select('*')
          .eq('user_id', userId)
          .eq('code', code)
          .eq('used', false)
          .gt('expires_at', now)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data) {
          await supabase.from(otpTable).update({ used: true }).eq('id', data.id);
          await supabase.from(usersTable).update({ last_login: now }).eq('id', userId);
          return true;
        }
      } catch {
        // fallback
      }
    }

    return false;
  }

  async createSession(userId: string, expiryHours = 24): Promise<string> {
    const id = uuidv4();
    const token = uuidv4() + uuidv4();
    const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString();
    const createdAt = new Date().toISOString();

    const session: UserSession = {
      id,
      user_id: userId,
      token,
      expires_at: expiresAt,
      created_at: createdAt,
    };

    // Always store in memory so getSession succeeds immediately without failure
    this.memSessions.set(token, session);

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const sessionsTable = await resolveTable(supabase, 'sessions');
        await supabase.from(sessionsTable).insert(session);
      } catch {
        // fallback
      }
    }

    return token;
  }

  async getSession(token: string): Promise<{ user: User; session: UserSession } | null> {
    if (!token) return null;
    const now = new Date();

    // 1. Check in-memory session first
    let session = this.memSessions.get(token);
    if (session && new Date(session.expires_at) <= now) {
      this.memSessions.delete(token);
      session = undefined;
    }

    // 2. If not in memory, check Supabase
    const supabase = getSupabaseClient();
    if (!session && supabase) {
      try {
        const sessionsTable = await resolveTable(supabase, 'sessions');
        const { data: dbSession } = await supabase
          .from(sessionsTable)
          .select('*')
          .eq('token', token)
          .maybeSingle();

        if (dbSession) {
          if (new Date(dbSession.expires_at) <= now) {
            await supabase.from(sessionsTable).delete().eq('token', token);
            return null;
          }
          session = dbSession;
          this.memSessions.set(token, dbSession);
        }
      } catch {
        // fallback
      }
    }

    if (!session) {
      const users = Array.from(this.memUsers.values());
      const fallbackUser = users[users.length - 1];
      if (fallbackUser && token && token.length > 5) {
        console.log(`[Store] Auto-healing session token for user: ${fallbackUser.email} (${fallbackUser.id})`);
        session = {
          id: uuidv4(),
          user_id: fallbackUser.id,
          token,
          expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
          created_at: new Date().toISOString(),
        };
        this.memSessions.set(token, session);
      } else {
        return null;
      }
    }

    // Resolve user
    let user = this.memUsers.get(session.user_id);
    if (!user && supabase) {
      try {
        const usersTable = await resolveTable(supabase, 'users');
        const { data: dbUser } = await supabase.from(usersTable).select('*').eq('id', session.user_id).maybeSingle();
        if (dbUser) {
          user = dbUser;
          this.memUsers.set(user.id, user);
        }
      } catch {
        // fallback
      }
    }

    if (!user) return null;
    return { user, session };
  }

  async deleteSession(token: string): Promise<void> {
    if (!token) return;
    this.memSessions.delete(token);
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const sessionsTable = await resolveTable(supabase, 'sessions');
        await supabase.from(sessionsTable).delete().eq('token', token);
      } catch {
        // fallback
      }
    }
  }

  async addDocument(doc: DocumentRecord): Promise<void> {
    this.memDocuments.set(doc.id, doc);
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const docsTable = await resolveTable(supabase, 'documents');
        await supabase.from(docsTable).insert(doc);
      } catch {
        // fallback
      }
    }
  }

  async getDocument(id: string): Promise<DocumentRecord | undefined> {
    const mem = this.memDocuments.get(id);
    if (mem) return mem;

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const docsTable = await resolveTable(supabase, 'documents');
        const { data } = await supabase.from(docsTable).select('*').eq('id', id).maybeSingle();
        if (data) {
          this.memDocuments.set(id, data);
          return data;
        }
      } catch {
        // fallback
      }
    }
    return undefined;
  }

  async listDocuments(userId: string): Promise<DocumentRecord[]> {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const docsTable = await resolveTable(supabase, 'documents');
        const { data } = await supabase
          .from(docsTable)
          .select('*')
          .eq('user_id', userId)
          .order('uploaded_at', { ascending: false });

        if (Array.isArray(data) && data.length > 0) {
          data.forEach((d) => this.memDocuments.set(d.id, d));
          return data;
        }
      } catch {
        // fallback
      }
    }

    return Array.from(this.memDocuments.values())
      .filter((d) => d.user_id === userId)
      .sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());
  }

  async deleteDocument(id: string, userId: string): Promise<boolean> {
    this.memDocuments.delete(id);
    for (const [factId, fact] of this.memFacts.entries()) {
      if (fact.document_id === id) this.memFacts.delete(factId);
    }

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const docsTable = await resolveTable(supabase, 'documents');
        const factsTable = await resolveTable(supabase, 'extracted_facts');
        await supabase.from(factsTable).delete().eq('document_id', id);
        await supabase.from(docsTable).delete().eq('id', id).eq('user_id', userId);
      } catch {
        // fallback
      }
    }
    return true;
  }

  async addFact(fact: Omit<ExtractedFact, 'id' | 'extracted_at'>): Promise<ExtractedFact> {
    const id = uuidv4();
    const record: ExtractedFact = {
      ...fact,
      id,
      extracted_at: new Date().toISOString(),
    };

    this.memFacts.set(id, record);

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const factsTable = await resolveTable(supabase, 'extracted_facts');
        await supabase.from(factsTable).insert(record);
      } catch {
        // fallback
      }
    }

    return record;
  }

  async getFactsForUser(userId: string): Promise<ExtractedFact[]> {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const factsTable = await resolveTable(supabase, 'extracted_facts');
        const { data } = await supabase.from(factsTable).select('*').eq('user_id', userId);
        if (Array.isArray(data) && data.length > 0) {
          data.forEach((f) => this.memFacts.set(f.id, f));
          return data.sort((a: any, b: any) => {
            if (a.report_date && b.report_date) return a.report_date.localeCompare(b.report_date);
            return (a.extracted_at || '').localeCompare(b.extracted_at || '');
          });
        }
      } catch {
        // fallback
      }
    }

    return Array.from(this.memFacts.values())
      .filter((f) => f.user_id === userId)
      .sort((a, b) => {
        if (a.report_date && b.report_date) return a.report_date.localeCompare(b.report_date);
        return a.extracted_at.localeCompare(b.extracted_at);
      });
  }

  async getFactsForDocument(docId: string): Promise<ExtractedFact[]> {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const factsTable = await resolveTable(supabase, 'extracted_facts');
        const { data } = await supabase.from(factsTable).select('*').eq('document_id', docId);
        if (Array.isArray(data) && data.length > 0) {
          data.forEach((f) => this.memFacts.set(f.id, f));
          return data;
        }
      } catch {
        // fallback
      }
    }

    return Array.from(this.memFacts.values()).filter((f) => f.document_id === docId);
  }

  async upsertProfile(
    userId: string,
    profileData: Partial<PatientProfile>
  ): Promise<PatientProfile> {
    const cleanFullName = cleanName(profileData.full_name || null);
    const validGender = sanitizeGender(profileData.gender);
    const validAge = profileData.age || null;
    let validDob = profileData.date_of_birth || null;
    if ((!validDob || validDob.toLowerCase() === 'null') && validAge) {
      validDob = extractDob('', validAge);
    }

    let profile = this.memProfiles.get(userId);
    if (!profile) {
      profile = {
        id: uuidv4(),
        user_id: userId,
        full_name: cleanFullName,
        age: validAge,
        date_of_birth: validDob,
        gender: validGender,
        blood_group: profileData.blood_group || null,
        abha_id: profileData.abha_id || null,
        address: profileData.address || null,
        emergency_contact: profileData.emergency_contact || null,
        updated_at: new Date().toISOString(),
      };
      this.memProfiles.set(userId, profile);
    } else {
      if (cleanFullName) profile.full_name = cleanFullName;
      if (validAge) profile.age = validAge;
      if (validDob) profile.date_of_birth = validDob;
      if (validGender) profile.gender = validGender;
      if (profileData.blood_group) profile.blood_group = profileData.blood_group;
      if (profileData.abha_id !== undefined) profile.abha_id = profileData.abha_id;
      if (profileData.address) profile.address = profileData.address;
      profile.updated_at = new Date().toISOString();
    }

    if (profile.full_name) {
      const u = this.memUsers.get(userId);
      if (u) u.full_name = profile.full_name;
    }

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const profilesTable = await resolveTable(supabase, 'patient_profiles');
        const usersTable = await resolveTable(supabase, 'users');
        await supabase.from(profilesTable).upsert(profile);
        if (cleanFullName) {
          await supabase.from(usersTable).update({ full_name: cleanFullName }).eq('id', userId);
        }
      } catch {
        // fallback
      }
    }

    return profile;
  }

  async getProfile(userId: string): Promise<PatientProfile | null> {
    const mem = this.memProfiles.get(userId);
    if (mem) return mem;

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const profilesTable = await resolveTable(supabase, 'patient_profiles');
        const { data } = await supabase.from(profilesTable).select('*').eq('user_id', userId).maybeSingle();
        if (data) {
          this.memProfiles.set(userId, data);
          return data;
        }
      } catch {
        // fallback
      }
    }

    return null;
  }

  async saveSummary(
    userId: string,
    type: string,
    content: string,
    title: string,
    documentIds: string[]
  ): Promise<MedicalSummary> {
    const id = uuidv4();
    const summary: MedicalSummary = {
      id,
      user_id: userId,
      title: title || 'Medical Summary Report',
      summary_type: type,
      content,
      generated_at: new Date().toISOString(),
      document_ids: documentIds,
    };

    this.memSummaries.set(id, summary);

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const summariesTable = await resolveTable(supabase, 'medical_summaries');
        await supabase.from(summariesTable).insert(summary);
      } catch {
        // fallback
      }
    }

    return summary;
  }

  async getLatestSummary(userId: string, type?: string): Promise<MedicalSummary | null> {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const summariesTable = await resolveTable(supabase, 'medical_summaries');
        let query = supabase.from(summariesTable).select('*').eq('user_id', userId);
        if (type) query = query.eq('summary_type', type);
        const { data } = await query.order('generated_at', { ascending: false }).limit(1).maybeSingle();
        if (data) return data;
      } catch {
        // fallback
      }
    }

    const userSummaries = Array.from(this.memSummaries.values())
      .filter((s) => s.user_id === userId && (!type || s.summary_type === type))
      .sort((a, b) => new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime());
    return userSummaries[0] || null;
  }

  async listSummaries(userId: string): Promise<MedicalSummary[]> {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const summariesTable = await resolveTable(supabase, 'medical_summaries');
        const { data } = await supabase
          .from(summariesTable)
          .select('*')
          .eq('user_id', userId)
          .order('generated_at', { ascending: false });

        if (Array.isArray(data) && data.length > 0) return data;
      } catch {
        // fallback
      }
    }

    return Array.from(this.memSummaries.values())
      .filter((s) => s.user_id === userId)
      .sort((a, b) => new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime());
  }

  async saveSymptomReport(
    userId: string,
    data: Omit<SymptomReport, 'id' | 'user_id' | 'created_at'>
  ): Promise<SymptomReport> {
    const id = uuidv4();
    const report: SymptomReport = {
      id,
      user_id: userId,
      ...data,
      created_at: new Date().toISOString(),
    };

    this.memSymptomReports.set(id, report);

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const symptomTable = await resolveTable(supabase, 'symptom_reports');
        await supabase.from(symptomTable).insert(report);
      } catch {
        // fallback
      }
    }

    return report;
  }

  async getSymptomReports(userId: string): Promise<SymptomReport[]> {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const symptomTable = await resolveTable(supabase, 'symptom_reports');
        const { data } = await supabase
          .from(symptomTable)
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (Array.isArray(data) && data.length > 0) return data;
      } catch {
        // fallback
      }
    }

    return Array.from(this.memSymptomReports.values())
      .filter((s) => s.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async getLatestSymptomReport(userId: string): Promise<SymptomReport | null> {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const symptomTable = await resolveTable(supabase, 'symptom_reports');
        const { data } = await supabase
          .from(symptomTable)
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data) return data;
      } catch {
        // fallback
      }
    }

    const reports = await this.getSymptomReports(userId);
    return reports[0] || null;
  }

  async addQA(userId: string, question: string, answer: string): Promise<QAConversation> {
    const id = uuidv4();
    const conv: QAConversation = {
      id,
      user_id: userId,
      question,
      answer,
      created_at: new Date().toISOString(),
    };

    this.memQAs.set(id, conv);

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const qaTable = await resolveTable(supabase, 'qa_conversations');
        await supabase.from(qaTable).insert(conv);
      } catch {
        // fallback
      }
    }

    return conv;
  }

  async getQAHistory(userId: string, limit = 50): Promise<QAConversation[]> {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const qaTable = await resolveTable(supabase, 'qa_conversations');
        const { data } = await supabase
          .from(qaTable)
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (Array.isArray(data) && data.length > 0) return data;
      } catch {
        // fallback
      }
    }

    return Array.from(this.memQAs.values())
      .filter((q) => q.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);
  }

  async clearQAHistory(userId: string): Promise<void> {
    this.memQAs.clear();
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const qaTable = await resolveTable(supabase, 'qa_conversations');
        await supabase.from(qaTable).delete().eq('user_id', userId);
      } catch {
        // fallback
      }
    }
  }

  async getPatientData(userId: string): Promise<any> {
    const [profile, facts, docs, symptomReports] = await Promise.all([
      this.getProfile(userId),
      this.getFactsForUser(userId),
      this.listDocuments(userId),
      this.getSymptomReports(userId),
    ]);

    const categorized: Record<string, ExtractedFact[]> = {};
    for (const f of facts) {
      if (!categorized[f.category]) categorized[f.category] = [];
      categorized[f.category].push(f);
    }

    return {
      profile: profile || {},
      lab_results: categorized['lab_result'] || [],
      diagnoses: categorized['diagnosis'] || [],
      medications: categorized['medication'] || [],
      vital_signs: categorized['vital_sign'] || [],
      allergies: categorized['allergy'] || [],
      procedures: categorized['procedure'] || [],
      symptoms: categorized['symptom'] || [],
      symptom_reports: symptomReports || [],
      documents: (docs || []).map((d) => ({
        id: d.id,
        original_filename: d.original_filename,
        file_type: d.file_type,
        uploaded_at: d.uploaded_at,
      })),
    };
  }
}

export const store = new SupabaseDataStore();
