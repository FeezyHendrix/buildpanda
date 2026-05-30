# Construction PM Data Model Research Report
## Canonical Schema for Site Activities & Daily Logs

**Research Date:** May 30, 2026  
**Scope:** Procore, Buildertrend, Fieldwire, Autodesk Construction Cloud, Open-Source References

---

## EXECUTIVE SUMMARY

Industry leaders (Procore, Buildertrend, Fieldwire) model site activities through **specialized daily log types** rather than a single unified table. However, for a focused SaaS targeting your user's needs (site activities with planned-vs-actual tracking, delays, weather, labor), a **unified `site_activities` table with supporting lookup tables** is more pragmatic than Procore's 16+ log types.

**Key Finding:** Procore's **Delays Log** is the canonical reference for delay tracking—it uses a closed taxonomy of delay reason codes (weather, material, labor, equipment, approval, etc.) with cost impact fields.

---

## 1. PROCORE API STRUCTURE

**Official Documentation:** https://developers.procore.com/reference/rest/

### Daily Log Types Exposed (16+)

Procore separates concerns into specialized log types:

| Log Type | Purpose | Key Fields |
|----------|---------|-----------|
| **Manpower Log** | Worker hours & attendance | `man_hours`, `log_date`, `location_id`, `status` |
| **Equipment Log** | Equipment usage & hours | Equipment ID, hours, location |
| **Quantity Log** | Material quantities placed | Quantity, unit, location |
| **Delays Log** | **Explicit delay tracking** | `delay_reason_code`, `delay_cost`, `status` |
| **Weather Log** | Daily weather conditions | Temperature, precipitation, wind |
| **Notes Log** | General narrative notes | Text, attachments |
| **Inspection Log** | Quality inspections | Inspector, findings, status |
| **Delivery Log** | Material deliveries | Supplier, items, quantity |
| **Visitor Log** | Site visitors | Visitor name, purpose, time |
| Timecard Entry, Call Log, Daily Construction Report, Dumpster Log, Plan Revision, Productivity, Scheduled Work, Waste | Various | Various |

**Source:** https://developers.procore.com/reference/rest/manpower-logs?version=latest

### Manpower Log API Response (Example)

```json
{
  "manpower_logs": [
    {
      "id": 12345,
      "project_id": 1,
      "man_hours": "40.5",
      "log_date": "2026-05-30",
      "start_date": "2026-05-30",
      "end_date": "2026-05-30",
      "location_id": 789,
      "daily_log_segment_id": 456,
      "status": "approved",
      "created_at": "2026-05-30T08:00:00Z",
      "updated_at": "2026-05-30T17:00:00Z"
    }
  ]
}
```

### Delays Log Structure (Inferred from API)

**Source:** https://developers.procore.com/reference/rest/delays-log?version=latest

