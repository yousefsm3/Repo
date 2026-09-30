-- Wedding AI Platform — Phase 1 Database Schema
-- PostgreSQL 16+ with pgvector extension

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================
-- TENANTS (Photographers/Studios)
-- =========================
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_name TEXT NOT NULL,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#111111',
  secondary_color TEXT DEFAULT '#C9A87C',
  website TEXT,
  whatsapp TEXT,
  instagram TEXT,
  custom_domain TEXT UNIQUE,
  domain_verified BOOLEAN DEFAULT FALSE,
  white_label_enabled BOOLEAN DEFAULT FALSE,
  plan_id UUID REFERENCES plans(id),
  storage_used_bytes BIGINT DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','deleted')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =========================
-- PLANS (Admin-managed, no hardcoded limits)
-- =========================
CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,               -- Starter / Professional / Business / Enterprise / Unlimited
  price_sar NUMERIC(10,2) NOT NULL,
  event_limit INT,                  -- NULL = unlimited
  photo_limit INT,                  -- NULL = unlimited
  white_label_included BOOLEAN DEFAULT FALSE,
  custom_domain_included BOOLEAN DEFAULT FALSE,
  api_access_included BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE tenants
  ADD CONSTRAINT fk_tenant_plan FOREIGN KEY (plan_id) REFERENCES plans(id);

-- =========================
-- USERS (Tenant staff: Photographer, Event Manager)
-- =========================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('super_admin','photographer','event_manager')),
  mfa_enabled BOOLEAN DEFAULT FALSE,
  mfa_secret TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =========================
-- EVENTS
-- =========================
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,        -- used in /e/:slug
  name TEXT NOT NULL,
  event_date DATE,
  location TEXT,
  description TEXT,
  cover_image_url TEXT,
  qr_code_url TEXT,
  selfie_retention_hours INT DEFAULT 1,      -- 0/1/24
  event_retention_days INT DEFAULT 90,       -- 30/60/90/custom
  face_match_threshold NUMERIC(4,3) DEFAULT 0.600, -- admin/photographer configurable, never shown to guest
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived','deleted')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_events_tenant ON events(tenant_id);

-- =========================
-- PHOTOS
-- =========================
CREATE TABLE photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  storage_key TEXT NOT NULL,
  thumbnail_key TEXT,
  original_url TEXT,       -- signed URL generated on demand, not stored public
  width INT,
  height INT,
  file_size BIGINT,
  file_hash TEXT NOT NULL, -- for duplicate detection
  processing_status TEXT NOT NULL DEFAULT 'pending'
      CHECK (processing_status IN ('pending','processing','processed','failed')),
  processing_error TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_photos_event ON photos(event_id);
CREATE UNIQUE INDEX idx_photos_event_hash ON photos(event_id, file_hash); -- duplicate detection

-- =========================
-- FACES + EMBEDDINGS (pgvector)
-- =========================
CREATE TABLE faces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  embedding VECTOR(512) NOT NULL,     -- dimension depends on chosen model (e.g. ArcFace=512)
  bounding_box JSONB NOT NULL,        -- {x,y,w,h}
  confidence NUMERIC(4,3),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_faces_event ON faces(event_id);
-- IVFFlat index for approximate nearest neighbor search, scoped per event via WHERE filter
CREATE INDEX idx_faces_embedding ON faces USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- =========================
-- GUEST SEARCH SESSIONS (ephemeral, biometric-sensitive)
-- =========================
CREATE TABLE guest_searches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL UNIQUE,
  selfie_storage_key TEXT,           -- deleted per event.selfie_retention_hours
  matched_photo_ids UUID[] DEFAULT '{}',
  ip_address INET,
  consent_given_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_guest_searches_event ON guest_searches(event_id);

-- =========================
-- API KEYS (for Desktop Uploader / external integrations)
-- =========================
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL,       -- store hash only, show plaintext once at creation
  label TEXT,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =========================
-- SUBSCRIPTIONS & PAYMENTS
-- =========================
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES plans(id),
  status TEXT NOT NULL CHECK (status IN ('trialing','active','past_due','cancelled')),
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,       -- moyasar / hyperpay / tap / stripe
  provider_reference TEXT,
  amount_sar NUMERIC(10,2),
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =========================
-- AUDIT LOGS
-- =========================
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID,
  actor_user_id UUID,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =========================
-- AI / STORAGE USAGE (for cost dashboard)
-- =========================
CREATE TABLE usage_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  usage_type TEXT NOT NULL CHECK (usage_type IN ('photo_processed','face_search','storage_byte_month')),
  quantity NUMERIC NOT NULL,
  estimated_cost_usd NUMERIC(12,6),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =========================
-- ROW LEVEL SECURITY (Multi-Tenant isolation)
-- =========================
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE faces ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_events ON events
  USING (tenant_id::text = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation_photos ON photos
  USING (tenant_id::text = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation_faces ON faces
  USING (tenant_id::text = current_setting('app.tenant_id', true));

-- Super admin role bypasses RLS via a separate DB role with BYPASSRLS, not via application logic.
