# Construction PM Data Model - Quick Summary

## What You Need to Know

### 1. **Procore is the Industry Standard**
- Uses **16+ specialized log types** (Manpower, Equipment, Quantity, Delays, Weather, Notes, etc.)
- **Delays Log** is the canonical reference for delay tracking
- Delay reasons are a **closed taxonomy** (weather, material, labor, equipment, approval, etc.)
- Each log type has its own API endpoint

**Evidence:** https://developers.procore.com/reference/rest/manpower-logs?version=latest

### 2. **Buildertrend is Simpler & Photo-First**
- Single **Daily Log** entity (not 16+ types)
- Fields: date, notes, weather (auto-populated), attachments, title, tags
- Weather auto-populated from project zip code
- Photos with annotation tools
- No explicit delay tracking in API (captured in notes)

**Evidence:** https://buildertrend.com/help-article/navigating-project-management/

### 3. **Fieldwire Uses Tasks (Not Daily Logs)**
- Primary entity: **Task** with rich timing fields
- Fields: start_at, end_at, due_at, fixed_at, verified_at
- Cost & labor estimation: cost_value, man_power_value
- Multi-user assignment: user_ids array
- No explicit delay tracking (inferred from time comparisons)

**Evidence:** https://developers.fieldwire.com/reference/get_tasks_in_project

### 4. **Your Optimal Schema (5 Tables)**

```
site_activities
├── id, project_id, location_id
├── activity_date, activity_type, description
├── planned_start, actual_start, planned_end, actual_end
├── status, is_delayed, delay_reason_code, delay_cost_impact
├── weather_condition, temperature_f, precipitation_in, wind_mph
└── created_by, created_at, updated_at

delay_reasons (Taxonomy)
├── code (PK)
├── name, category, description
└── is_active

worker_attendance
├── id, site_activity_id, worker_id
├── hours_worked, role
└── created_at

activity_notes
├── id, site_activity_id
├── summary, prevention_notes
└── created_by, created_at

activity_attachments
├── id, site_activity_id
├── file_url, file_type, file_size_bytes
└── uploaded_by, uploaded_at
```

### 5. **Standard Delay Reason Taxonomy (19 Codes)**

**Weather:**
- WEATHER_RAIN, WEATHER_SNOW, WEATHER_EXTREME_TEMP, WEATHER_WIND

**Material:**
- MATERIAL_SHORTAGE, MATERIAL_DELIVERY

**Labor:**
- LABOR_NOSHOW, LABOR_SHORTAGE, LABOR_ILLNESS, SUBCONTRACTOR_DELAY

**Equipment:**
- EQUIPMENT_BREAKDOWN, EQUIPMENT_SHORTAGE

**Approval:**
- APPROVAL_PERMIT, APPROVAL_INSPECTION, APPROVAL_CLIENT, DESIGN_CHANGE

**Other:**
- SAFETY_ISSUE, REWORK, OTHER

### 6. **Why This Schema Beats Procore's 16+ Logs**

| Aspect | Procore | Your Model |
|--------|---------|-----------|
| Complexity | High (separate APIs) | Low (single table) |
| Query Performance | Requires JOINs | Single table scans |
| User Experience | Specialized UI per log | Unified daily log |
| Your Use Case | Overkill | Perfect fit |

### 7. **Key Design Decisions**

1. **Unified `site_activities`** – Combines Manpower + Equipment + Quantity + Notes
2. **Separate `delay_reasons`** – Closed taxonomy for reporting & integrity
3. **Separate `worker_attendance`** – Normalizes many-to-many (activity → workers)
4. **Separate `activity_notes`** – Narrative + prevention lessons learned
5. **Separate `activity_attachments`** – Photos/documents (Buildertrend-inspired)

### 8. **Fastify Endpoints (Example)**

```
POST   /projects/:projectId/activities
GET    /projects/:projectId/activities?status=delayed&reason=WEATHER_RAIN
GET    /projects/:projectId/activities/:activityId
PATCH  /projects/:projectId/activities/:activityId
POST   /projects/:projectId/activities/:activityId/workers
POST   /projects/:projectId/activities/:activityId/notes
POST   /projects/:projectId/activities/:activityId/attachments
```

---

## Full Report

See `CONSTRUCTION_PM_DATA_MODEL.md` for:
- Complete API documentation from each platform
- Full SQL schema with constraints & indexes
- Migration strategy (3 phases)
- Enum values & constraints
- Design rationale for each table
- All citations & evidence links

---

## Next Steps

1. **Review the schema** – Does it match your user's needs?
2. **Create migrations** – Use the SQL in the full report
3. **Build Fastify endpoints** – CRUD operations on site_activities
4. **Add filtering** – By status, delay_reason, date range, location
5. **Implement reporting** – Delay patterns, labor hours, cost impact

---

**Research Date:** May 30, 2026  
**Sources:** Procore, Buildertrend, Fieldwire, BuildSmartPro (GitHub)
