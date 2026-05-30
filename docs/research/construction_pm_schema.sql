-- Construction PM Data Model - Production Schema
-- Based on Procore, Buildertrend, Fieldwire analysis
-- Generated: May 30, 2026

-- ============================================================================
-- TABLE 1: site_activities (Daily Log)
-- ============================================================================
CREATE TABLE site_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  location_id UUID,
  
  -- Activity Definition
  activity_date DATE NOT NULL,
  activity_type VARCHAR(100) NOT NULL,
  description TEXT,
  
  -- Planned vs Actual (Core Requirement)
  planned_start TIMESTAMP,
  actual_start TIMESTAMP,
  planned_end TIMESTAMP,
  actual_end TIMESTAMP,
  
  -- Status & Delay Tracking
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'delayed', 'cancelled')),
  is_delayed BOOLEAN DEFAULT FALSE,
  delay_reason_code VARCHAR(50),
  delay_cost_impact DECIMAL(12, 2),
  delay_notes TEXT,
  
  -- Weather (Buildertrend-inspired)
  weather_condition VARCHAR(50),
  temperature_f INT,
  precipitation_in DECIMAL(4, 2),
  wind_mph INT,
  
  -- Metadata
  created_by UUID NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (location_id) REFERENCES locations(id),
  FOREIGN KEY (delay_reason_code) REFERENCES delay_reasons(code),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX idx_site_activities_project_date ON site_activities(project_id, activity_date);
CREATE INDEX idx_site_activities_status ON site_activities(status);
CREATE INDEX idx_site_activities_delayed ON site_activities(is_delayed);
CREATE INDEX idx_site_activities_location ON site_activities(location_id);

-- ============================================================================
-- TABLE 2: delay_reasons (Taxonomy - Procore-aligned)
-- ============================================================================
CREATE TABLE delay_reasons (
  code VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  category VARCHAR(50) CHECK (category IN ('weather', 'material', 'labor', 'equipment', 'approval', 'other')),
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE
);

-- Standard taxonomy
INSERT INTO delay_reasons (code, name, category, description) VALUES
  ('WEATHER_RAIN', 'Rain', 'weather', 'Rainfall prevented work'),
  ('WEATHER_SNOW', 'Snow', 'weather', 'Snowfall prevented work'),
  ('WEATHER_EXTREME_TEMP', 'Extreme Temperature', 'weather', 'Temperature too hot or cold'),
  ('WEATHER_WIND', 'High Wind', 'weather', 'Wind prevented work'),
  ('MATERIAL_SHORTAGE', 'Material Shortage', 'material', 'Required materials unavailable'),
  ('MATERIAL_DELIVERY', 'Delivery Delay', 'material', 'Supplier delivery delayed'),
  ('LABOR_NOSHOW', 'Worker No-Show', 'labor', 'Scheduled workers did not arrive'),
  ('LABOR_SHORTAGE', 'Labor Shortage', 'labor', 'Insufficient workers available'),
  ('LABOR_ILLNESS', 'Worker Illness', 'labor', 'Workers unable to work due to illness'),
  ('EQUIPMENT_BREAKDOWN', 'Equipment Breakdown', 'equipment', 'Equipment malfunction/unavailable'),
  ('EQUIPMENT_SHORTAGE', 'Equipment Shortage', 'equipment', 'Required equipment unavailable'),
  ('APPROVAL_PERMIT', 'Permit Delay', 'approval', 'Permit approval pending'),
  ('APPROVAL_INSPECTION', 'Inspection Delay', 'approval', 'Inspection approval pending'),
  ('APPROVAL_CLIENT', 'Client Approval', 'approval', 'Client decision/approval pending'),
  ('DESIGN_CHANGE', 'Design Change', 'approval', 'Design modification required'),
  ('SUBCONTRACTOR_DELAY', 'Subcontractor Delay', 'labor', 'Subcontractor delayed'),
  ('SAFETY_ISSUE', 'Safety Issue', 'other', 'Safety concern halted work'),
  ('REWORK', 'Rework Required', 'other', 'Quality issue required rework'),
  ('OTHER', 'Other', 'other', 'Other reason');

