/**
 * 蓉才通™ ATOS — AI Module Database Schema v2
 * 
 * PostgreSQL + pgvector
 * 
 * Tables:
 * - interview_sessions: 面试会话
 * - interview_transcripts: 转写记录
 * - interview_reports: 面试报告
 * - talent_profiles: 人才画像（含向量）
 * - resume_analyses: 简历分析结果
 * - outreach_sequences: 外联序列
 * - career_plans: 职业规划
 * - mock_sessions: 模拟面试会话
 */

// ─── Interview Sessions ──────────────────────────────────────────────────────

export const interviewSessionsSchema = `
CREATE TABLE IF NOT EXISTS interview_sessions (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL,
  candidate_id    TEXT NOT NULL,
  position_id     TEXT NOT NULL,
  interviewer_id  TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','in_progress','paused','completed','cancelled')),
  started_at      TIMESTAMPTZ,
  ended_at        TIMESTAMPTZ,
  duration_seconds INTEGER DEFAULT 0,
  current_question_idx INTEGER DEFAULT 0,
  total_questions  INTEGER DEFAULT 0,
  questions       JSONB DEFAULT '[]',
  competencies    TEXT[] DEFAULT '{}',
  scores          JSONB DEFAULT '{}',
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_tenant ON interview_sessions(tenant_id);
CREATE INDEX idx_sessions_candidate ON interview_sessions(candidate_id);
CREATE INDEX idx_sessions_status ON interview_sessions(status);
`;

// ─── Interview Transcripts ───────────────────────────────────────────────────

export const interviewTranscriptsSchema = `
CREATE TABLE IF NOT EXISTS interview_transcripts (
  id              TEXT PRIMARY KEY,
  session_id      TEXT NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  speaker         TEXT NOT NULL CHECK (speaker IN ('candidate','interviewer','system')),
  text            TEXT NOT NULL,
  confidence      REAL DEFAULT 1.0,
  duration_ms     INTEGER,
  language        TEXT DEFAULT 'zh',
  timestamp       TIMESTAMPTZ DEFAULT NOW(),
  metadata        JSONB DEFAULT '{}'
);

CREATE INDEX idx_transcripts_session ON interview_transcripts(session_id);
CREATE INDEX idx_transcripts_timestamp ON interview_transcripts(session_id, timestamp);
`;

// ─── Interview Reports ───────────────────────────────────────────────────────

export const interviewReportsSchema = `
CREATE TABLE IF NOT EXISTS interview_reports (
  id              TEXT PRIMARY KEY,
  session_id      TEXT NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  tenant_id       TEXT NOT NULL,
  candidate_id    TEXT NOT NULL,
  position_id     TEXT NOT NULL,
  executive_summary TEXT,
  recommendation  TEXT CHECK (recommendation IN ('strong_hire','hire','lean_hire','lean_no_hire','no_hire')),
  overall_score   INTEGER,
  confidence      REAL,
  competency_matrix JSONB DEFAULT '[]',
  star_cases      JSONB DEFAULT '[]',
  key_strengths   TEXT[] DEFAULT '{}',
  development_areas TEXT[] DEFAULT '{}',
  risk_signals    JSONB DEFAULT '[]',
  full_report     JSONB,
  generated_at    TIMESTAMPTZ DEFAULT NOW(),
  reviewed_by     TEXT,
  reviewed_at     TIMESTAMPTZ
);

CREATE INDEX idx_reports_session ON interview_reports(session_id);
CREATE INDEX idx_reports_candidate ON interview_reports(candidate_id);
CREATE INDEX idx_reports_recommendation ON interview_reports(recommendation);
`;

// ─── Talent Profiles (with pgvector) ─────────────────────────────────────────

