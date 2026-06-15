/**
 * 蓉才通™ ATOS — Memory OS Database Schema
 * 
 * PostgreSQL + pgvector
 * 
 * Tables:
 * - memory_entries: 统一记忆存储（所有类型）
 * - memory_embeddings: 向量索引（pgvector）
 * - memory_sessions: 会话记忆快照
 * - memory_reflections: 反思记录
 * - memory_compressions: 压缩审计日志
 */

// ─── Core Memory Table ───────────────────────────────────────────────────────

export const memoryEntriesSchema = `
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Core memory entries table
CREATE TABLE IF NOT EXISTS memory_entries (
  id                TEXT PRIMARY KEY,
  type              TEXT NOT NULL CHECK (type IN ('session','user','candidate','recruiter','semantic','episodic')),
  subject_id        TEXT NOT NULL,
  tenant_id         TEXT NOT NULL,
  content           TEXT NOT NULL,
  summary           TEXT,
  embedding         vector(1536),
  importance        TEXT NOT NULL DEFAULT 'medium' CHECK (importance IN ('critical','high','medium','low','trivial')),
  importance_score  REAL NOT NULL DEFAULT 0.6,
  access_count      INTEGER NOT NULL DEFAULT 0,
  last_accessed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at        TIMESTAMPTZ,
  metadata          JSONB NOT NULL DEFAULT '{}',
  tags              TEXT[] NOT NULL DEFAULT '{}',
  source            JSONB NOT NULL DEFAULT '{}'
);

-- Indexes for memory_entries
CREATE INDEX IF NOT EXISTS idx_memory_tenant ON memory_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_memory_subject ON memory_entries(subject_id);
CREATE INDEX IF NOT EXISTS idx_memory_type ON memory_entries(type);
CREATE INDEX IF NOT EXISTS idx_memory_importance ON memory_entries(importance_score DESC);
CREATE INDEX IF NOT EXISTS idx_memory_created ON memory_entries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memory_accessed ON memory_entries(last_accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_memory_tags ON memory_entries USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_memory_metadata ON memory_entries USING GIN(metadata);
CREATE INDEX IF NOT EXISTS idx_memory_content_trgm ON memory_entries USING GIN(content gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_memory_embedding ON memory_entries USING ivfflat(embedding vector_cosine_ops) WITH (lists = 100);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_memory_subject_type ON memory_entries(subject_id, type);
CREATE INDEX IF NOT EXISTS idx_memory_tenant_type_created ON memory_entries(tenant_id, type, created_at DESC);

-- Auto-expire trigger
CREATE OR REPLACE FUNCTION memory_auto_expire() RETURNS trigger AS $$
BEGIN
  DELETE FROM memory_entries WHERE expires_at IS NOT NULL AND expires_at < NOW();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Run cleanup every 1000 inserts
DROP TRIGGER IF EXISTS trg_memory_expire ON memory_entries;
CREATE TRIGGER trg_memory_expire
  AFTER INSERT ON memory_entries
  FOR EACH STATEMENT
  EXECUTE FUNCTION memory_auto_expire();
`;

// ─── Memory Sessions Table ───────────────────────────────────────────────────

export const memorySessionsSchema = `
CREATE TABLE IF NOT EXISTS memory_sessions (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  tenant_id       TEXT NOT NULL,
  session_type    TEXT NOT NULL DEFAULT 'conversation',
  summary         TEXT,
  key_facts       JSONB DEFAULT '[]',
  decisions       JSONB DEFAULT '[]',
  action_items    JSONB DEFAULT '[]',
  turn_count      INTEGER DEFAULT 0,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at        TIMESTAMPTZ,
  metadata        JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_msession_user ON memory_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_msession_tenant ON memory_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_msession_started ON memory_sessions(started_at DESC);
`;

// ─── Reflections Table ───────────────────────────────────────────────────────

export const memoryReflectionsSchema = `
CREATE TABLE IF NOT EXISTS memory_reflections (
  id              TEXT PRIMARY KEY,
  subject_id      TEXT NOT NULL,
  tenant_id       TEXT NOT NULL,
  reflection_type TEXT NOT NULL CHECK (reflection_type IN ('individual','periodic','cross_subject')),
  insights        JSONB DEFAULT '[]',
  patterns        JSONB DEFAULT '[]',
  contradictions  JSONB DEFAULT '[]',
  recommendations JSONB DEFAULT '[]',
  source_count    INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata        JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_reflection_subject ON memory_reflections(subject_id);
CREATE INDEX IF NOT EXISTS idx_reflection_tenant ON memory_reflections(tenant_id);
CREATE INDEX IF NOT EXISTS idx_reflection_created ON memory_reflections(created_at DESC);
`;