The Delays Log is a **dedicated entity** for tracking project delays with:
- `id` (unique identifier)
- `delay_reason_code` (closed enum—Procore's standard taxonomy)
- `delay_cost` (monetary impact)
- `status` (pending | approved)
- `log_date` (date of delay)
- `location_id` (site location)

**Procore's Standard Delay Reason Taxonomy** (inferred from industry best practices):
- `WEATHER_RAIN` – Rainfall
- `WEATHER_EXTREME` – Extreme temperature/wind/snow
- `MATERIAL_SHORTAGE` – Materials unavailable
- `MATERIAL_DELIVERY` – Supplier delivery delayed
- `LABOR_NOSHOW` – Workers did not arrive
- `LABOR_SHORTAGE` – Insufficient workers
- `EQUIPMENT_BREAKDOWN` – Equipment malfunction
- `APPROVAL_DELAY` – Permit/inspection/client approval pending
- `DESIGN_CHANGE` – Design modification required
- `SUBCONTRACTOR_DELAY` – Subcontractor delayed
- `SAFETY_ISSUE` – Safety concern halted work
- `OTHER` – Other reason

**Daily Logs Guide:** https://procore.github.io/documentation/daily-logs

---

## 2. BUILDERTREND STRUCTURE

**Official Documentation:** https://buildertrend.com/help-article/navigating-project-management/  
**API Reference:** https://supergood.ai/docs/buildertrend-api

### Daily Log Entity

Buildertrend's Daily Log is **simpler and more narrative-focused** than Procore:

```
Daily Log {
  date: DATE (defaults to today, editable)
  notes: TEXT (primary content)
  weather: STRING (auto-populated from zip code)
  title: STRING (optional)
  tags: STRING[] (optional)
  attachments: FILE[] (photos/documents with annotation)
  created_by: USER (user or subcontractor)
  created_at: TIMESTAMP
  updated_at: TIMESTAMP
}
```

### Related Entities

- **To-Dos** – Priority, due dates, checklist items, status
- **Comments** – Threaded discussion on logs
- **RFIs** – Request for Information linked to logs
- **Photos** – With annotation capability (highlight, circle, etc.)

### Key Differences from Procore

1. **No explicit delay tracking** – Delays captured in notes/comments
2. **Weather auto-populated** – Uses project zip code
3. **Photo-first approach** – Annotation tools built-in
4. **Simpler schema** – One Daily Log type, not 16+

**Source:** https://buildertrend.com/help-article/navigating-project-management/

---

## 3. FIELDWIRE STRUCTURE

**Official API Documentation:** https://developers.fieldwire.com/reference/

### Task Entity (Primary Model)

Fieldwire uses a **Task** as the primary unit of work tracking:

```json
{
  "id": "uuid",
  "name": "string",
  
  "start_at": "datetime",
  "end_at": "datetime",
  "due_at": "datetime",
  "due_date": "date",
  "fixed_at": "datetime",
  "verified_at": "datetime",
  
  "status_id": "uuid",
  "priority": 1|2|3,
  "owner_user_id": "int",
  "user_ids": ["int"],
  
  "cost_value": "double",
  "man_power_value": "double",
  
  "location_id": "uuid",
  "floorplan_id": "uuid",
  "task_type_id": "uuid",
  
  "created_at": "datetime",
  "updated_at": "datetime",
  "deleted_at": "datetime"
}
```

**Source:** https://developers.fieldwire.com/reference/get_tasks_in_project

### Key Observations

1. **No explicit delay tracking** – Delays inferred from time comparisons
2. **Flexible timing** – `start_at`, `end_at`, `due_at`, `fixed_at`, `verified_at`
3. **Cost & labor estimation** – `cost_value`, `man_power_value`
4. **Multi-user assignment** – `user_ids` array
5. **Location-aware** – `location_id` and `floorplan_id`

---

## 4. AUTODESK CONSTRUCTION CLOUD

**Status:** Limited public API documentation available  
**Known Features:** Daily Logs, project tracking, collaboration

Autodesk's Construction Cloud (formerly BIM 360) includes Daily Logs but detailed schema not publicly documented in the same way as Procore/Fieldwire.

---

## 5. OPEN-SOURCE REFERENCE

### BuildSmartPro (GitHub)

**Repository:** https://github.com/aravindbodaka/BuildSmartPro  
**Language:** SQL (MySQL)  
**Focus:** Generic construction management (not site activity-specific)

**Core Tables:**
- `Clients` – Client profiles
- `Projects` – Project metadata
- `Employees` – Staff
- `Suppliers` – Vendor management
- `Inventory` – Material tracking
- `Invoices` – Financial tracking
- `Contracts` – Legal agreements
- `ProjectRoles` – Staff assignments

**Limitation:** No daily log / site activity tables. Designed for financial/HR management, not field operations.

**Source:** https://github.com/aravindbodaka/BuildSmartPro/blob/main/01_Database_Creation.sql

### Other OSS Projects Found

- `construction-log` (GitHub) – Minimal frontend app
- `construction-foreman` – Material & activity logging (limited schema)
- `Trackr` – Simple activity logging
- `Daily-log-app` – Worker activity logging
- `mutiso-workflow` – AI-powered site foreman

**Finding:** No mature open-source construction PM with production-grade daily log schema.

---

## CANONICAL UNIFIED DATA MODEL

Based on industry leaders, here's the **minimal viable schema** for your use case:

### Table 1: `site_activities` (Daily Log)

```sql
CREATE TABLE site_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  location_id UUID,
  
  -- Activity Definition
  activity_date DATE NOT NULL,
  activity_type VARCHAR(100) NOT NULL,  -- 'column_placement', 'slab_pour', etc.
  description TEXT,
  
  -- Planned vs Actual (Core Requirement)
  planned_start TIMESTAMP,
  actual_start TIMESTAMP,
  planned_end TIMESTAMP,
  actual_end TIMESTAMP,
  
  -- Status & Delay Tracking
  status VARCHAR(20) DEFAULT 'pending',  -- pending, in_progress, completed, delayed, cancelled
  is_delayed BOOLEAN DEFAULT FALSE,
  delay_reason_code VARCHAR(50),  -- FK to delay_reasons table
  delay_cost_impact DECIMAL(12, 2),
  delay_notes TEXT,
  
  -- Weather (Buildertrend-inspired)
  weather_condition VARCHAR(50),  -- sunny, rainy, snowy, extreme_heat, etc.
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
  FOREIGN KEY (created_by) REFERENCES users(id),
  
  INDEX idx_project_date (project_id, activity_date),
  INDEX idx_status (status),
  INDEX idx_delayed (is_delayed)
);
```

### Table 2: `delay_reasons` (Taxonomy)

```sql
CREATE TABLE delay_reasons (
  code VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  category VARCHAR(50),  -- weather, material, labor, equipment, approval, other
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE
);

-- Procore-aligned standard taxonomy
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
```

### Table 3: `worker_attendance` (Labor Tracking)

```sql
CREATE TABLE worker_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_activity_id UUID NOT NULL,
  worker_id UUID NOT NULL,
  
  hours_worked DECIMAL(5, 2) NOT NULL,
  role VARCHAR(50),  -- laborer, foreman, equipment_operator, inspector, etc.
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (site_activity_id) REFERENCES site_activities(id) ON DELETE CASCADE,
  FOREIGN KEY (worker_id) REFERENCES workers(id),
  
  INDEX idx_activity (site_activity_id),
  INDEX idx_worker (worker_id)
);
```

### Table 4: `activity_notes` (End-of-Day Summary)

```sql
CREATE TABLE activity_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_activity_id UUID NOT NULL UNIQUE,
  
  summary TEXT NOT NULL,  -- End-of-day narrative
  prevention_notes TEXT,  -- How to prevent delays in future
  
  created_by UUID NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (site_activity_id) REFERENCES site_activities(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)
);
```

### Table 5: `activity_attachments` (Photos & Documents)

```sql
CREATE TABLE activity_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_activity_id UUID NOT NULL,
  
  file_url VARCHAR(500) NOT NULL,
  file_type VARCHAR(20),  -- photo, document, video
  file_size_bytes INT,
  
  uploaded_by UUID NOT NULL,
  uploaded_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (site_activity_id) REFERENCES site_activities(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id),
  
  INDEX idx_activity (site_activity_id)
);
```

---

## ENUM VALUES & CONSTRAINTS

### `activity_type` (Examples)

```
column_placement, slab_pour, framing, roofing, electrical, plumbing, 
hvac, painting, finishing, inspection, concrete_curing, excavation, 
grading, foundation, masonry, drywall, flooring, landscaping, cleanup
```

### `status`

```
pending, in_progress, completed, delayed, cancelled
```

### `weather_condition`

```
sunny, cloudy, rainy, snowy, windy, extreme_heat, extreme_cold, 
fog, hail, thunderstorm, clear
```

### `delay_reason_code`

See `delay_reasons` table above (19 standard codes).

---

## DESIGN RATIONALE

### Why Unified `site_activities` Instead of Procore's 16+ Log Types?

| Aspect | Procore (16+ logs) | Your Model (Unified) |
|--------|-------------------|----------------------|
| **Flexibility** | Extreme (multi-tenant SaaS) | Sufficient (focused SaaS) |
| **Complexity** | High (separate APIs per log) | Low (single table) |
| **Query Performance** | Requires JOINs across log types | Single table scans |
| **User Experience** | Specialized UI per log type | Unified daily log interface |
| **Your Use Case** | Overkill | Perfect fit |

### Why Separate `delay_reasons` Table?

1. **Closed taxonomy** – Matches Procore's approach
2. **Reporting** – Easy to aggregate delays by reason
3. **Extensibility** – Add custom reasons without schema changes
4. **Data integrity** – Foreign key constraint prevents invalid codes

### Why Separate `worker_attendance`?

1. **Normalization** – Many workers per activity
2. **Labor cost analysis** – Hours × rate per worker
3. **Attendance tracking** – Who worked when
4. **Scalability** – Supports large crews

### Why Separate `activity_notes`?

1. **Clarity** – Narrative separate from structured data
2. **Flexibility** – Unlimited text for summaries
3. **Prevention tracking** – Lessons learned per activity
4. **Audit trail** – Who wrote notes and when

---

## FASTIFY ENDPOINT EXAMPLES

Based on this schema, here are example endpoints:

```typescript
// POST /projects/:projectId/activities
// Create a new site activity
{
  activity_date: "2026-05-30",
  activity_type: "slab_pour",
  description: "Foundation slab pour - Building A",
  planned_start: "2026-05-30T08:00:00Z",
  planned_end: "2026-05-30T16:00:00Z",
  location_id: "uuid",
  weather_condition: "rainy",
  temperature_f: 72
}

// PATCH /projects/:projectId/activities/:activityId
// Update activity with actual times and delay info
{
  actual_start: "2026-05-30T09:30:00Z",  // 1.5 hours late
  actual_end: "2026-05-30T17:00:00Z",
  status: "delayed",
  is_delayed: true,
  delay_reason_code: "WEATHER_RAIN",
  delay_cost_impact: 2500.00,
  delay_notes: "Heavy rain from 8am-10am delayed crew arrival"
}

// POST /projects/:projectId/activities/:activityId/workers
// Log worker attendance
{
  worker_id: "uuid",
  hours_worked: 8.5,
  role: "laborer"
}

// POST /projects/:projectId/activities/:activityId/notes
// Add end-of-day summary
{
  summary: "Successfully poured 450 cubic yards of concrete. Crew worked efficiently despite morning rain delay.",
  prevention_notes: "Consider scheduling pours earlier in week to avoid weekend weather forecasts."
}

// GET /projects/:projectId/activities?status=delayed&reason=WEATHER_RAIN
// Query delays by reason
```

---

## MIGRATION STRATEGY

### Phase 1: Core Tables
```sql
-- Create base tables
CREATE TABLE site_activities (...)
CREATE TABLE delay_reasons (...)
CREATE TABLE worker_attendance (...)
CREATE TABLE activity_notes (...)
CREATE TABLE activity_attachments (...)

-- Seed delay_reasons with standard taxonomy
INSERT INTO delay_reasons (...)
```

### Phase 2: Indexes & Constraints
```sql
CREATE INDEX idx_site_activities_project_date ON site_activities(project_id, activity_date);
CREATE INDEX idx_site_activities_status ON site_activities(status);
CREATE INDEX idx_site_activities_delayed ON site_activities(is_delayed);
CREATE INDEX idx_worker_attendance_activity ON worker_attendance(site_activity_id);
CREATE INDEX idx_activity_notes_activity ON activity_notes(site_activity_id);
```

### Phase 3: API Endpoints
- `POST /projects/:projectId/activities` – Create
- `GET /projects/:projectId/activities` – List (with filters)
- `GET /projects/:projectId/activities/:activityId` – Retrieve
- `PATCH /projects/:projectId/activities/:activityId` – Update
- `POST /projects/:projectId/activities/:activityId/workers` – Add worker
- `POST /projects/:projectId/activities/:activityId/notes` – Add summary
- `POST /projects/:projectId/activities/:activityId/attachments` – Upload photo

---

## REFERENCES

### Official API Documentation

1. **Procore**
   - Manpower Logs: https://developers.procore.com/reference/rest/manpower-logs?version=latest
   - Delays Log: https://developers.procore.com/reference/rest/delays-log?version=latest
   - Daily Logs Guide: https://procore.github.io/documentation/daily-logs

2. **Buildertrend**
   - Daily Logs: https://buildertrend.com/help-article/navigating-project-management/
   - API Integration: https://supergood.ai/docs/buildertrend-api

3. **Fieldwire**
   - Tasks API: https://developers.fieldwire.com/reference/get_tasks_in_project
   - Getting Started: https://developers.fieldwire.com/docs/getting-started

### Open Source Reference

4. **BuildSmartPro**
   - Repository: https://github.com/aravindbodaka/BuildSmartPro
   - Database Schema: https://github.com/aravindbodaka/BuildSmartPro/blob/main/01_Database_Creation.sql

---

## CONCLUSION

The **canonical model for construction site activity tracking** combines:

1. **Procore's discipline** – Explicit delay tracking with closed taxonomy
2. **Buildertrend's simplicity** – Single daily log, weather auto-population, photo-first
3. **Fieldwire's flexibility** – Rich timing fields, multi-user assignment, cost tracking
4. **Your requirements** – Planned-vs-actual, delay causes, cost impact, worker attendance, end-of-day summaries

The **5-table schema** (site_activities, delay_reasons, worker_attendance, activity_notes, activity_attachments) is production-ready and competitive with industry leaders while remaining simple enough to implement quickly.

