# Mend: Functional Specification

## Overview

**Mend** is a React-based construction project cost management and forecasting platform. It provides enterprise-scale tools for managing project budgets, costs, changes, risks, subcontracts, procurement, progress tracking, and schedules. Mend is built on a multi-tenant architecture where **enterprises** contain multiple **projects**, and each project operates independently while leveraging enterprise-wide configuration.

### Problem Solved
Construction projects face challenges in:
- Tracking actual costs against budget forecasts in real time
- Managing changes and their impact on project financials
- Quantifying and monitoring project risks
- Coordinating subcontractors and their invoicing
- Tracking progress against earned-value metrics
- Managing procurement workflows across multiple steps
- Forecasting completion costs (EAC/ETC) accurately
- Distributing costs and forecasts across time periods (phasing)

Mend solves these by providing a unified platform with role-based access, real-time data synchronization, and canonical domain formulas that ensure consistency across all views.

---

## User Roles & Permissions

### Role Hierarchy

1. **Platform Admin** (System Owner)
   - Manages all enterprises
   - Can promote users to Enterprise Admin
   - Full system access via System Admin panel

2. **Enterprise Admin**
   - Manages users, projects, and enterprise-wide configuration
   - Defines enterprise cost elements, attributes, resource rates, vendors, calendars
   - Can demote/promote project members
   - Views Enterprise Dashboard (overview of all projects)
   - Access to Enterprise Admin panel for configuration

3. **Project Admin**
   - Manages project-level users and configurations
   - Full read-write access to all project modules
   - Can assign/revoke project roles
   - Access to Project Admin panel

4. **Project User** (Writer)
   - Read-write access to all project modules
   - Cannot modify project settings or user assignments

5. **Project Reader** (Read-only)
   - Read-only access to all project modules
   - Cannot modify data

6. **Project Guest**
   - Minimal access; primarily for vendors/external parties

### Permission Model

- **Platform Admin**: Hardcoded to system owner email addresses
- **Enterprise Admin**: Stored in `Enterprise.users[uid].role` and `Enterprise.adminUsers[]`
- **Project Roles**: Stored in `Project.users[uid]`
- **Firestore Rules**: Enforce access based on role and collection type
- All changes are audited via `createdBy`, `createdAt`, `modifiedBy`, `modifiedAt` fields

---

## Core Modules

### 1. Cost Management (Cost Codes)

**Purpose**: Manage project budget baseline, actual costs, estimates-to-complete (ETC), and estimates-at-completion (EAC) for all cost codes.

**Key Features**:
- Create, read, update, delete cost codes per project
- Define unique cost code IDs and descriptions
- Track four budget dimensions:
  - **Baseline Budget**: Original approved budget
  - **Budget Changes**: Cumulative approved changes
  - **Approved Budget**: Baseline + Changes
  - **Actuals to Date**: Invoiced costs
- Compute and monitor:
  - **EAC (Estimate at Completion)**: Forecasted final cost
  - **ETC (Estimate to Complete)**: EAC − Actuals to Date
  - **Cost Variance**: Approved Budget − EAC (positive = under-budget)
  - **Movements**: Period-over-period changes
- Track across multiple EAC methods:
  - Manual: User directly enters EAC
  - Change Management: EAC driven by approved changes
  - ETC Details: EAC = Actuals + sum(ETC Details)
  - Sub-Contract Management: EAC driven by subcontract totals
- Assign cost codes to project activities via `activityId`
- Assign users to specific cost codes for access control

**Computed Values**:
- Approved Budget = Baseline Budget + Approved Changes
- EAC & ETC computed via canonical formula in `domain/eac.ts`
- Cost Variance = Approved Budget − EAC
- Movement values = current period − prior period

**Submodules & Panels**:

#### Actual Cost
- Record actual costs from various sources (MAN, ACC, FIN, REV)
- Link actuals to cost codes and reporting periods
- Bulk import actual costs via Excel

#### Baseline Budget
- Record baseline budget allocations per cost code
- Sources: EST, CON, BID
- Tied to reporting periods

#### ETC Details
- Break down ETC by individual line items
- Each item has:
  - Description, cost code, quantity, unit, rate
  - Phasing method (Manual or Auto)
  - Start/end dates
  - Distribution method (Even, Bell, Front, Back)
  - Period values (time-phased breakdown)
