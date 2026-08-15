# Software Requirements Specification (SRS)

## in two seperate folders frontend and backend alonng with localhostmongodb

## Nexa Serve Web Application

**Version:** 1.0
**Date:** August 12, 2026
**Prepared for:** Nexa Serve Program Management

---

## 1. Introduction

### 1.1 Purpose

This document specifies the requirements for **Nexa Serve**, a web application built to manage community awareness field activities, track member/team attendance, and give management a clear, always-current view of whether ground activities are actually happening as planned. The system is designed to be **simple, lightweight, and easy for field employees to use**, while giving Super Admins full visibility into performance across all districts and teams.

### 1.2 Scope

Nexa Serve will:

- Manage a directory of **76 members** organized into **38 teams** across **4 districts**: **Nowshera, Peshawar, Charsadda, and Mardan**.
- Allow field staff to submit **activity records and attendance**, each backed by an **uploaded image with metadata** (timestamp, location/GPS if available, uploader, team, district).
- Provide a **Monitoring Dashboard** showing actual attendance/activities that occurred vs. what was scheduled/expected.
- Provide an **Admin Dashboard** showing performance statistics (per team, per district, per member).
- Provide a **Super Admin** view that aggregates all monitoring and performance data system-wide.
- Use **minimal styling** and a simple, low-friction interface so employees with limited technical skill can use it without training.

### 1.3 Intended Audience

- Field members/employees (data entry: activities, attendance, photos)
- Admins (district/team performance monitoring)
- Super Admin (organization-wide oversight)
- Developers/QA implementing the system

### 1.4 Definitions

| Term              | Meaning                                                                                                                             |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Member            | An individual field employee/volunteer, one of the 76 total                                                                         |
| Team              | A group of members; 38 teams total                                                                                                  |
| District          | A geographic/administrative grouping; 4 districts total: Nowshera, Peshawar, Charsadda, Mardan                                      |
| Activity          | A community awareness event/task carried out on the ground                                                                          |
| Attendance Record | Proof that a member/team was present and active on a given date                                                                     |
| Metadata          | Data attached to an image automatically or at upload time (timestamp, GPS coordinates, device info, uploader ID, team/district tag) |
| Super Admin       | Top-level user role with full visibility and control across all districts                                                           |

---

## 2. Overall Description

### 2.1 Product Perspective

Nexa Serve is a standalone web application (desktop and mobile browser friendly) used internally. It is not a public-facing product. It replaces manual/paper-based or WhatsApp-based reporting of field activity with a structured, verifiable digital record.

### 2.2 Product Goals

1. Make it easy and fast for a field employee to log an activity or attendance with a photo.
2. Make every submission independently verifiable (via metadata) so management can trust it reflects a real, on-the-ground event.
3. Give managers a single dashboard to see what happened vs. what should have happened.
4. Give Super Admin a bird's-eye view of performance across all 4 districts, 38 teams, and 76 members.
5. Keep the interface extremely simple — minimal styling, clear labels, few clicks — so non-technical employees adopt it without resistance.

### 2.3 User Classes and Characteristics

| Role                | Description                                                   | Technical Skill Assumed                 |
| ------------------- | ------------------------------------------------------------- | --------------------------------------- |
| **Member/Employee** | Submits activity + attendance with photo                      | Low — basic smartphone/browser use only |
| **Admin**           | Monitors performance per district/team; manages members/teams | Medium                                  |
| **Super Admin**     | Full visibility and control over all data, all districts      | Medium                                  |

### 2.4 Operating Environment

- Web application accessible via modern browsers (Chrome, Edge, Safari) on desktop and mobile.
- Responsive layout; mobile-first for field data entry since members will likely use phones on-site.
- Cloud or on-premise hosting (to be decided by implementation team); requires image storage (object storage/CDN) and a relational or document database.

### 2.5 Design and Implementation Constraints

- **UI must be minimal**: plain forms, simple tables, limited color/branding, no unnecessary animations or decorative elements — optimized for speed of use, not visual polish.
- Must work reasonably well on low/mid-range smartphones and average mobile data speeds (compress images, avoid heavy assets).
- Must support offline-tolerant upload retry where feasible (nice-to-have, not mandatory for v1).
- Must be built on the **MERN stack** (see Section 2.7) to keep the codebase consistent and maintainable with a single JavaScript/TypeScript language across front end and back end.

