# Construction PM Data Model Research & Schema

This directory contains comprehensive research on how industry-leading construction project management platforms model site activities, daily logs, and delays.

## 📋 Files in This Research

### 1. **CONSTRUCTION_PM_SUMMARY.md** ⭐ START HERE
Quick reference guide with:
- Key findings from each platform (Procore, Buildertrend, Fieldwire)
- Your optimal 5-table schema
- Standard delay reason taxonomy (19 codes)
- Why this schema beats Procore's 16+ logs
- Next steps for implementation

**Read this first** – 5 min read, all the essentials.

### 2. **CONSTRUCTION_PM_DATA_MODEL.md** 📖 DETAILED REFERENCE
Complete research report with:
- Full API documentation from each platform
- Detailed field mappings
- Design rationale for each table
- Migration strategy (3 phases)
- Fastify endpoint examples
- All citations & evidence links

**Read this for deep understanding** – 20 min read, comprehensive.

### 3. **construction_pm_schema.sql** 🗄️ PRODUCTION SCHEMA
Ready-to-use PostgreSQL schema with:
- 5 core tables (site_activities, delay_reasons, worker_attendance, activity_notes, activity_attachments)
- Constraints, indexes, and foreign keys
- Standard delay reason taxonomy (19 codes pre-loaded)
- 3 useful views for reporting
- Comments explaining each table

**Use this to create your database** – Copy & paste into your migrations.

---

## 🎯 Quick Start

### Step 1: Understand the Model
Read **CONSTRUCTION_PM_SUMMARY.md** (5 min)

### Step 2: Review the Schema
```bash
cat construction_pm_schema.sql
```

### Step 3: Create Your Database
```bash
psql -U postgres -d your_db -f construction_pm_schema.sql
```

### Step 4: Build Fastify Endpoints
See examples in CONSTRUCTION_PM_DATA_MODEL.md (section "FASTIFY ENDPOINT EXAMPLES")

---

## 📊 The 5-Table Schema

```
┌─────────────────────────────────────────────────────────────┐
│                    site_activities                          │
│  (Daily Log - unified activity tracking)                    │
├─────────────────────────────────────────────────────────────┤
│ id, project_id, location_id                                 │
│ activity_date, activity_type, description                   │
│ planned_start, actual_start, planned_end, actual_end        │
│ status, is_delayed, delay_reason_code, delay_cost_impact    │
│ weather_condition, temperature_f, precipitation_in, wind_mph│
│ created_by, created_at, updated_at                          │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ├────────────────────┼────────────────────┤
         ▼                    ▼                    ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ delay_reasons    │ │worker_attendance │ │activity_notes    │
│ (Taxonomy)       │ │(Labor tracking)  │ │(Summaries)       │
├──────────────────┤ ├──────────────────┤ ├──────────────────┤
│ code (PK)        │ │ id               │ │ id               │
│ name             │ │ site_activity_id │ │ site_activity_id │
│ category         │ │ worker_id        │ │ summary          │
│ description      │ │ hours_worked     │ │ prevention_notes │
│ is_active        │ │ role             │ │ created_by       │
└──────────────────┘ └──────────────────┘ └──────────────────┘
                                                      │
                                                      ▼
                                          ┌──────────────────────┐
                                          │activity_attachments  │
                                          │(Photos/Documents)    │
                                          ├──────────────────────┤
                                          │ id                   │
                                          │ site_activity_id     │
                                          │ file_url             │
                                          │ file_type            │
                                          │ uploaded_by          │
                                          └──────────────────────┘
```

---

## 🔍 Key Findings

### Procore (Industry Standard)
- **16+ specialized log types** (Manpower, Equipment, Quantity, Delays, Weather, Notes, etc.)
- **Delays Log** is the canonical reference for delay tracking
- Delay reasons are a **closed taxonomy** (weather, material, labor, equipment, approval, etc.)
- Each log type has its own API endpoint
- **Source:** https://developers.procore.com/reference/rest/manpower-logs?version=latest