- Support for enterprise resources with rate lookups
- Compute total ETC = sum of all ETC Detail line items
- Bulk edit ETC details
- Resource library for quick rate lookups

#### Time Phasing (Cost Phasing)
- Distribute approved budget and EAC across reporting periods
- Distribution methods: Even, Bell Curve, Front Load, Back Load, S-Curve, Profile
- Manual period-by-period entry
- Auto-distribution based on dates and method
- View and edit phased values in grid
- Supports custom phasing profiles

#### Changes Panel
- View all change orders linked to this cost code
- Shows approved and pending changes
- Links to Change Management module

#### Subcontract Breakdown
- View all subcontract line items linked to this cost code
- Shows total subcontract commitment and invoiced amounts
- Links to Subcontract Management module

**User Workflows**:
1. Project Admin creates cost codes matching WBS structure
2. Project team enters baseline budgets and actual costs
3. System calculates EAC using selected method
4. Users monitor Cost Variance to identify overruns
5. On changes, update EAC via Change Management or ETC Details

---

### 2. Change Management

**Purpose**: Track change orders, control their approval, and measure impact on budget and EAC.

**Key Features**:
- Create and manage change orders with unique change IDs
- Define change type (from enterprise configuration)
- Assign changes to cost codes via Change Records (1-to-many)
- Track change status: Approved, Pending, Rejected, Withdrawn
- Each change automatically sums budget and EAC from child records
- Bulk create and update change records

**Change Entity Fields**:
- `changeId`: Unique identifier (max 20 chars)
- `description`: Free text description
- `type`: From enterprise-defined list
- `status`: Approved | Pending | Rejected | Withdrawn
- `initiator`: User who created change (max 50 char)
- `reference`: External reference ID (max 50 char)
- `budget`: Formula: sum of child ChangeRecord.budgetAmount
- `eac`: Formula: sum of child ChangeRecord.eacAmount
- `enterpriseAttributes` & `projectAttributes`: Metadata

**Change Record Entity Fields**:
- `costCodeId`: Reference to CostCode
- `scope`: Description (max 100 char)
- `budgetAmount`: Budget impact
- `eacAmount`: EAC impact
- `enterpriseAttributes` & `projectAttributes`: Metadata

**Workflows**:
1. Project member creates a change order with description and type
2. Project Admin approves or rejects the change
3. Upon approval, budget and EAC automatically flow to cost codes
4. Impact visible in Cost Management module

---

### 3. Risk Management

**Purpose**: Identify, quantify, and track project risks using Beta-PERT exposure analysis.

**Key Features**:
- Create and manage risk register with unique risk IDs
- Define risk type (from enterprise configuration)
- Assign risks to cost codes via Risk Records (1-to-many)
- Track risk status: Open, Mitigated, Closed, Realized
- Calculate risk exposure using Beta-PERT:
  - **Beta-PERT Impact** = (min + 4×mostLikely + max) / 6
  - **Risk Exposure** = Beta-PERT Impact × Probability
- Risk records aggregate to parent Risk exposure
- Bulk create and update risk records

**Risk Entity Fields**:
- `riskId`: Unique identifier (max 20 chars)
- `description`: Free text
- `type`: From enterprise configuration
- `status`: Open | Mitigated | Closed | Realized
- `strategy`: Avoid | Mitigate | Transfer | Accept
- `initiator`: User who created (max 50 char)
- `reference`: External reference (max 50 char)
- `exposure`: Formula: sum of child RiskRecord exposures
- `minImpactTotal`, `mostLikelyImpactTotal`, `maxImpactTotal`: Rollup sums
- `enterpriseAttributes` & `projectAttributes`: Metadata

**Risk Record Entity Fields**:
- `costCodeId`: Reference to CostCode
- `scope`: Description (max 100 char)
- `probability`: 0–1 decimal (e.g., 0.4 = 40%)
- `minImpactAmount`, `mostLikelyImpactAmount`, `maxImpactAmount`: Dollar amounts
- `betaPertImpactAmount`: Computed = (min + 4×mostLikely + max) / 6
- `enterpriseAttributes` & `projectAttributes`: Metadata

**Workflows**:
1. Project member identifies a risk and creates risk register entry
2. Risk is decomposed into cost codes via Risk Records
3. For each cost code, estimate min/mostLikely/max impact and probability
4. System calculates Beta-PERT exposure
5. Dashboard shows total project risk exposure
6. On mitigation, mark risk status as Mitigated or Closed