### 2.7 Technology Stack (MERN)

Nexa Serve will be built using the **MERN stack**:

| Layer              | Technology                                                       | Notes                                                                                                                                                                                                                     |
| ------------------ | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Database**       | MongoDB                                                          | Stores Districts, Teams, Members, ActivityRecords, AttendanceEntries, ImageMetadata, AuditLogs as collections. Document model fits the nested/relational-but-flexible data (e.g., activity + attendance + metadata) well. |
| **Backend/API**    | Express.js (on Node.js)                                          | REST API layer handling auth, role-based access control, CRUD for members/teams/districts, activity/attendance submission, image upload handling, dashboard aggregation queries.                                          |
| **Frontend**       | React.js                                                         | Single-page application; mobile-first, minimal-styling UI as described in Section 4.1. Role-based views (Member / Admin / Super Admin) rendered from the same codebase.                                                   |
| **Runtime**        | Node.js                                                          | Powers the Express backend; also used for build tooling.                                                                                                                                                                  |
| **Image Storage**  | Object storage (e.g., cloud bucket) accessed via Node.js backend | Actual image files stored outside MongoDB; MongoDB stores only metadata + file URL/reference, to keep the database lightweight.                                                                                           |
| **Authentication** | JWT-based session auth via Express middleware                    | Enforces role-based access (Member, Admin, Super Admin) on both API routes and React route guards.                                                                                                                        |

**Rationale:** MERN keeps the entire stack in JavaScript, which simplifies development and maintenance for a small internal tool, allows fast iteration, and has strong community support for common needs here (image upload handling, geolocation capture, dashboard charting libraries like Chart.js/Recharts in React).

### 2.6 Assumptions and Dependencies

- Members have access to a smartphone or computer with a camera/photo library and internet access.
- District, team, and member lists are relatively stable (occasional additions/edits expected, not high churn).
- GPS/location metadata availability depends on device/browser permissions; system must degrade gracefully if unavailable (still accept the image, flag location as "not captured").

---

## 3. System Features

### 3.1 User & Organization Management

**Description:** Maintain the structure of members, teams, and districts.

**Requirements:**

- FR-1.1: System shall support CRUD (create/read/update/deactivate) for Members, Teams, and Districts.
- FR-1.1a: Initial member onboarding shall be done by the **Admin of the respective district** — i.e., each district's Admin adds/registers the members belonging to their own district (not a single central bulk upload by Super Admin). Super Admin retains the ability to add/edit any member in any district if needed, but the standard flow is district Admin → their own district's members.
- FR-1.2: Each Member shall belong to exactly one Team; each Team shall belong to exactly one District.
- FR-1.2a: Each Team shall consist of exactly **two Members** (pairs). Admins create teams by pairing up two members within their district; the system shall prevent a team from being saved with more or fewer than two members.
- FR-1.3: System shall support the current baseline structure: 76 members, 38 teams, and 4 districts (**Nowshera, Peshawar, Charsadda, Mardan**), and allow this to grow/change over time.
- FR-1.4: Each Member shall have a role: Member, Admin, or Super Admin.
- FR-1.5: Admins can only manage members/teams within their assigned district(s); Super Admin has access across all districts.
- FR-1.6: When an Admin creates or updates a team pairing, each of the two members shall automatically see who their teammate is from their own panel (see FR-2.7).

### 3.2 Activity & Attendance Submission (with Image Metadata)

**Description:** The core data-entry feature used by field employees to log that a community awareness activity happened.

**Requirements:**

- FR-2.1: A Member shall be able to create an **Activity Record** containing:
  - Date and time of activity
  - Team and District (auto-filled from logged-in user, editable by Admin only)
  - Activity type/category (e.g., awareness session, door-to-door visit, event) — configurable list
  - Short description/notes (optional, free text)
  - One or more **photos** as evidence
  - List of attendees (select from team member list) — this forms the **Attendance Record**