-- ============================================================================
-- TABLE 3: worker_attendance (Labor Tracking)
-- ============================================================================
CREATE TABLE worker_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_activity_id UUID NOT NULL,
  worker_id UUID NOT NULL,
  
  hours_worked DECIMAL(5, 2) NOT NULL,
  role VARCHAR(50),
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (site_activity_id) REFERENCES site_activities(id) ON DELETE CASCADE,
  FOREIGN KEY (worker_id) REFERENCES workers(id)
);

CREATE INDEX idx_worker_attendance_activity ON worker_attendance(site_activity_id);
CREATE INDEX idx_worker_attendance_worker ON worker_attendance(worker_id);

-- ============================================================================
-- TABLE 4: activity_notes (End-of-Day Summary)
-- ============================================================================
CREATE TABLE activity_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_activity_id UUID NOT NULL UNIQUE,
  
  summary TEXT NOT NULL,
  prevention_notes TEXT,
  
  created_by UUID NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (site_activity_id) REFERENCES site_activities(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX idx_activity_notes_activity ON activity_notes(site_activity_id);

-- ============================================================================
-- TABLE 5: activity_attachments (Photos & Documents)
-- ============================================================================
CREATE TABLE activity_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_activity_id UUID NOT NULL,
  
  file_url VARCHAR(500) NOT NULL,
  file_type VARCHAR(20) CHECK (file_type IN ('photo', 'document', 'video')),
  file_size_bytes INT,
  
  uploaded_by UUID NOT NULL,
  uploaded_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (site_activity_id) REFERENCES site_activities(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

CREATE INDEX idx_activity_attachments_activity ON activity_attachments(site_activity_id);

-- ============================================================================
-- VIEWS (Optional - for common queries)
-- ============================================================================

-- View: Delayed activities with reason details
CREATE VIEW delayed_activities_view AS
SELECT 
  sa.id,
  sa.project_id,
  sa.location_id,
  sa.activity_date,
  sa.activity_type,
  sa.planned_start,
  sa.actual_start,
  sa.planned_end,
  sa.actual_end,
  EXTRACT(EPOCH FROM (sa.actual_start - sa.planned_start)) / 3600 AS delay_hours,
  dr.name AS delay_reason,
  dr.category AS delay_category,
  sa.delay_cost_impact,
  sa.weather_condition,
  sa.temperature_f
FROM site_activities sa
LEFT JOIN delay_reasons dr ON sa.delay_reason_code = dr.code
WHERE sa.is_delayed = TRUE;

-- View: Daily labor summary
CREATE VIEW daily_labor_summary AS
SELECT 
  sa.id,
  sa.project_id,
  sa.activity_date,
  sa.activity_type,
  COUNT(DISTINCT wa.worker_id) AS worker_count,
  SUM(wa.hours_worked) AS total_hours,
  AVG(wa.hours_worked) AS avg_hours_per_worker
FROM site_activities sa
LEFT JOIN worker_attendance wa ON sa.id = wa.site_activity_id
GROUP BY sa.id, sa.project_id, sa.activity_date, sa.activity_type;

-- View: Delay cost impact by reason
CREATE VIEW delay_cost_by_reason AS
SELECT 
  dr.code,
  dr.name,
  dr.category,
  COUNT(*) AS delay_count,
  SUM(sa.delay_cost_impact) AS total_cost_impact,
  AVG(sa.delay_cost_impact) AS avg_cost_per_delay
FROM site_activities sa
JOIN delay_reasons dr ON sa.delay_reason_code = dr.code
WHERE sa.is_delayed = TRUE
GROUP BY dr.code, dr.name, dr.category
ORDER BY total_cost_impact DESC;