---

### 4. Subcontract Management

**Purpose**: Manage subcontractor agreements, line items, invoicing, and certification workflow.

**Key Features**:
- Create subcontracts with vendor assignment and payment type
- Three payment models: Lump Sum, Schedule of Rates, Re-measurable
- Define line items per subcontract (Original or ChangeOrder)
- Estimate quantities, rates, and totals
- Link line items to cost codes and activities
- Track line item status: Approved, Pending, Forecast, Rejected
- Manage time phasing for line items (Manual or Auto)
- Invoice management with multi-step certification:
  - Draft → Submitted → Certified → Rejected | Paid
- Track claimed vs. certified amounts per invoice
- Support periodic invoicing with claim/certification tracking
- Bulk import and edit subcontracts and invoices
- Support for subcontract attributes (custom fields)

**Subcontract Entity Fields**:
- `orderId`: Max 50 chars, unique per project
- `orderName` & `orderScope`: Descriptions
- `status`: Active | Complete | On Hold
- `paymentType`: LumpSum | Schedule of Rates | Re-measurable
- `vendorId` & `vendorName`: Vendor reference
- `vendorUsers`: Array of vendor email addresses for access
- `totalAmount`: Sum of line items
- `awardDate`: Date subcontract awarded
- `lineItems`: Array of SubcontractLineItem
- Default phasing method, distribution, start/end dates
- `enterpriseSubcontractAttributes` & `projectAttributes`: Metadata

**Line Item Entity Fields**:
- `itemNo`: Unique within subcontract
- `description`, `quantity`, `unit`, `rate`, `total`
- `type`: Original | ChangeOrder
- `status`: Approved | Pending | Forecast | Rejected
- `costCodeId` & `activityId`: References
- `phasingSource`, `distribution`, `periodValues`: Time phasing
- `enterpriseAttributes` & `projectAttributes`: Metadata

**Invoice Entity Fields**:
- `invoiceId`: User-facing invoice number
- `description`, `status`, `totalAmount`, `certifiedAmount`
- `status`: Draft | Submitted | Certified | Rejected | Paid
- `submittedDate`, `certifiedDate`, `paymentDate`: Timestamps
- `items`: Array of InvoiceItem
- Each invoice item tracks:
  - Claim quantity, percent, value (periodic and cumulative)
  - Certified quantity, percent, value (periodic and cumulative)
  - Commentary field for notes

**Workflows**:
1. Project Admin creates subcontract with vendor
2. Define line items with quantities, rates, and cost code assignments
3. Vendor submits invoice (Draft → Submitted)
4. Project team reviews and updates claimed amounts
5. On certification approval: Submitted → Certified
6. Payment: Certified → Paid
7. Actual costs flow to Cost Management via actuals mechanism

---

### 5. Progress Tracking (Commodity Tracking)

**Purpose**: Track project progress using earned value / percent complete metrics.

**Key Features**:
- Create progress packages (groups of related items)
- Define progress items within packages
- Each item has planned quantities and phasing
- Track progress against items using Rules of Credit
- Calculate earned value = (% Complete × Total Qty)
- Aggregate earned value to cost codes
- Support both manual and automated phasing
- Multiple distribution curves: S-curve, Bell, Front Load, Back Load, Even
- Reporting periods for historical tracking
- Bulk edit progress items and rules of credit

**Progress Package Entity Fields**:
- `packageId`: Unique per project (max 20 chars)
- `description`: Free text
- `ruleOfCreditId`: Optional, default ROC for items
- `unit`: Default unit (e.g., "EA", "LF", "SF")
- `defaultPhasingMethod`, `defaultPhasingCurve`: Defaults for items
- `defaultStartDate`, `defaultEndDate`: Defaults
- `attributes`: Custom field values

**Progress Item Entity Fields**:
- `itemId`: Unique per package (max 20 chars)
- `packageId`, `packageDocId`: Parent package
- `description`, `costCodeId`: References
- `totalQty`: Planned quantity
- `totalQtyPrevious`, `earnedQtyPrevious`: Prior period tracking
- `plannedStartDate`, `plannedEndDate`: Schedule
- `phasingMethod`: Auto | Manual
- `phasingCurve`: Scurve | Bell | front load | back load | even
- `ruleOfCreditId`: Optional override ROC
- `ruleOfCreditProgress`: Record of progress per ROC step (0–100% per step)
- `periodValues`: Planned quantities per reporting period
- `currentStartDate`, `currentEndDate`, `currentPhasingMethod`, `currentPhasingCurve`: Current override
- `currentPeriodValues`, `actualPeriodValues`: Current and actual phased values
- `activityId`: Optional schedule link
- `projectAttributes` & `enterpriseAttributes`: Metadata

