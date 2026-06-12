/**
 * 蓉才通™ ATOS 数据库Schema (PostgreSQL DDL)
 */
export const schema = `
CREATE TABLE IF NOT EXISTS tenants (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  cert_serial VARCHAR(128) UNIQUE NOT NULL,
  cert_level VARCHAR(10) NOT NULL CHECK (cert_level IN ('EV', 'OV', 'DV')),
  region VARCHAR(128),
  trust_score INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active',
  verified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id),
  name VARCHAR(128) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin','hr','interviewer','candidate','expert')),
  email VARCHAR(255),
  phone VARCHAR(20),
  cert_serial VARCHAR(128),
  permissions JSONB DEFAULT '[]',
  status VARCHAR(20) DEFAULT 'active',
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS positions (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id),
  title VARCHAR(255) NOT NULL,
  department VARCHAR(128),
  location VARCHAR(128),
  salary_min INTEGER,
  salary_max INTEGER,
  requirements JSONB DEFAULT '[]',
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft','published','closed','archived')),
  published_at TIMESTAMPTZ,
  created_by VARCHAR(64) REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS candidates (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id),
  name VARCHAR(128) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  resume_url VARCHAR(512),
  skills JSONB DEFAULT '[]',
  experience_years INTEGER DEFAULT 0,
  source VARCHAR(50),
  status VARCHAR(30) DEFAULT 'new' CHECK (status IN ('new','screening','interview','offer','hired','rejected','withdrawn')),
  ai_match_score DECIMAL(5,2),
  risk_level VARCHAR(10) DEFAULT 'low',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS interviews (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id),
  candidate_id VARCHAR(64) NOT NULL REFERENCES candidates(id),
  position_id VARCHAR(64) NOT NULL REFERENCES positions(id),
  interviewer_id VARCHAR(64) REFERENCES users(id),
  scheduled_at TIMESTAMPTZ,
  duration_minutes INTEGER DEFAULT 60,
  type VARCHAR(20) DEFAULT 'video' CHECK (type IN ('video','phone','onsite','async')),
  status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled','in_progress','completed','cancelled','no_show')),
  ai_score DECIMAL(5,2),
  ai_summary TEXT,
  feedback JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS decisions (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id),
  candidate_id VARCHAR(64) NOT NULL REFERENCES candidates(id),
  position_id VARCHAR(64) NOT NULL REFERENCES positions(id),
  decision VARCHAR(20) NOT NULL CHECK (decision IN ('approve','reject','hold','escalate')),
  reason TEXT,
  approved_by VARCHAR(64) REFERENCES users(id),
  ai_recommendation VARCHAR(20),
  ai_confidence DECIMAL(5,2),
  lineage JSONB DEFAULT '{}',
  evidence_hash VARCHAR(128),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS evidence (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id),
  operator_cert_serial VARCHAR(128) NOT NULL,
  operation_type VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  prev_hash VARCHAR(128),
  sm3_hash VARCHAR(128) NOT NULL,
  ca_signature VARCHAR(512),
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id),
  actor VARCHAR(128) NOT NULL,
  actor_role VARCHAR(50),
  action VARCHAR(100) NOT NULL,
  resource VARCHAR(255),
  resource_type VARCHAR(50),
  result VARCHAR(20) CHECK (result IN ('success','denied','warning','error')),
  ip VARCHAR(45),
  user_agent VARCHAR(255),
  details JSONB,
  sm3_hash VARCHAR(128),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_positions_tenant ON positions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_candidates_tenant ON candidates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_interviews_tenant ON interviews(tenant_id);
CREATE INDEX IF NOT EXISTS idx_decisions_tenant ON decisions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_evidence_tenant ON evidence(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evidence_timestamp ON evidence(timestamp DESC);
`;

export default schema;