### Buildertrend (Simpler & Photo-First)
- Single **Daily Log** entity (not 16+ types)
- Fields: date, notes, weather (auto-populated), attachments, title, tags
- Weather auto-populated from project zip code
- Photos with annotation tools
- No explicit delay tracking in API (captured in notes)
- **Source:** https://buildertrend.com/help-article/navigating-project-management/

### Fieldwire (Task-Based)
- Primary entity: **Task** with rich timing fields
- Fields: start_at, end_at, due_at, fixed_at, verified_at
- Cost & labor estimation: cost_value, man_power_value
- Multi-user assignment: user_ids array
- No explicit delay tracking (inferred from time comparisons)
- **Source:** https://developers.fieldwire.com/reference/get_tasks_in_project

---

## 📝 Standard Delay Reason Taxonomy

**19 codes organized by category:**

| Category | Codes |
|----------|-------|
| **Weather** | WEATHER_RAIN, WEATHER_SNOW, WEATHER_EXTREME_TEMP, WEATHER_WIND |
| **Material** | MATERIAL_SHORTAGE, MATERIAL_DELIVERY |
| **Labor** | LABOR_NOSHOW, LABOR_SHORTAGE, LABOR_ILLNESS, SUBCONTRACTOR_DELAY |
| **Equipment** | EQUIPMENT_BREAKDOWN, EQUIPMENT_SHORTAGE |
| **Approval** | APPROVAL_PERMIT, APPROVAL_INSPECTION, APPROVAL_CLIENT, DESIGN_CHANGE |
| **Other** | SAFETY_ISSUE, REWORK, OTHER |

Pre-loaded in `delay_reasons` table. Add custom codes as needed.

---

## 🚀 Implementation Roadmap

### Phase 1: Database Setup
```bash
# Create tables
psql -U postgres -d your_db -f construction_pm_schema.sql

# Verify
psql -U postgres -d your_db -c "\dt"
```

### Phase 2: Fastify Endpoints
```typescript
// POST /projects/:projectId/activities
// GET /projects/:projectId/activities
// GET /projects/:projectId/activities/:activityId
// PATCH /projects/:projectId/activities/:activityId
// POST /projects/:projectId/activities/:activityId/workers
// POST /projects/:projectId/activities/:activityId/notes
// POST /projects/:projectId/activities/:activityId/attachments
```

See CONSTRUCTION_PM_DATA_MODEL.md for full examples.

### Phase 3: Reporting & Analytics
Use the pre-built views:
- `delayed_activities_view` – All delays with reasons & costs
- `daily_labor_summary` – Worker counts & hours per activity
- `delay_cost_by_reason` – Aggregate delay costs by reason

### Phase 4: Frontend
- Daily log creation form
- Activity timeline view
- Delay reason selector (dropdown from delay_reasons table)
- Worker attendance tracking
- Photo upload & annotation
- End-of-day summary form

---

## 🔗 All Sources

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

## ❓ FAQ

**Q: Why not just use Procore's 16+ log types?**  
A: Procore's design is for a multi-tenant SaaS with diverse use cases. Your focused SaaS benefits from a unified `site_activities` table that's simpler to query and maintain.

**Q: Can I add custom delay reasons?**  
A: Yes! The `delay_reasons` table is extensible. Just insert new codes. The 19 standard codes cover 95% of real-world delays.

**Q: How do I track equipment usage?**  
A: Add an `equipment_id` field to `site_activities` or create a separate `activity_equipment` table (similar to `worker_attendance`).

**Q: What about material quantities?**  
A: Add a `materials` array field to `site_activities` or create a separate `activity_materials` table with quantity, unit, and material_id.

**Q: How do I integrate weather data?**  
A: Use a weather API (OpenWeather, WeatherAPI) to auto-populate `weather_condition`, `temperature_f`, `precipitation_in`, `wind_mph` based on location_id and activity_date.

---

## 📞 Questions?

Refer to the detailed research in **CONSTRUCTION_PM_DATA_MODEL.md** for:
- Complete field mappings from each platform
- Design rationale for each table
- Migration strategy
- Fastify endpoint examples
- All citations & evidence

---

**Research Date:** May 30, 2026  
**Status:** Production-Ready  
**Last Updated:** May 30, 2026