**Rule of Credit (ROC) Entity Fields**:
- `ruleId`: Unique per project (max 20 chars)
- `description`: Free text
- `packageId`: Optional, if default ROC for package
- `steps`: Array of RuleOfCreditStep
  - `orderNo`: Decimal order (max 10)
  - `description`: Step name (max 100 chars)
  - `weight`: Decimal proportion (sum typically = 1.0 or 100)
- `userField1` through `userField5`: Custom fields

**Progress Reporting Period Entity Fields**:
- `periodName`: e.g., "Period 1", "January 2024"
- `startDate`, `endDate`: Period boundaries
- `status`: Open | Closed

**Percent Complete Calculation** (from `domain/progress.ts`):
```
percent_complete = Σ(ruleOfCreditProgress[step.id] × step.weight / 100)
earned_qty = (percent_complete / 100) × totalQty
```

**Workflows**:
1. Project Admin defines progress packages and items
2. For each item, define ROC (e.g., 25% at start, 50% at 50%, 100% at completion)
3. Each reporting period, team updates ruleOfCreditProgress for each step
4. System calculates percent complete → earned qty → earned value
5. Dashboard shows project progress and EV metrics

---

### 6. Procurement Progress

**Purpose**: Manage procurement workflow steps and track procurement items through phases.

**Key Features**:
- Define enterprise or project-level procurement step templates
- Each step has name, order, default duration (days)
- Track procurement items through steps: Planned Date → Actual Date → Forecast Date
- Automatic forward calculation of forecast dates (business days)
- Automatic backward calculation of planned dates
- Calendar integration for business day calculations (weekends, holidays)
- Bulk import procurement items
- Attributes support per item

**Procurement Step Definition Entity Fields**:
- `name`: Step name (e.g., "RFQ Issued", "Bids Received", "PO Issued")
- `order`: Numeric order
- `isEnterpriseStandard`: Boolean, if true it's available across all projects
- `defaultDurationDays`: Default duration to next step
- `enterpriseStepId`: Reference if copied from enterprise

**Procurement Item Entity Fields**:
- `packageId`: Unique per project (grouping)
- `description`: Free text
- `calendarId`: Reference to working calendar
- `category`: Optional category
- `stepData`: Record<stepId, ProcurementStepData>
  - `plannedDate`: Planned step completion
  - `actualDate`: Actual step completion (if known)
  - `forecastDate`: Forecasted step completion
  - `planDuration`: Duration from this step to next
  - `forecastDuration`: Forecasted duration
- `enterpriseAttributes` & `projectAttributes`: Metadata

**Working Day Calculations** (from `domain/procurement.ts`):
- `isWorkingDay(date, calendar)`: Check if date is not weekend/holiday
- `addBusinessDays(startDate, days, calendar)`: Add N business days
- Forecast dates calculated forward from cutoffDate
- Planned dates calculated backward from last step

**Workflows**:
1. Enterprise Admin defines procurement step templates (e.g., RFQ, Bid, Award, PO, Delivery)
2. Project team creates procurement items and assigns calendar
3. Team enters planned dates for each step (or system auto-calculates)
4. As steps are completed, enter actual date
5. System forecasts remaining dates based on business calendar
6. Dashboard shows procurement progress across all items

---

### 7. Schedule Management (Time Schedule)

**Purpose**: Manage project schedule, activities, and progress tracking.

**Key Features**:
- Define schedule items (activities) with hierarchical relationships
- Track dates: Baseline, Planned, Current
- Monitor percent complete
- Link activities to cost codes and progress items
- Import/export schedules
- Bulk edit activities

**Schedule Item Entity Fields**:
- `activityId`: Unique activity identifier
- `description`: Activity name
- `baselineStartDate`, `baselineEndDate`: Original schedule
- `plannedStartDate`, `plannedEndDate`: Current plan
- `currentStartDate`, `currentEndDate`: Latest update
- `activityPercentComplete`: 0–100%
- `projectId`: Parent project