export const talentProfilesSchema = `
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS talent_profiles (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL,
  name            TEXT NOT NULL,
  email           TEXT,
  phone           TEXT,
  current_title   TEXT,
  current_company TEXT,
  location        TEXT,
  experience_years INTEGER DEFAULT 0,
  skills          TEXT[] DEFAULT '{}',
  industry        TEXT,
  education       JSONB DEFAULT '[]',
  experience      JSONB DEFAULT '[]',
  summary         TEXT,
  source          TEXT DEFAULT 'internal' CHECK (source IN ('internal','linkedin','github','referral','other')),
  last_active     TIMESTAMPTZ,
  embedding       vector(1536),
  search_vector   tsvector,
  risk_level      TEXT DEFAULT 'low' CHECK (risk_level IN ('low','medium','high','critical')),
  skill_score     INTEGER,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_talent_tenant ON talent_profiles(tenant_id);
CREATE INDEX idx_talent_skills ON talent_profiles USING GIN(skills);
CREATE INDEX idx_talent_location ON talent_profiles(location);
CREATE INDEX idx_talent_experience ON talent_profiles(experience_years);
CREATE INDEX idx_talent_embedding ON talent_profiles USING ivfflat(embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_talent_search ON talent_profiles USING GIN(search_vector);
CREATE INDEX idx_talent_name_trgm ON talent_profiles USING GIN(name gin_trgm_ops);
`;

// ─── Resume Analyses ─────────────────────────────────────────────────────────

export const resumeAnalysesSchema = `
CREATE TABLE IF NOT EXISTS resume_analyses (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL,
  candidate_id    TEXT NOT NULL,
  position_id     TEXT,
  raw_text        TEXT,
  parsed_data     JSONB,
  skill_analysis  JSONB,
  risk_assessment JSONB,
  match_score     REAL,
  ranking_data    JSONB,
  explanation     JSONB,
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_resume_candidate ON resume_analyses(candidate_id);
CREATE INDEX idx_resume_position ON resume_analyses(position_id);
CREATE INDEX idx_resume_score ON resume_analyses(match_score DESC);
`;

// ─── Outreach Sequences ──────────────────────────────────────────────────────

export const outreachSequencesSchema = `
CREATE TABLE IF NOT EXISTS outreach_sequences (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL,
  candidate_id    TEXT NOT NULL,
  position_id     TEXT NOT NULL,
  recruiter_id    TEXT NOT NULL,
  status          TEXT DEFAULT 'draft' CHECK (status IN ('draft','active','paused','completed','bounced')),
  current_step    INTEGER DEFAULT 0,
  total_steps     INTEGER DEFAULT 4,
  emails          JSONB DEFAULT '[]',
  send_schedule   JSONB DEFAULT '{}',
  metrics         JSONB DEFAULT '{"sent":0,"opened":0,"replied":0,"clicked":0}',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_outreach_tenant ON outreach_sequences(tenant_id);
CREATE INDEX idx_outreach_candidate ON outreach_sequences(candidate_id);
CREATE INDEX idx_outreach_status ON outreach_sequences(status);
`;

// ─── Career Plans ────────────────────────────────────────────────────────────

export const careerPlansSchema = `
CREATE TABLE IF NOT EXISTS career_plans (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  current_profile JSONB NOT NULL,
  aspirations     JSONB NOT NULL,
  plan_data       JSONB NOT NULL,
  version         INTEGER DEFAULT 1,
  status          TEXT DEFAULT 'active' CHECK (status IN ('active','archived','superseded')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_career_user ON career_plans(user_id);
`;

// ─── Mock Interview Sessions ─────────────────────────────────────────────────

export const mockSessionsSchema = `
CREATE TABLE IF NOT EXISTS mock_sessions (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  config          JSONB NOT NULL,
  questions       JSONB DEFAULT '[]',
  answers         JSONB DEFAULT '[]',
  feedback        JSONB DEFAULT '[]',
  overall_score   INTEGER,
  status          TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','abandoned')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX idx_mock_user ON mock_sessions(user_id);
CREATE INDEX idx_mock_status ON mock_sessions(status);
`;

// ─── Migration Runner ────────────────────────────────────────────────────────

export const ALL_SCHEMAS = [
  interviewSessionsSchema,
  interviewTranscriptsSchema,
  interviewReportsSchema,
  talentProfilesSchema,
  resumeAnalysesSchema,
  outreachSequencesSchema,
  careerPlansSchema,
  mockSessionsSchema,
];

export async function runMigrations(db: { execute: (sql: unknown) => Promise<unknown> }, sql: { raw: (s: string) => unknown }) {
  for (const schema of ALL_SCHEMAS) {
    await db.execute(sql.raw(schema));
  }
  console.log('[DB] AI module migrations completed');
}
