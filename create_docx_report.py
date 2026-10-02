import os
import docx
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

def create_report():
    doc = Document()

    # Define Palette
    COLOR_PRIMARY = RGBColor(30, 58, 138)     # Navy #1E3A8A
    COLOR_SECONDARY = RGBColor(5, 150, 105)   # Emerald #059669
    COLOR_TEXT = RGBColor(51, 65, 85)         # Slate Dark #334155
    COLOR_MUTED = RGBColor(100, 116, 139)     # Slate Muted #64748B
    HEX_PRIMARY = "1E3A8A"
    HEX_LIGHT_BG = "F8FAFC"
    HEX_BORDER = "CBD5E1"
    HEX_CALLOUT_BG = "F1F5F9"
    HEX_CALLOUT_BORDER = "2563EB"

    # Set page margins
    sections = doc.sections
    for section in sections:
        section.top_margin = Inches(0.9)
        section.bottom_margin = Inches(0.9)
        section.left_margin = Inches(0.9)
        section.right_margin = Inches(0.9)

    # Base Normal Style
    normal_style = doc.styles['Normal']
    normal_style.font.name = 'Calibri'
    normal_style.font.size = Pt(11)
    normal_style.font.color.rgb = COLOR_TEXT
    normal_style.paragraph_format.line_spacing = 1.15
    normal_style.paragraph_format.space_after = Pt(6)

    # Helper Functions
    def add_title(text):
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(4)
        run = p.add_run(text)
        run.font.name = 'Calibri'
        run.font.size = Pt(24)
        run.font.bold = True
        run.font.color.rgb = COLOR_PRIMARY
        return p

    def add_subtitle(text):
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_after = Pt(18)
        run = p.add_run(text)
        run.font.name = 'Calibri'
        run.font.size = Pt(13)
        run.font.italic = True
        run.font.color.rgb = COLOR_MUTED
        return p

    def add_h1(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(16)
        p.paragraph_format.space_after = Pt(6)
        p.paragraph_format.keep_with_next = True
        run = p.add_run(text)
        run.font.name = 'Calibri'
        run.font.size = Pt(18)
        run.font.bold = True
        run.font.color.rgb = COLOR_PRIMARY
        return p

    def add_h2(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(12)
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.keep_with_next = True
        run = p.add_run(text)
        run.font.name = 'Calibri'
        run.font.size = Pt(14)
        run.font.bold = True
        run.font.color.rgb = COLOR_SECONDARY
        return p

    def add_h3(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(8)
        p.paragraph_format.space_after = Pt(3)
        p.paragraph_format.keep_with_next = True
        run = p.add_run(text)
        run.font.name = 'Calibri'
        run.font.size = Pt(12)
        run.font.bold = True
        run.font.color.rgb = COLOR_PRIMARY
        return p

    def add_body(text, bold_prefix="", italic=False):
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(6)
        if bold_prefix:
            r_pre = p.add_run(bold_prefix)
            r_pre.font.bold = True
            r_pre.font.color.rgb = COLOR_TEXT
        r_text = p.add_run(text)
        r_text.font.italic = italic
        r_text.font.color.rgb = COLOR_TEXT
        return p

    def add_bullet(text, bold_prefix="", level=0):
        p = doc.add_paragraph(style='List Bullet')
        p.paragraph_format.space_after = Pt(3)
        p.paragraph_format.left_indent = Inches(0.25 * (level + 1))
        if bold_prefix:
            r_pre = p.add_run(bold_prefix)
            r_pre.font.bold = True
            r_pre.font.color.rgb = COLOR_TEXT
        r_text = p.add_run(text)
        r_text.font.color.rgb = COLOR_TEXT
        return p

    def add_callout(text, title=""):
        tbl = doc.add_table(rows=1, cols=1)
        tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
        cell = tbl.cell(0, 0)
        cell.width = Inches(6.7)

        # Set shading & borders
        tcPr = cell._tc.get_or_add_tcPr()
        shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{HEX_CALLOUT_BG}"/>')
        tcPr.append(shd)

        borders = parse_xml(f'''
            <w:tcBorders {nsdecls("w")}>
                <w:top w:val="none"/>
                <w:left w:val="single" w:sz="36" w:space="0" w:color="{HEX_CALLOUT_BORDER}"/>
                <w:bottom w:val="none"/>
                <w:right w:val="none"/>
            </w:tcBorders>
        ''')
        tcPr.append(borders)

        p = cell.paragraphs[0]
        p.paragraph_format.space_before = Pt(4)
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.left_indent = Inches(0.1)
        p.paragraph_format.right_indent = Inches(0.1)

        if title:
            r_title = p.add_run(title + "\n")
            r_title.font.bold = True
            r_title.font.size = Pt(11)
            r_title.font.color.rgb = COLOR_PRIMARY

        r_text = p.add_run(text)
        r_text.font.size = Pt(10.5)
        r_text.font.italic = True
        r_text.font.color.rgb = COLOR_TEXT

        doc.add_paragraph().paragraph_format.space_after = Pt(4)

    def style_table(table, col_widths, headers, data):
        table.alignment = WD_TABLE_ALIGNMENT.CENTER

        # Header Row
        hdr_cells = table.rows[0].cells
        for i, h in enumerate(headers):
            hdr_cells[i].text = h
            hdr_cells[i].width = Inches(col_widths[i])
            p = hdr_cells[i].paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            p.paragraph_format.space_before = Pt(4)
            p.paragraph_format.space_after = Pt(4)
            for run in p.runs:
                run.font.bold = True
                run.font.color.rgb = RGBColor(255, 255, 255)
                run.font.size = Pt(10)
            tcPr = hdr_cells[i]._tc.get_or_add_tcPr()
            shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{HEX_PRIMARY}"/>')
            tcPr.append(shd)

        # Data Rows
        for r_idx, row_data in enumerate(data):
            row_cells = table.add_row().cells
            bg_color = HEX_LIGHT_BG if r_idx % 2 == 1 else "FFFFFF"
            for c_idx, cell_value in enumerate(row_data):
                row_cells[c_idx].text = str(cell_value)
                row_cells[c_idx].width = Inches(col_widths[c_idx])
                p = row_cells[c_idx].paragraphs[0]
                p.alignment = WD_ALIGN_PARAGRAPH.LEFT
                p.paragraph_format.space_before = Pt(3)
                p.paragraph_format.space_after = Pt(3)
                for run in p.runs:
                    run.font.size = Pt(9.5)
                    run.font.color.rgb = COLOR_TEXT
                tcPr = row_cells[c_idx]._tc.get_or_add_tcPr()
                shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{bg_color}"/>')
                tcPr.append(shd)
                borders = parse_xml(f'''
                    <w:tcBorders {nsdecls("w")}>
                        <w:top w:val="single" w:sz="4" w:space="0" w:color="{HEX_BORDER}"/>
                        <w:left w:val="none"/>
                        <w:bottom w:val="single" w:sz="4" w:space="0" w:color="{HEX_BORDER}"/>
                        <w:right w:val="none"/>
                    </w:tcBorders>
                ''')
                tcPr.append(borders)

        doc.add_paragraph().paragraph_format.space_after = Pt(6)

    # ==================== DOCUMENT CONTENT ====================

    # Title & Metadata
    add_title("KPHCIP field community engagement Web Application")
    add_subtitle("Comprehensive System Functionality & Executive Operations Report\nKP Health Infrastructure & Capacity Improvement Program (KP HCIP)")

    add_callout(
        "This document provides a non-technical functional report of the KPHCIP field community engagement Web Application. "
        "It outlines the core purpose of the system, step-by-step submission processes, evidence verification workflows, "
        "and detailed explanations of all user panels including Admin, Executive, Social Mobilizer, District Coordinator, GRM Focal Person, and TL/DTL Reviewer panels.",
        "Executive Summary & Scope Note"
    )

    # Section 1: Application Purpose & Overview
    add_h1("1. Application Purpose & Core Objective")
    add_body(
        "KPHCIP field community engagement is an integrated, role-based field activity management and monitoring platform designed for the KP Health Infrastructure & Capacity Improvement Program (KP HCIP). "
        "The application digitizes community awareness activities, healthcare facility monitoring, capacity building sessions, and grievance tracking across target districts (Nowshera, Peshawar, Charsadda, and Mardan)."
    )
    add_body(
        "The primary goal of KPHCIP field community engagement is to replace manual paper reporting and fragmented messaging channels with an auditable digital record. "
        "It connects field workers directly with program leadership, providing real-time visibility into whether planned field activities are occurring as scheduled, with what participation levels, and under what quality standard."
    )

    add_h2("Key Operational Highlights:")
    add_bullet("Streamlined data entry tailored for field staff using mobile devices.", "Field-First Operations: ")
    add_bullet("Every activity submission requires live photographic evidence with browser GPS geolocation and server-side verification.", "Verifiable Submissions: ")
    add_bullet("Submissions are matched directly against monthly and weekly assigned targets.", "Planned Target Alignment: ")
    add_bullet("Role-tailored dashboards provide custom views for Field Mobilizers, District Coordinators, GRM Officers, TL/DTL Reviewers, Admins, and Executive Leadership.", "Multi-Tiered Oversight: ")

    # Section 2: User Roles & Panel Architecture
    add_h1("2. System Architecture & Role-Based Panels")
    add_body(
        "KPHCIP field community engagement is organized into distinct panels according to organizational roles. Each user role is automatically routed to its dedicated workspace upon logging in."
    )

    headers_roles = ["User Role", "System Panel", "Primary Focus & Scope"]
    widths_roles = [1.8, 1.8, 3.1]
    data_roles = [
        ["Social Mobilizer", "Mobilizer Panel", "Submit field awareness activities, track 2-member team assignments, and view submission history."],
        ["District Coordinator", "Coordinator Panel", "Submit district environmental/safeguarding activities & complete multi-section DCMO monitoring visit checklists."],
        ["GRM Focal Person", "GRM Panel", "Submit grievance capacity building events (PCMC & HMC) and track district grievance activities."],
        ["TL / DTL Reviewer", "Reviewer Panel", "Inspect submitted DCMO monitoring visit checklists, evaluate quality scores, provide remarks, and approve/reject records."],
        ["Super Admin", "Admin Panel", "Manage users, team pairings, district setups, assign monthly target plans, moderate flagged evidence, and view system audit logs."],
        ["Executive Official", "Executive Panel", "Access high-level analytics, participant demographics, district performance leaderboards, and export official Excel reports."]
    ]
    tbl_roles = doc.add_table(rows=1, cols=3)
    style_table(tbl_roles, widths_roles, headers_roles, data_roles)

    # Section 3: Detailed Panel Explanations
    add_h1("3. Detailed Explanation of System Panels & Displays")

    # 3.1 Social Mobilizer Panel
    add_h2("3.1 Social Mobilizer Panel (Field Member View)")
    add_body(
        "The Social Mobilizer Panel is designed for field staff conducting ground-level community engagements. "
        "Mobilizers operate in 2-person paired teams within designated districts."
    )
    add_h3("Core Functionalities & Workflows:")
    add_bullet("Mobilizers log activities by selecting an assigned health facility or community location. They select from predefined activity types: Community engagement session, Behavioural change and communication (BCC) campaign, or Wash & health hygiene in schools.", "Activity Submission Form: ")
    add_bullet("For BCC campaigns, both paired team members are mandatory attendees. For other sessions, individual attendance can be checked.", "Team Attendance Capture: ")
    add_bullet("Submissions must fulfill an active weekly plan created by the Admin. Unfulfilled planned weeks are selected from a dropdown.", "Weekly Plan Alignment: ")
    add_bullet("Captures male and female participant numbers, target group (e.g., mothers, elders, students), expected output, visit status (Pending, In Progress, Completed, Deferred/Rescheduled), and optional remarks.", "Demographics & Metrics: ")
    add_bullet("Members can capture photos directly via phone camera or upload existing images. The system automatically fetches browser GPS coordinates to verify location.", "Photo Evidence & Geolocation: ")
    add_bullet("Displays assigned teammate contact information (Name, Email, Phone) and team details.", "My Team Screen: ")
    add_bullet("Lists past team submissions with real-time status indicators (Submitted, Verified, Flagged, Absent).", "My Team's Activities Screen: ")

    # 3.2 District Coordinator Panel
    add_h2("3.2 District Coordinator Panel (DCMO View)")
    add_body(
        "The District Coordinator Panel empowers District Coordinators and District Monitoring Officers (DCMO) to record specialized environmental activities and perform rigorous monitoring visits."
    )
    add_h3("Core Functionalities & Displays:")
    add_bullet("Allows coordinators to log activities for 'Environmental awareness & HCWM' (Healthcare Waste Management) and 'SEA/SH' (Sexual Exploitation & Abuse / Sexual Harassment), with an option to mark sessions as Refresher Trainings.", "Coordinator Activity Submission: ")
    add_bullet("Coordinators fill out a comprehensive 10-section monitoring checklist when conducting supervisory site visits:", "DCMO Monitoring Visit Checklist: ")
    add_bullet("Select assigned monitoring plan, week, facility, and UC/Village.", "1. Header & Plan Linkage: ", 1)
    add_bullet("Evaluate session plan availability, venue safety, IEC material display, and equipment.", "2. Preparation & Logistics: ", 1)
    add_bullet("Assess introductory clarity, key message delivery accuracy, participatory methods, and summary.", "3. Session Delivery & Quality: ", 1)
    add_bullet("Record register completion, total & female attendance, >=50% female participation check, and arrangements for women.", "4. Attendance & Inclusion: ", 1)
    add_bullet("Verify code of conduct compliance, respectful behavior, non-political messaging, and photo consent.", "5. Safeguarding & Conduct: ", 1)
    add_bullet("Activity-specific criteria tailored to the observed activity type.", "6. Activity-Specific Checklist: ", 1)
    add_bullet("Inspect GRM complaint box presence, community awareness, and document active complaints.", "7. Grievance Redress (GRM) Check: ", 1)
    add_bullet("Checklist of collected proof (attendance lists, handouts) + compulsory upload of minimum 3 evidence photos.", "8. Evidence & Photos: ", 1)
    add_bullet("Select overall rating (Excellent, Good, Satisfactory, Needs Improvement, Poor), record key strengths and gaps, and define corrective action plans with follow-up dates.", "9. Overall Rating & Action Plan: ", 1)
    add_bullet("Official sign-off with DCMO Name and Date.", "10. Certification & Sign-off: ", 1)

    # 3.3 GRM Focal Person Panel
    add_h2("3.3 GRM Focal Person Panel")
    add_body(
        "Dedicated to Grievance Redress Mechanism (GRM) operations, this panel focuses on strengthening grievance channels and community feedback loops."
    )
    add_h3("Core Functionalities & Displays:")
    add_bullet("Dedicated data entry for 'GRM capacity building of PCMC & HMC' (Primary Health Care Management Committee & Health Management Committee).", "GRM Activity Submission: ")
    add_bullet("Supports refresher training tagging, facility selection, catchment area documentation, male/female attendance counts, target group capture, and mandatory photo evidence with GPS.", "Submission Details: ")
    add_bullet("A clean historical table displaying all GRM activities submitted across the district with verification status.", "GRM Activity Tracker: ")

    # 3.4 Team Lead / Deputy Team Lead (TL / DTL) Reviewer Panel
    add_h2("3.4 Team Lead / Deputy Team Lead (TL / DTL) Reviewer Panel")
    add_body(
        "The Reviewer Panel acts as the quality assurance gateway for monitoring visit checklists submitted by District Coordinators."
    )
    add_h3("Core Functionalities & Displays:")
    add_bullet("Organized into three tabs: 'Pending My Review', 'My Reviewed Records', and 'All Records'.", "Review Management Dashboard: ")
    add_bullet("Displays Date, District, Facility, UC/Village, District Coordinator, Target Mobilizer, Score Percentage (color-coded: Green >=80%, Orange 60-79%, Red <60%), and current Review Status.", "Inspection Table: ")
    add_bullet("Opens a full modal showing all 10 checklist sections, safeguarding scores, participant numbers, and attached evidence photos.", "Detailed Checklist Preview: ")
    add_bullet("Reviewers submit formal evaluations with Reviewer Name, Date, Acceptance Status (Accepted/Complete, Needs Revision, N/A), and detailed Reviewer Remarks.", "Review Sign-Off Modal: ")

    # 3.5 Admin Panel
    add_h2("3.5 Admin Panel (Super Admin Control Center)")
    add_body(
        "The Admin Panel is the administrative control center accessible to Super Admins, providing complete governance over users, structure, targets, and system integrity."
    )
    add_h3("Core Management Sub-Modules (Tabs):")
    add_bullet("Create, edit, reset passwords, or delete Social Mobilizers.", "1. Social Mobilizers: ")
    add_bullet("Pair mobilizers into 2-person teams and assign them to districts.", "2. Teams: ")
    add_bullet("Define target districts (Nowshera, Peshawar, Charsadda, Mardan) and set GRM Focal Person passwords.", "3. Districts: ")
    add_bullet("Create and manage District Coordinator accounts per district with password controls.", "4. District Coordinators: ")
    add_bullet("Create and activate/deactivate Executive Official accounts.", "5. Executive Officials: ")
    add_bullet("Assign monthly target counts and weekly activity schedules for Mobilizer Teams.", "6. Mobilizer Plans: ")
    add_bullet("Assign monthly target activity schedules for District Coordinators.", "7. Coordinator Plans: ")
    add_bullet("Assign monthly monitoring visit plans pairing target mobilizers with DCMO visit schedules.", "8. Monitoring Visit Plans: ")
    add_bullet("Assign monthly capacity building target schedules for GRM Focal Persons.", "9. GRM Plans: ")
    add_bullet("High-level system statistics and activity metrics across all districts.", "10. Overview: ")
    add_bullet("Immutable record of system actions, password changes, account modifications, and status overrides.", "11. Audit Log: ")

    # 3.6 Executive Dashboard
    add_h2("3.6 Executive Dashboard (Leadership Overview)")
    add_body(
        "The Executive Dashboard offers leadership and executive officials a clean, aggregated, non-technical visualization of program performance across all districts."
    )
    add_h3("Key Displays & Visual Components:")
    add_bullet("Highlights Total Filtered Activities, Verified Share %, Combined Verified Rate %, Total Participants Reached (Male vs Female), Active Districts, and Total Flagged Submissions.", "1. Executive KPI Summary Cards: ")
    add_bullet("Bar chart displaying male vs. female attendance breakdown across all activity types.", "2. Participation Demographics Chart: ")
    add_bullet("Progress bars showing completion breakdown (Completed, Pending, In Progress, Deferred).", "3. Visit Progress Component: ")
    add_bullet("Side-by-side bar chart and table ranking districts by volume, verified count, flagged count, and verification %.", "4. District Performance Ranking: ")
    add_bullet("Pie chart illustrating the percentage distribution of reported activity types.", "5. Activity Type Mix Chart: ")
    add_bullet("Line chart showing activity volume trajectory across planned weeks.", "6. Weekly Delivery Trend: ")
    add_bullet("Leaderboard ranking Mobilizer teams by submission volume and flag rate.", "7. Team Leaderboard: ")
    add_bullet("Categorized breakdown of why evidence photos were flagged (Duplicate photo, Location unverified, Capture date mismatch, Missing photo).", "8. Evidence Rejection Breakdown: ")
    add_bullet("Quick inspection table listing recent flagged submissions with direct modal view.", "9. Needs Attention Table: ")
    add_bullet("Filter all widgets dynamically by District, Team, Activity Type, Verification Status, Visit Status, and Date Range.", "10. Global Interactive Filters: ")
    add_bullet("Instant download of full Excel reports for Field Tracker, DCMO/FMO Tracker, and GRM Tracker.", "11. One-Click Excel Data Export: ")

    # Section 4: Data Submission & Verification Flow
    add_h1("4. End-to-End Data Submission & Verification Workflow")
    add_body(
        "To ensure data trust and prevent fraudulent or duplicate reporting, KPHCIP field community engagement enforces a strict submission and verification pipeline:"
    )

    add_bullet("Field employees select their assigned weekly plan and input session data (location, attendees, demographics, remarks).", "Step 1: Activity Execution & Data Capture: ")
    add_bullet("Field staff attach evidence photos. The browser automatically requests GPS coordinates, attaching server-authoritative timestamps.", "Step 2: Evidence Attachment & GPS Capture: ")
    add_bullet("The system analyzes uploaded photo checksums to prevent image reuse and validates timestamp integrity.", "Step 3: Automated Server Checks: ")
    add_bullet("Admins and Super Admins review submitted records. Submissions are marked as Verified or Flagged (with explicit rejection reasons).", "Step 4: Verification & Moderation: ")
    add_bullet("TL/DTL Reviewers evaluate DCMO Monitoring Visit Checklists, inspect photo evidence, verify safeguarding compliance, and issue official approvals.", "Step 5: Quality Assurance Review: ")
    add_bullet("Verified records immediately update Executive KPI cards, district leaderboards, and Excel export trackers.", "Step 6: Real-Time Analytics & Reporting: ")

    # Conclusion / Sign-off
    add_h1("5. Conclusion")
    add_body(
        "KPHCIP field community engagement provides a complete digital framework for field activity tracking, quality assurance, and executive oversight. "
        "By enforcing mandatory photo/GPS evidence, weekly plan alignment, structured monitoring checklists, and multi-tier review workflows, "
        "the application ensures total operational transparency across all participating districts."
    )

    # Save Document
    out_dir = r"c:\Users\lenovo\Desktop\nexa serve"
    out_path = os.path.join(out_dir, "KPHCIP_Field_Community_Engagement_Application_Report.docx")
    doc.save(out_path)
    # Also overwrite the Nexa_Serve_Application_Report.docx path for convenience
    doc.save(os.path.join(out_dir, "Nexa_Serve_Application_Report.docx"))
    print(f"Report generated successfully at: {out_path}")

if __name__ == "__main__":
    create_report()