**Workflows**:
1. Project schedules are imported or created in external tool
2. Schedule items imported into Mend
3. Used as reference for cost code activities and progress items
4. Can manually update percent complete to drive progress tracking

---

### 8. Enterprise Dashboard

**Purpose**: Provide project overview to enterprise members.

**Key Features**:
- List all projects within enterprise
- Display project name, code, budget, status
- Quick-view key metrics per project:
  - Total budget
  - Actual costs to date
  - Forecast at completion (EAC)
  - Cost variance
- Create new projects
- Filter and search projects
- Bulk operations on projects
- Role-based visibility (Enterprise Admins see all; Users see only assigned projects)

**Workflows**:
1. Enterprise Admin/User clicks Enterprise Dashboard
2. Views all projects and key metrics
3. Can create new project
4. Click into project to access modules

---

### 9. Project Dashboard

**Purpose**: Provide project-level overview to project members.

**Key Features**:
- Summary metrics:
  - Total project budget
  - Actual costs to date
  - Forecast at completion
  - Variance
  - Project status (Active, On Hold, Closed, Archived)
- Charts and visualizations:
  - Cost trending (Actual vs. Forecast)
  - Budget vs. EAC comparison
  - Cost code breakdown
  - Change order impact
  - Risk exposure by cost code
- Navigation to all modules
- Role-based access

**Workflows**:
1. Project member clicks Project Dashboard
2. Reviews key metrics and charts
3. Navigates to specific module for deeper analysis

---

### 10. Enterprise Administration

**Purpose**: Configure enterprise-wide settings, attributes, and shared resources.

**Key Features**:

#### Enterprise Settings
- Enterprise name, logo, theme
- Admin user management
- Create/edit/delete projects

#### Enterprise Users
- Add/remove enterprise members
- Assign enterprise roles (Admin, User)
- Bulk import users
- Track join dates

#### Enterprise Projects
- View all projects
- Set project admin users
- Bulk delete projects

#### Enterprise Attributes
Four attribute categories support custom fields:
1. **Project Attributes** (10 slots)
2. **Line Item Attributes** (10 slots)
3. **Cost Code Attributes** (10 slots)
4. **Subcontract Attributes** (10 slots)
5. **Change Attributes** (10 slots)
6. **Risk Attributes** (10 slots)
7. **Procurement Attributes** (10 slots)
8. **Progress Attributes** (10 slots)

Each attribute has:
- ID (01–10)
- Title
- Value list (dropdown options)

#### Resource Rates
- Define hourly/daily/project rates for resources
- Supports categories
- Optional custom fields (UDF1, UDF2, UDF3)
- Used in ETC Details for quick rate lookup

#### Vendors
- Define vendor master list
- Name, code, contact info
- Used in subcontracts

#### Cost Elements
- Enterprise cost element library
- Supports custom sort codes
- Can be inherited by projects

#### Enterprise Calendars
- Define working days, weekends, holidays
- Used for procurement and phasing calculations

**Workflows**:
1. Enterprise Admin accesses Enterprise Admin panel
2. Configures attributes, rates, vendors
3. These become available across all projects

---

### 11. Project Administration

**Purpose**: Configure project-level settings and access control.

**Key Features**:
- Project info (name, code, budget, dates, status)
- Project users and roles
- Project-level attributes (override or extend enterprise)
- Project cost elements
- Project resource rates
- Project calendars
- Reporting periods (cost reporting)
- Progress periods (for earned value tracking)

**Workflows**:
1. Project Admin clicks Project Admin
2. Configures project users, attributes, cost elements
3. Defines reporting periods for cost tracking
4. Defines progress periods for EV tracking

---

### 12. System Administration (Platform Admin)

**Purpose**: Manage platform-level entities and upgrade users.

**Key Features**:
- View and manage all enterprises
- Create new enterprises
- Delete enterprises
- Bulk import enterprises
- Promote users to Platform Admin or Enterprise Admin
- View version information

**Workflows**:
1. Platform Admin accesses System Admin
2. Creates/manages enterprises
3. Upgrades user roles

---

### 13. Global Time Phasing

**Purpose**: Enterprise-level view of all cost code time phasing.