- FR-2.2: For every uploaded photo, the system shall automatically capture and store metadata:
  - Upload timestamp (server-side, authoritative)
  - Device/EXIF timestamp (if available)
  - GPS coordinates (if available/permitted)
  - Uploading member's ID, team, and district
  - File size/type (for basic integrity checks)
- FR-2.3: If GPS/EXIF metadata is not available, the system shall still accept the submission but flag it as "location not verified" for review.
- FR-2.4: System shall prevent obviously duplicate/re-used images (e.g., checksum match against previously submitted images) and flag duplicates for Admin review rather than silently rejecting them.
- FR-2.5: Submissions shall be timestamped server-side to prevent backdating; edits after submission shall be logged (who/when/what changed).
- FR-2.6: Each activity/attendance submission shall have a status: **Submitted → Verified → Flagged** (Admin/Super Admin can verify or flag a record as suspicious, e.g., mismatched location, no photo, image reused).
- FR-2.7: Each Member's panel shall include a simple **"My Team"** view showing their teammate's name and basic contact info (e.g., phone/email, if stored), so members always know who they are paired with. Since a Member's own activity/attendance submissions are naturally shared with their teammate (same team), this view mainly serves as a quick, always-visible reference to "who am I working with."

### 3.3 Monitoring Dashboard

**Description:** Shows what attendance/activity actually occurred versus what was expected, so gaps are visible.

**Requirements:**

- FR-3.1: Dashboard shall show, per Team and per District: number of activities expected (based on schedule/target) vs. number actually logged, over a selectable date range.
- FR-3.2: Dashboard shall show attendance rate per Team/District/Member over time.
- FR-3.3: Dashboard shall visually flag Teams/Districts that are under-performing (e.g., missed scheduled activities, low attendance, high number of flagged/unverified submissions).
- FR-3.4: Dashboard shall allow drill-down from District → Team → Member → individual Activity Record (with photo + metadata).
- FR-3.5: Dashboard shall support basic filters: date range, district, team, activity type, status (verified/flagged/pending).
- FR-3.6: Dashboard shall be viewable by Admins (scoped to their district) and Super Admin (all districts).

### 3.4 Admin Dashboard (Performance Stats)

**Description:** Aggregated performance metrics for Admins to manage their district(s).

**Requirements:**

- FR-4.1: Show per-team performance: submission consistency, attendance %, number of flagged records, activity frequency over time.
- FR-4.2: Show per-member performance: participation count, attendance %, any flags against their submissions.
- FR-4.3: Provide simple trend charts (e.g., activities per week/month) — kept visually simple (basic bar/line charts, no heavy design).
- FR-4.4: Allow Admin to export reports (CSV/PDF) for a selected date range/team/district.
- FR-4.5: Allow Admin to verify or flag submitted records within their district.

### 3.5 Super Admin Oversight

**Description:** Full, organization-wide monitoring and control layer.

**Requirements:**

- FR-5.1: Super Admin shall see all data from the Monitoring Dashboard and Admin Dashboard, unscoped, across all 4 districts, 38 teams, and 76 members.
- FR-5.2: Super Admin shall have a summary/overview screen showing organization-wide KPIs: total activities logged (this week/month), overall attendance rate, number of flagged records needing review, district-by-district comparison.
- FR-5.3: Super Admin shall be able to manage Admin accounts and district assignments.
- FR-5.4: Super Admin shall be able to override/resolve flagged records (mark verified, mark invalid, request resubmission).
- FR-5.5: Super Admin actions (approvals, overrides, account changes) shall be logged in an audit trail.

### 3.6 Notifications (Recommended)

- FR-6.1: System should notify Admins when a team misses an expected activity or when a record is flagged.
- FR-6.2: System should notify Super Admin of district-level anomalies (e.g., a district with no activity for X days).

---

## 4. External Interface Requirements

### 4.1 User Interface

- **Design principle: simplicity first.** Plain forms, large touch-friendly buttons for mobile, minimal color palette (1 primary color + neutral grays), no decorative graphics, clear text labels over icons where ambiguity is possible.
- Navigation limited to a few clear sections: **Submit Activity | My Team | Dashboard (role-based) | Admin (if applicable)**.
- Image upload flow must be at most 2–3 steps (select/take photo → confirm details → submit).
- Tables/dashboards use simple grids and basic charts (bar/line/pie) — no complex data-viz libraries requiring heavy load times.