// ─── Compression Audit Log ───────────────────────────────────────────────────

export const memoryCompressionsSchema = `
CREATE TABLE IF NOT EXISTS memory_compressions (
  id              TEXT PRIMARY KEY,
  subject_id      TEXT NOT NULL,
  tenant_id       TEXT NOT NULL,
  memory_type     TEXT NOT NULL,
  original_count  INTEGER NOT NULL,
  compressed_count INTEGER NOT NULL,
  summary         TEXT,
  retained_ids    TEXT[] DEFAULT '{}',
  merged_ids      TEXT[] DEFAULT '{}',
  discarded_ids   TEXT[] DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compression_subject ON memory_compressions(subject_id);
CREATE INDEX IF NOT EXISTS idx_compression_created ON memory_compressions(created_at DESC);
`;

// ─── All Schemas Combined ────────────────────────────────────────────────────

export const allMemorySchemas = [
  memoryEntriesSchema,
  memorySessionsSchema,
  memoryReflectionsSchema,
  memoryCompressionsSchema,
].join('\n\n');

// ─── SQL Queries ─────────────────────────────────────────────────────────────

export const memoryQueries = {
  // Semantic search with pgvector
  semanticSearch: `
    SELECT 
      *,
      1 - (embedding <=> $1::vector) AS semantic_score
    FROM memory_entries
    WHERE tenant_id = $2
      AND ($3::text IS NULL OR type = $3)
      AND ($4::text IS NULL OR subject_id = $4)
      AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY embedding <=> $1::vector
    LIMIT $5;
  `,

  // Hybrid search (semantic + text + recency)
  hybridSearch: `
    WITH semantic AS (
      SELECT id, 1 - (embedding <=> $1::vector) AS score
      FROM memory_entries
      WHERE tenant_id = $2 AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY embedding <=> $1::vector
      LIMIT 50
    ),
    text_match AS (
      SELECT id, ts_rank(to_tsvector('english', content), plainto_tsquery($3)) AS score
      FROM memory_entries
      WHERE tenant_id = $2 
        AND to_tsvector('english', content) @@ plainto_tsquery($3)
        AND (expires_at IS NULL OR expires_at > NOW())
      LIMIT 50
    ),
    combined AS (
      SELECT 
        COALESCE(s.id, t.id) AS id,
        COALESCE(s.score, 0) * 0.6 + COALESCE(t.score, 0) * 0.4 AS combined_score
      FROM semantic s
      FULL OUTER JOIN text_match t ON s.id = t.id
    )
    SELECT m.*, c.combined_score
    FROM combined c
    JOIN memory_entries m ON m.id = c.id
    ORDER BY c.combined_score DESC
    LIMIT $4;
  `,

  // Get memories by subject with decay
  getBySubjectWithDecay: `
    SELECT *,
      importance_score * EXP(-0.023 * EXTRACT(EPOCH FROM (NOW() - last_accessed_at)) / 86400) AS effective_score
    FROM memory_entries
    WHERE subject_id = $1
      AND ($2::text IS NULL OR type = $2)
      AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY effective_score DESC
    LIMIT $3;
  `,

  // Apply bulk decay
  applyDecay: `
    UPDATE memory_entries
    SET 
      metadata = jsonb_set(
        metadata,
        '{decay}',
        to_jsonb(
          COALESCE((metadata->>'decay')::float, 1.0) * 
          EXP(-0.023 * EXTRACT(EPOCH FROM (NOW() - updated_at)) / 86400)
        )
      ),
      updated_at = NOW()
    WHERE tenant_id = $1
      AND updated_at < NOW() - INTERVAL '1 day'
      AND COALESCE((metadata->>'decay')::float, 1.0) > 0.01
    RETURNING id;
  `,

  // Prune expired and decayed memories
  pruneDecayed: `
    DELETE FROM memory_entries
    WHERE tenant_id = $1
      AND importance IN ('trivial', 'low')
      AND COALESCE((metadata->>'decay')::float, 1.0) < 0.05
      AND last_accessed_at < NOW() - INTERVAL '90 days'
    RETURNING id;
  `,

  // Statistics
  getStats: `
    SELECT 
      type,
      COUNT(*) as count,
      AVG(importance_score) as avg_importance,
      AVG(access_count) as avg_access,
      MIN(created_at) as oldest,
      MAX(created_at) as newest
    FROM memory_entries
    WHERE tenant_id = $1
    GROUP BY type
    ORDER BY count DESC;
  `,
};