**Key Features**:
- Grid view of all cost codes and their period values (budget and EAC)
- Supports multiple distribution methods per cost code
- Bulk edit phasing across multiple cost codes
- Chart visualization of phasing over time
- Percentage vs. absolute value view

**Workflows**:
1. Enterprise/Project Admin clicks Global Time Phasing
2. Reviews budget and EAC phasing across all cost codes
3. Can bulk update phasing method for multiple codes
4. Charts show timing of budget and forecast spend

---

### 14. Calendar Manager

**Purpose**: Manage working calendars for business day calculations.

**Key Features**:
- Create calendars for enterprise or project
- Define weekend days (0–6, where 0=Sun)
- Add holidays (specific dates)
- Duplicate enterprise calendar to project
- Used for procurement and phasing calculations

**Workflows**:
1. Enterprise Admin creates calendar with holidays
2. Projects reference calendar for procurement and phasing
3. System uses calendar for business day calculations

---

## Cross-Module Relationships

### Cost Codes as Central Hub
- **Cost Codes** are the central organizational unit
- All other modules link to cost codes:
  - **Changes** link via ChangeRecords
  - **Risks** link via RiskRecords
  - **Subcontracts** link via LineItems
  - **Progress Items** link directly
  - **ETC Details** link directly

### Financial Impact Flow
```
Actual Costs (Actuals Panel)
       ↓
ETC Details (ETC Details Panel)
       ↓
Approved Changes (from Change Management)
       ↓
→ Compute EAC & Cost Variance (canonical formulas)
       ↓
Cost Code Summary (displayed in main grid)
```

### Schedule Integration
- Schedule items referenced by:
  - Cost codes (activity reference)
  - Progress items (activity reference)
  - Subcontract line items (activity reference)
- Schedule percent complete can drive earned value

### Risk & Change Integration
- Risks and Changes both decompose into cost codes
- Both contribute to total project exposure/variance
- Both tracked separately but flow to cost impact

---

## Enterprise vs. Project Scope

### Enterprise Scope (Tenant-Level)
- Users and their roles
- Attributes and attribute values (10 per category)
- Resource rates library
- Vendor master list
- Cost element library
- Calendars (enterprise standard)
- Procurement step definitions (enterprise standard)

### Project Scope
- Project metadata (name, code, budget, dates, status)
- Cost codes (WBS structure)
- Actual costs
- Baseline budget
- ETC details
- Change orders
- Risk register
- Subcontracts
- Progress packages and items
- Rules of credit
- Procurement items and steps
- Schedule items
- Reporting periods
- Progress periods

### Shared Attributes
- Projects can reference enterprise attributes
- Projects can define project-level overrides/extensions
- Subcontract/Progress/ETC items reference both enterprise and project attributes

---

## Key Workflows Summary

### Workflow 1: Monthly Cost Reporting
1. Period close: Mark reporting period as closed
2. Enter actuals from invoices and timesheets
3. System updates Actuals to Date per cost code
4. Review Cost Variance and identify overruns
5. Update ETC for next period if needed

### Workflow 2: Change Order Approval
1. Project team initiates change order (reason, type, proposed budget impact)
2. Project Admin reviews and approves
3. System updates Approved Budget and EAC (if change-driven)
4. Dashboard reflects new forecast at completion

### Workflow 3: Risk Identification & Tracking
1. Team identifies risk and creates risk record
2. Decompose into cost codes, estimate min/mostLikely/max
3. System calculates Beta-PERT exposure
4. Monthly: Update probability/impact estimates
5. On mitigation: Mark as Mitigated or Closed

### Workflow 4: Subcontract Invoicing
1. Subcontract awarded with line items
2. Vendor submits invoice (claims against line items)
3. Project team reviews and certifies amounts
4. Payment issued
5. Actuals flow to cost codes

### Workflow 5: Progress Tracking & Earned Value
1. Define progress packages and items with ROCs
2. Each period: Update ROC step progress (% complete)
3. System calculates earned qty = totalQty × rocPercent
4. Earned value = earned qty (or can be cost-based)
5. Dashboard shows % complete and trend

### Workflow 6: Procurement Tracking
1. Enterprise defines procurement steps and duration
2. Project creates procurement items
3. As items progress, enter actual dates
4. System forecasts remaining dates (business days)
5. Dashboard shows procurement status and critical path

---

## Data Integrity & Validation