### 4.2 Hardware Interfaces

- Uses device camera (via browser file/camera input) and GPS (via browser geolocation API), where permitted.

### 4.3 Software Interfaces

- **REST API built with Express.js/Node.js**, consumed by the React frontend.
- **MongoDB** as the primary data store, accessed via the Node.js/Express backend (e.g., using Mongoose or the native driver).
- Image storage service/CDN for photo storage (referenced from MongoDB via file URL).
- Optional: SMS/Email/push notification service for alerts.
- Optional future integration: mapping API to visualize activity locations on a map.

---

## 5. Data Model (High-Level Entities — MongoDB Collections)

- **District**: id, name (Nowshera / Peshawar / Charsadda / Mardan), admin(s) assigned
- **Team**: id, name, district_id, member_ids (exactly 2)
- **Member**: id, name, contact, role, team_id
- **ActivityRecord**: id, team_id, district_id, submitted_by, date_time, activity_type, description, status (submitted/verified/flagged)
- **AttendanceEntry**: id, activity_record_id, member_id, present (bool)
- **ImageMetadata**: id, activity_record_id, file_url, upload_timestamp, exif_timestamp, gps_lat, gps_long, checksum, location_verified (bool)
- **AuditLog**: id, actor_id, action, target_entity, timestamp

---

## 6. Non-Functional Requirements

| Category           | Requirement                                                                                                                                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Usability**      | Must be usable by an employee with minimal digital literacy after a single short walkthrough; minimal styling, plain language, mobile-first.                                                                                    |
| **Performance**    | Activity submission (including photo upload) should complete within a few seconds on average mobile data; dashboards should load key metrics within 2–3 seconds for current data volumes (76 members / 38 teams / 4 districts). |
| **Scalability**    | Should comfortably scale to several times current volume (e.g., 500+ members) without redesign.                                                                                                                                 |
| **Security**       | Role-based access control; Admins scoped to their district; Super Admin unrestricted; all uploads and edits logged.                                                                                                             |
| **Data Integrity** | Server-side timestamps; checksum-based duplicate image detection; immutable audit trail for verification/flagging actions.                                                                                                      |
| **Availability**   | Should be available during working hours at minimum; target uptime ~99% for a v1 internal tool.                                                                                                                                 |
| **Compatibility**  | Must work on common mobile browsers (Chrome/Safari on Android/iOS) and desktop browsers.                                                                                                                                        |

---

## 7. Roles & Permissions Summary

| Feature                            | Member | Admin             | Super Admin |
| ---------------------------------- | ------ | ----------------- | ----------- |
| Submit activity/attendance         | ✅     | ✅                | ✅          |
| View own team's records            | ✅     | ✅                | ✅          |
| View own teammate (My Team)        | ✅     | ✅                | ✅          |
| View district monitoring dashboard | ❌     | ✅ (own district) | ✅ (all)    |
| View admin performance dashboard   | ❌     | ✅ (own district) | ✅ (all)    |
| Verify/flag records                | ❌     | ✅ (own district) | ✅ (all)    |
| Manage members/teams               | ❌     | ✅ (own district) | ✅ (all)    |
| Manage Admin accounts              | ❌     | ❌                | ✅          |
| View audit logs                    | ❌     | Limited           | ✅ (full)   |

---

## 8. Assumptions & Constraints

- Initial scale is fixed at 76 members / 38 teams / 4 districts (**Nowshera, Peshawar, Charsadda, Mardan**) but the system must not hard-code these numbers or names — districts must remain a manageable entity, not a fixed enum, in case of future expansion.
- v1 prioritizes simplicity and reliability of data capture over advanced analytics or design polish.
- Development will follow the **MERN stack** (MongoDB, Express, React, Node.js) as specified in Section 2.7.
- Advanced features (offline mode, map visualization, automated anomaly detection) are recommended as **future enhancements**, not required for v1.

## 9. Future Enhancements (Out of Scope for v1)

- Map-based visualization of activity locations.
- Automated AI-based image verification (e.g., detecting staged/reused photos).
- Offline-first mobile app with sync.
- Automated scheduling and reminders for expected activities.

---

_End of Document_