### Field Constraints
- IDs are max 20–50 characters
- Descriptions max 100–500 characters
- Emails validated by Firebase Auth
- Dates in ISO 8601 format (YYYY-MM-DD)
- Decimal numbers for rates, quantities, probabilities
- Numbers enforced as positive for amounts/counts

### Rollup Calculations
- Change.budget = SUM(ChangeRecord.budgetAmount)
- Change.eac = SUM(ChangeRecord.eacAmount)
- Risk.exposure = SUM(RiskRecord.exposure)
- Cost Code EAC is computed per selected EacMethod
- Progress Item % = ROC formula

### Audit Trail
- All entities have `createdAt`, `updatedAt`, `createdBy`, `modifiedBy` fields
- Firestore rules enforce write security by project/enterprise

---

## Reporting & Analytics

### Pre-built Views
- Cost Management grid: Main cost tracking interface
- Change Management grid: Change order tracking
- Risk Management grid: Risk exposure tracking
- Subcontract grid: Vendor/invoice status
- Progress grid: Earned value tracking
- Procurement grid: Step-by-step tracking
- Schedule grid: Activity status

### Exports
- Grid-to-Excel export functionality on most modules
- Preserves data format and calculations
- Used for external reporting and archival

### Charts & Visualizations
- Dashboard: Cost trending (Actual vs. Forecast)
- Risk: Risk exposure by cost code and status
- Change: Budget impact by type and status
- Procurement: Step progress and timing

---

## Multi-Tenant Architecture

### Isolation
- Each enterprise is a separate tenant
- Users belong to 0+ enterprises
- Projects belong to exactly one enterprise
- Firestore collections are partitioned by enterpriseId and projectId
- Security rules enforce tenant isolation

### User Experience
- User can switch enterprises via header dropdown
- Navigation automatically scoped to current enterprise/project
- Dashboard shows only user's projects (or all if Admin)

---

## Deployment & Environment

### Stack
- **Frontend**: React 19, TypeScript, Tailwind CSS, Ag-Grid
- **Backend**: Express, Firestore, Firebase Auth
- **Hosting**: Vercel (frontend) + Firebase (backend/data)
- **Email**: Resend API for invitations

### Environment Variables
- `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`
- `RESEND_API_KEY` (for email)
- `GEMINI_API_KEY` (optional, for AI features)
- `VITE_ADAPTER` (memory or firestore for testing)

### Ports & Hosting
- Development: Port 3000 (Vite) + Port 3001 (Express server)
- Production: Vercel-hosted SPA with Express server for API routes

---

## Feature Toggles & Configuration

### Attributes
- Enterprises can configure up to 10 attributes per category
- Projects can use enterprise attributes or define custom ones
- Dropdown values support sort order and descriptions

### Calendars
- Projects can inherit enterprise calendar or define custom
- Weekends and holidays customizable

### Procurement Steps
- Enterprise defines standard steps
- Projects can override or extend

### Reporting Periods
- Configurable duration (weekly, monthly)
- Supports historical tracking
- Period can be marked open or closed

---

# Appendix: Entity Relationships

```
Enterprise (1)
├── Users[uid] → role + metadata
├── Projects (many)
│   ├── Cost Codes (many)
│   │   ├── Actual Costs (many)
│   │   ├── ETC Details (many)
│   │   ├── Change Records (many) → parent Change
│   │   └── Risk Records (many) → parent Risk
│   ├── Changes (many)
│   │   └── Change Records (many) → Cost Code
│   ├── Risks (many)
│   │   └── Risk Records (many) → Cost Code
│   ├── Subcontracts (many)
│   │   ├── Line Items (many) → Cost Code
│   │   └── Invoices (many)
│   │       └── Invoice Items (many)
│   ├── Progress Packages (many)
│   │   └── Progress Items (many) → Cost Code
│   ├── Rules of Credit (many)
│   ├── Schedule Items (many)
│   ├── Procurement Items (many)
│   ├── Procurement Step Definitions (project-level)
│   ├── Calendars (many)
│   └── Reporting Periods (many)
└── Enterprise Configuration
    ├── Attributes (Project, LineItem, CostCode, Subcontract, Change, Risk, Procurement, Progress)
    ├── Resource Rates (many)
    ├── Vendors (many)
    ├── Cost Elements (many)
    ├── Procurement Step Definitions (enterprise standard)
    └── Calendars (enterprise standard)
```

