# Mend: Technical Specification

## 1. Stack & Dependencies

### Core Framework
| Dependency | Version | Purpose |
|---|---|---|
| **React** | 19.0.0 | UI framework |
| **React Router DOM** | 7.13.2 | Client-side routing |
| **TypeScript** | ~5.8.2 | Type safety |
| **Vite** | 6.2.0 | Build tool and dev server |
| **Tailwind CSS** | 4.1.14 | Styling |

### UI & Data Display
| Dependency | Version | Purpose |
|---|---|---|
| **ag-grid-react** | 35.1.0 | Enterprise data grids |
| **ag-grid-community** | 35.1.0 | Grid core |
| **ag-grid-enterprise** | 35.1.0 | Advanced grid features (grouping, sidebar) |
| **recharts** | 3.8.0 | Charts and visualizations |
| **lucide-react** | 0.546.0 | Icon library |
| **shadcn** | 4.1.1 | UI component library |
| **motion** | 12.23.24 | Animation library |
| **react-day-picker** | 9.14.0 | Date picker |

### Data & Spreadsheet
| Dependency | Version | Purpose |
|---|---|---|
| **xlsx** | 0.18.5 | Excel import/export |
| **@univerjs/sheets** | 0.18.0 | In-app spreadsheet editor |
| **d3** | 7.9.0 | Data visualization helpers |

### Backend & Database
| Dependency | Version | Purpose |
|---|---|---|
| **firebase** | 11.0.0 | Auth, Firestore, Realtime DB |
| **express** | 4.21.2 | Backend server |
| **resend** | 6.9.3 | Email API for invitations |

### Utilities
| Dependency | Version | Purpose |
|---|---|---|
| **date-fns** | 4.1.0 | Date manipulation |
| **dotenv** | 17.2.3 | Environment variables |
| **clsx** / **tailwind-merge** | 2.1.1 / 3.5.0 | CSS class utilities |
| **sonner** | 2.0.7 | Toast notifications |
| **react-hot-toast** | 2.6.0 | Alternative toast library |
| **next-themes** | 0.4.6 | Light/dark theme management |
| **esbuild** | 0.28.1 | JavaScript bundler (server) |
| **tsx** | 4.21.0 | TypeScript runtime |

### Development & Testing
| Dependency | Version | Purpose |
|---|---|---|
| **vitest** | 4.1.9 | Unit test runner |
| **@playwright/test** | 1.61.1 | End-to-end testing |
| **eslint** | 10.6.0 | Linting |
| **@typescript-eslint/\*** | 8.62.1 | TypeScript linting |

---

## 2. Architecture: Ports & Adapters Pattern

Mend implements the **Ports & Adapters (Hexagonal Architecture)** pattern to decouple domain logic from data access and external services.

### Architecture Diagram (Text)

```
┌─────────────────────────────────────────────────┐
│           React Components (UI Layer)           │
│    ┌─────────────────────────────────────────┐  │
│    │ CostCodes, ChangeManagement, etc.       │  │
│    └─────────────────────────────────────────┘  │
└──────────────┬──────────────────────────────────┘
               │ (via useXxxRepo hooks)
               ↓
┌──────────────────────────────────────────────────┐
│        Platform Abstraction (Ports)              │
│  ┌─────────────────────────────────────────────┐ │
│  │ CostRepository, ChangeRepository, etc.      │ │
│  │ (src/platform/ports/*.port.ts)              │ │
│  └─────────────────────────────────────────────┘ │
└──────────────┬──────────────────────────────────┘
               │
       ┌───────┴─────────┐
       ↓                 ↓
┌─────────────────┐  ┌──────────────────────┐
│ Firestore       │  │ Memory Adapter       │
│ Adapter         │  │ (Testing)            │
│ (Production)    │  │                      │
└─────────────────┘  └──────────────────────┘
       ↓                      ↓
  Firestore DB         In-Memory Store
```

### Port Interfaces (src/platform/ports/)

Each data domain has a Port interface defining operations:

| Port | Implements | Key Methods |
|---|---|---|
| **CostRepository** | Cost codes, actuals, ETC details | subscribe, create, update, delete, updateMany |
| **ChangeRepository** | Changes, change records | subscribe, create, update, delete |
| **RiskRepository** | Risks, risk records | subscribe, create, update, delete |
| **SubcontractRepository** | Subcontracts, line items, invoices | subscribe, create, update, delete |
| **ProgressRepository** | Packages, items, rules of credit | subscribe, create, update, delete |
| **ProcurementRepository** | Items, step definitions | subscribe, create, update, delete |
| **ScheduleRepository** | Schedule items, calendars | subscribe, create, update, delete |
| **ProjectRepository** | Projects | subscribe, create, update, delete |
| **EnterpriseRepository** | Enterprises, users | subscribe, create, update, delete |
| **AuthRepository** | Authentication | getCurrentUser, signIn, signOut, subscribe |
| **UserRoleRepository** | User role assignments | getUserRoles, subscribeUserRoles, setRole |
| **UtilityRepository** | Sheets, saved views | subscribe, create, update |

### Adapters

#### Firestore Adapter (Production)
- **Location**: `src/platform/firestore/adapters/`
- **Files**: One adapter per port (e.g., `CostAdapter.ts`, `ChangeAdapter.ts`, etc.)
- **Features**:
  - Real-time subscriptions via `onSnapshot()`
  - Batch writes for bulk operations
  - Firestore security rule integration
  - Document ID generation via Firestore auto-ID

**Firestore Collections** (26 total, keyed by enterpriseId & projectId):
```
enterprises/
  ├── {enterpriseId}/
  │   ├── users/ (enterprise members)
  │   └── config/ (attributes, rates, vendors, etc.)
  ├── projects/
  │   ├── {projectId}/
  │   │   ├── costCodes/
  │   │   ├── changes/
  │   │   ├── changeRecords/
  │   │   ├── risks/
  │   │   ├── riskRecords/
  │   │   ├── subcontracts/
  │   │   ├── invoices/
  │   │   ├── progressPackages/
  │   │   ├── progressItems/
  │   │   ├── rulesOfCredit/
  │   │   ├── procurementItems/
  │   │   ├── procurementSteps/
  │   │   ├── scheduleItems/
  │   │   ├── calendars/
  │   │   ├── reportingPeriods/
  │   │   ├── actualCosts/
  │   │   ├── baselineBudgets/
  │   │   ├── etcDetails/
  │   │   └── costPhasing/
  ├── sheets/
  ├── savedViews/
  └── userRoles/
```

#### Memory Adapter (Testing)
- **Location**: `src/platform/memory/`
- **Purpose**: In-memory implementation for testing without Firestore
- **Enabled via**: `VITE_ADAPTER=memory` environment variable
- **Features**:
  - Synchronous operations
  - Observable pattern via `BehaviorSubject`
  - No network latency
  - Deterministic for testing

### Adapter Factory (Context)
- **Location**: `src/platform/firestore/context.tsx`
- **Exports**:
  - `FirestoreProvider`: Context provider component
  - `usePlatform()`: Hook to access repository instances
- **Instantiation**: Determines which adapter to use based on environment

### Integration with Components
```tsx
// Components access repositories via hooks
import { useCostRepo, useChangeRepo } from '../platform/firestore/hooks';

export function MyComponent() {
  const costRepo = useCostRepo();
  const changeRepo = useChangeRepo();
  
  useEffect(() => {
    // Subscribe to real-time updates (agnostic to adapter)
    return costRepo.subscribeCostCodes(projectId, (codes) => {
      setCostCodes(codes);
    });
  }, [projectId]);
}
```

---

## 3. Directory Structure

```
/MendApp
├── src/
│   ├── App.tsx                                 # Main app component, routing
│   ├── main.tsx                                # Entry point
│   ├── components/
│   │   ├── CostCodes.tsx                      # Cost management UI
│   │   ├── ChangeManagement.tsx               # Change order UI
│   │   ├── RiskManagement.tsx                 # Risk management UI
│   │   ├── Subcontracts.tsx                   # Subcontract UI
│   │   ├── ProgressTracking.tsx               # Earned value UI
│   │   ├── ProcurementProgress.tsx            # Procurement UI
│   │   ├── TimeSchedule.tsx                   # Schedule UI
│   │   ├── EnterpriseDashboard.tsx            # Enterprise overview
│   │   ├── ProjectDashboard.tsx               # Project overview
│   │   ├── EnterpriseAdmin.tsx                # Enterprise config
│   │   ├── ProjectAdmin.tsx                   # Project config
│   │   ├── SystemAdmin.tsx                    # Platform admin
│   │   ├── GlobalTimephasing.tsx              # Global phasing view
│   │   ├── CalendarManager.tsx                # Calendar UI
│   │   ├── UserProfile.tsx                    # User settings
│   │   ├── Header.tsx                         # Top navigation
│   │   ├── Sidebar.tsx                        # Left navigation
│   │   ├── ErrorBoundary.tsx                  # Error handling
│   │   ├── LandingPage.tsx                    # Login page
│   │   ├── cost-codes/
│   │   │   ├── CostCodeFormDialog.tsx
│   │   │   ├── CostCodesCellRenderers.tsx
│   │   │   ├── ImportPreviewDialog.tsx
│   │   │   ├── columns.tsx                    # Ag-grid column definitions
│   │   │   └── panels/
│   │   │       ├── EtcDetailsPanel.tsx
│   │   │       ├── TimephasingPanel.tsx
│   │   │       ├── ActualsPanel.tsx
│   │   │       ├── SubcontractBreakdownPanel.tsx
│   │   │       └── ChangesPanel.tsx
│   │   ├── change-management/
│   │   │   ├── columns.tsx
│   │   │   ├── dialogs.tsx
│   │   │   └── panels/
│   │   │       ├── ChangeFormDialog.tsx
│   │   │       └── ChangeRecordsPanel.tsx
│   │   ├── risk-management/
│   │   │   ├── columns.tsx
│   │   │   └── panels/
│   │   │       ├── RiskFormDialog.tsx
│   │   │       └── RiskRecordsPanel.tsx
│   │   ├── subcontracts/
│   │   │   ├── columns.tsx
│   │   │   ├── SubcontractsCellRenderers.tsx
│   │   │   └── panels/
│   │   │       ├── SubcontractFormDialog.tsx
│   │   │       ├── LineItemsPanel.tsx
│   │   │       └── InvoicesPanel.tsx
│   │   ├── progress-tracking/
│   │   │   ├── columns.tsx
│   │   │   └── panels/
│   │   │       ├── PackageFormDialog.tsx
│   │   │       └── ProgressItemsPanel.tsx
│   │   ├── enterprise-admin/
│   │   │   ├── columns.tsx
│   │   │   └── tabs/
│   │   │       ├── EnterpriseSettingsTab.tsx
│   │   │       ├── UsersTab.tsx
│   │   │       ├── ProjectsTab.tsx
│   │   │       ├── LineItemAttributesTab.tsx
│   │   │       ├── ResourceRatesTab.tsx
│   │   │       ├── VendorsTab.tsx
│   │   │       └── CostElementsTab.tsx
│   │   ├── enterprise-dashboard/
│   │   │   └── columns.tsx
│   │   ├── global-timephasing/
│   │   │   ├── columns.tsx
│   │   │   └── TimephasingChart.tsx
│   │   ├── ui/
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── input.tsx
│   │   │   ├── select.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── avatar.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── scroll-area.tsx
│   │   │   └── ... (other shadcn components)
│   │   ├── BulkEtcDetails.tsx                 # Bulk edit
│   │   ├── BulkChangeRecords.tsx              # Bulk edit
│   │   ├── BulkRiskRecords.tsx                # Bulk edit
│   │   ├── BulkSubcontractItems.tsx           # Bulk edit
│   │   ├── BulkSubcontractInvoices.tsx        # Bulk edit
│   │   ├── BulkRulesOfCredit.tsx              # Bulk edit
│   │   ├── AgGridSheet.tsx                    # Ag-grid wrapper
│   │   ├── UniverSheet.tsx                    # Univer spreadsheet wrapper
│   │   ├── DataGridModule.tsx                 # Grid module setup
│   │   └── ... (other components)
│   ├── domain/
│   │   ├── types.ts                           # Domain entity definitions
│   │   ├── eac.ts                             # EAC/ETC formulas
│   │   ├── risk.ts                            # Beta-PERT formulas
│   │   ├── progress.ts                        # Rule-of-credit & earned value
│   │   ├── phasing.ts                         # Time phasing distribution
│   │   ├── procurement.ts                     # Business day calculations
│   │   ├── roles.ts                           # Role definitions
│   │   ├── eac.test.ts                        # EAC formula tests
│   │   ├── progress.test.ts                   # ROC formula tests
│   │   └── procurement.test.ts                # Calendar formula tests
│   ├── lib/
│   │   └── utils.ts                           # Formatting (formatCurrency, formatNumber)
│   ├── platform/
│   │   ├── ports/                             # Port interfaces (abstract contracts)
│   │   │   ├── index.ts
│   │   │   ├── cost.port.ts
│   │   │   ├── change.port.ts
│   │   │   ├── risk.port.ts
│   │   │   ├── subcontract.port.ts
│   │   │   ├── progress.port.ts
│   │   │   ├── procurement.port.ts
│   │   │   ├── schedule.port.ts
│   │   │   ├── project.port.ts
│   │   │   ├── enterprise.port.ts
│   │   │   ├── auth.port.ts
│   │   │   ├── userRole.port.ts
│   │   │   └── utility.port.ts
│   │   ├── firestore/                        # Firestore Adapter
│   │   │   ├── context.tsx                   # Provider & factory
│   │   │   ├── hooks.ts                      # useXxxRepo hooks
│   │   │   ├── adapters/
│   │   │   │   ├── CostAdapter.ts
│   │   │   │   ├── ChangeAdapter.ts
│   │   │   │   ├── RiskAdapter.ts
│   │   │   │   ├── SubcontractAdapter.ts
│   │   │   │   ├── ProgressAdapter.ts
│   │   │   │   ├── ProcurementAdapter.ts
│   │   │   │   ├── ScheduleAdapter.ts
│   │   │   │   ├── ProjectAdapter.ts
│   │   │   │   ├── EnterpriseAdapter.ts
│   │   │   │   ├── AuthAdapter.ts
│   │   │   │   ├── UserRoleAdapter.ts
│   │   │   │   └── UtilityAdapter.ts
│   │   │   └── config/
│   │   │       └── firebaseConfig.ts         # Firebase initialization
│   ├── memory/                               # Memory Adapter (for testing)
│   │   └── store.ts
│   ├── config/
│   │   └── constants.ts                      # App constants
│   └── types/ (legacy, use domain/types.ts instead)
├── tests/
│   ├── unit/
│   │   └── ... (vitest tests)
│   └── e2e/
│       └── ... (Playwright tests)
├── firestore.rules                           # Firestore security rules
├── server.ts                                 # Express backend for API routes
├── vite.config.ts                            # Vite build config
├── tsconfig.json                             # TypeScript config
├── tailwind.config.js                        # Tailwind CSS config
├── package.json
├── .env.example                              # Example environment variables
└── README.md
```

---

## 4. Data Model: Complete Entity Reference

### Core Entity Definitions

All entities defined in `src/domain/types.ts`. Below is the canonical reference:

#### 1. Project
```typescript
interface Project {
  id: string;
  enterpriseId: string;
  projectName: string;
  projectCode: string;
  status?: ProjectStatus; // Active | On Hold | Closed | Archived
  projectBudget: number;
  startDate: string; // ISO 8601
  endDate: string;
  cutoffDate: string;
  users: Record<string, 'Project Admin' | 'Project User'>;
  attributes?: Record<string, string>;
  photoURL?: string;
  scopeDescription?: string;
  clientName?: string;
  projectManagerName?: string;
  dateCreated: string;
  dateLastModified: string;
  createdBy?: string;
  createdByEmail?: string;
  modifiedBy?: string;
  modifiedByEmail?: string;
  categories?: string[];
  controlAccounts?: string[];
  orderNumbers?: string[];
  costElements?: ProjectCostElement[];
  costCodeAttributes?: ProjectAttribute[];
  subcontractAttributes?: ProjectAttribute[];
  changeAttributes?: ProjectAttribute[];
  riskAttributes?: ProjectAttribute[];
  procurementAttributes?: ProjectAttribute[];
  progressAttributes?: ProjectAttribute[];
  procurementDefaults?: { calendarId?: string; stepDurations?: Record<string, number> };
  changeTypes?: string[];
  riskTypes?: string[];
  lineItemAttributes?: ProjectAttribute[];
  resourceRates?: ResourceRate[];
  reportingPeriods?: PeriodsConfig;
  progressPeriods?: PeriodsConfig;
}
```

#### 2. CostCode
```typescript
interface CostCode {
  id: string; // Firestore doc ID
  code: string; // User-facing ID
  projectId: string;
  name: string;
  enterpriseAttributes: Record<string, string>;
  projectAttributes: Record<string, string>;
  eacMethod: 'Manual' | 'Change Management' | 'ETC Details' | 'Sub-Contract Management';
  sortOrder: number;
  activityId?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;

  // Budget
  baselineBudget: number;
  budgetChanges: number;
  approvedBudget: number;
  approvedBudgetPrevious: number;
  approvedBudgetMovement: number;

  // Actual
  actualCostThisPeriod: number;
  actualCostToDate: number;

  // EAC/ETC
  estimateToComplete: number;
  estimateAtCompletion: number;
  estimateAtCompletionPrevious: number;
  estimateAtCompletionMovement: number;

  // Variance
  costVariance: number;
  costVariancePrevious: number;
  costVarianceMovement: number;

  // Access
  assignedUsers?: string[]; // UIDs
}
```

#### 3. ActualCostRecord
```typescript
interface ActualCostRecord {
  id: string;
  projectId: string;
  costCodeId: string;
  item: string;
  description: string;
  source: 'MAN' | 'ACC' | 'FIN' | 'REV'; // Manual, Accounting, Finance, Revenue
  cost: number;
  reportingPeriodId: string;
  enterpriseAttributes?: Record<string, string>;
  projectAttributes?: Record<string, string>;
  createdAt: string;
  updatedAt?: string;
}
```

#### 4. EtcDetail
```typescript
interface EtcDetail {
  id: string;
  projectId: string;
  costCode: string;
  calendarId?: string;
  category?: string;
  item: string;
  description: string;
  orderNumber: string;
  udf1, udf2, udf3, udf4: string;
  qty: number;
  unit: string;
  rate: number;
  phasingMethod: 'Manual' | 'Auto-Phase';
  phasingStartDate: string;
  phasingEndDate: string;
  activityId?: string;
  phasingUnit: 'Daily' | 'Weekly' | 'Monthly' | 'Total' | 'Profile';
  phasingQty: number;
  enterpriseAttributes?: Record<string, string>;
  projectAttributes?: Record<string, string>;
  periodValues: Record<string, number>; // periodId -> amount
  sortOrder: number;
  createdAt: string;
  updatedAt?: string;
  isEnterpriseResource?: boolean;
  resourceId?: string;
  totalEtcPrevious?: number;
}
```

#### 5. Change & ChangeRecord
```typescript
interface Change {
  id: string; // Firestore doc ID
  projectId: string;
  changeId: string; // User-facing, max 20 chars
  description: string;
  type: string; // From enterprise
  status: 'Approved' | 'Pending' | 'Rejected' | 'Withdrawn';
  initiator: string; // max 50 chars
  reference: string; // max 50 chars
  budget: number; // Sum of children
  eac: number; // Sum of children
  periodId?: string;
  enterpriseAttributes?: Record<string, string>;
  projectAttributes?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

interface ChangeRecord {
  id: string;
  changeId: string; // Parent Change doc ID
  projectId: string;
  costCodeId: string;
  scope: string; // max 100 chars
  enterpriseAttributes: Record<string, string>;
  projectAttributes: Record<string, string>;
  budgetAmount: number;
  eacAmount: number;
  createdAt: string;
  updatedAt: string;
}
```

#### 6. Risk & RiskRecord
```typescript
interface Risk {
  id: string;
  projectId: string;
  riskId: string; // User-facing, max 20 chars
  description: string;
  type: string;
  status: 'Open' | 'Mitigated' | 'Closed' | 'Realized';
  strategy: 'Avoid' | 'Mitigate' | 'Transfer' | 'Accept';
  initiator: string; // max 50 chars
  reference: string; // max 50 chars
  exposure: number; // Sum of children (Beta-PERT)
  minImpactTotal?: number;
  mostLikelyImpactTotal?: number;
  maxImpactTotal?: number;
  mitigation: number; // Legacy
  residualExposure: number; // Legacy
  periodId?: string;
  enterpriseAttributes?: Record<string, string>;
  projectAttributes?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

interface RiskRecord {
  id: string;
  riskId: string;
  projectId: string;
  costCodeId: string;
  scope: string; // max 100 chars
  enterpriseAttributes: Record<string, string>;
  projectAttributes: Record<string, string>;
  probability: number; // 0-1
  minImpactAmount: number;
  mostLikelyImpactAmount: number;
  maxImpactAmount: number;
  betaPertImpactAmount: number; // Computed
  createdAt: string;
  updatedAt: string;
}
```

#### 7. Subcontract, SubcontractLineItem, Invoice
```typescript
interface Subcontract {
  id: string;
  projectId: string;
  enterpriseId: string;
  orderId: string; // Max 50 chars, unique per project
  orderName: string;
  orderScope: string;
  status: 'Active' | 'Complete' | 'On Hold';
  defaultCostCodeId?: string;
  defaultPhasingSource?: 'Manual' | 'Auto';
  defaultStartDate?: string;
  defaultEndDate?: string;
  defaultDistribution?: 'Even' | 'Bell Curve' | 'Front load' | 'Back load' | 'S-Curve' | 'Profile';
  paymentType: 'LumpSum' | 'Schedule of Rates' | 'Re-measurable';
  awardDate: string;
  vendorId: string;
  vendorName: string;
  vendorUsers: string[]; // Emails
  totalAmount: number;
  forecastChanges?: number;
  lineItems: SubcontractLineItem[];
  enterpriseSubcontractAttributes?: Record<string, string>;
  projectAttributes?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

interface SubcontractLineItem {
  id: string;
  subcontractId: string;
  projectId: string;
  itemNo: string;
  description: string;
  activityId?: string;
  costCodeId?: string;
  date?: string;
  qty: number;
  unit: string;
  rate: number;
  total: number;
  type: 'Original' | 'ChangeOrder';
  status: 'Approved' | 'Pending' | 'Forecast' | 'Rejected';
  startDate?: string;
  endDate?: string;
  phasingSource?: 'Manual' | 'Auto';
  distribution?: 'Even' | 'Bell Curve' | 'Front load' | 'Back load' | 'S-Curve' | 'Profile';
  periodValues?: Record<string, number>;
  enterpriseAttributes: Record<string, string>;
  projectAttributes: Record<string, string>;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

interface Invoice {
  id: string;
  subcontractId: string;
  projectId: string;
  enterpriseId: string;
  invoiceId: string;
  description: string;
  submittedDate?: string;
  certifiedDate?: string;
  paymentDate?: string;
  status: 'Draft' | 'Submitted' | 'Certified' | 'Rejected' | 'Paid';
  initiator?: string;
  vendorId: string;
  vendorName: string;
  totalAmount: number;
  certifiedAmount: number;
  items: InvoiceItem[];
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

interface InvoiceItem {
  id: string;
  subcontractLineItemId: string;
  itemNo: string;
  description: string;
  qty: number;
  unit: string;
  rate: number;
  total: number;
  claimQty: number;
  claimPercent: number;
  claimValue: number;
  periodicClaimQty?: number;
  periodicClaimPercent?: number;
  periodicClaimValue?: number;
  certifiedQty: number;
  certifiedPercent: number;
  certifiedValue: number;
  periodicCertifiedQty?: number;
  periodicCertifiedPercent?: number;
  periodicCertifiedValue?: number;
  commentary?: string;
}
```

#### 8. ProgressPackage & ProgressItem
```typescript
interface ProgressPackage {
  id: string;
  projectId: string;
  packageId: string; // Unique per project, max 20 chars
  description: string;
  ruleOfCreditId?: string;
  unit?: string;
  attributes?: Record<string, string>;
  defaultStartDate?: string;
  defaultEndDate?: string;
  defaultPhasingMethod?: 'Auto' | 'Manual';
  defaultPhasingCurve?: 'Scurve' | 'Bell' | 'front load' | 'back load' | 'even';
  createdAt: string;
  updatedAt: string;
}

interface ProgressItem {
  id: string;
  projectId: string;
  packageId: string; // User-facing package ID
  packageDocId: string; // Firestore ID
  itemId: string; // Unique per package
  activityId?: string;
  description: string;
  costCodeId: string;
  totalQty: number;
  totalQtyPrevious?: number;
  earnedQtyPrevious?: number;
  plannedStartDate: string;
  plannedEndDate: string;
  phasingMethod: 'Auto' | 'Manual';
  phasingCurve: 'Scurve' | 'Bell' | 'front load' | 'back load' | 'even';
  projectAttributes?: Record<string, string>;
  enterpriseAttributes?: Record<string, string>;
  ruleOfCreditId?: string;
  ruleOfCreditProgress?: Record<string, number>; // stepId -> 0-100%
  periodValues?: Record<string, number>; // periodId -> qty
  currentStartDate?: string;
  currentEndDate?: string;
  currentPhasingMethod?: 'Auto' | 'Manual';
  currentPhasingCurve?: 'Scurve' | 'Bell' | 'front load' | 'back load' | 'even';
  currentPeriodValues?: Record<string, number>;
  actualPeriodValues?: Record<string, number>;
  sortOrder?: number;
  createdAt: string;
  updatedAt: string;
}

interface RuleOfCredit {
  id: string;
  projectId: string;
  ruleId: string; // Max 20 chars
  description: string;
  packageId?: string;
  userField1?: string;
  userField2?: string;
  userField3?: string;
  userField4?: string;
  userField5?: string;
  steps?: RuleOfCreditStep[];
  createdAt: string;
}

interface RuleOfCreditStep {
  id: string;
  orderNo: number; // Decimal, max 10
  description: string; // Max 100 chars
  weight: number; // Decimal proportion
}
```

#### 9. ProcurementItem & ProcurementStepDefinition
```typescript
interface ProcurementItem {
  id: string;
  projectId: string;
  packageId: string;
  description: string;
  calendarId?: string;
  category?: string;
  enterpriseAttributes?: Record<string, string>;
  projectAttributes?: Record<string, string>;
  stepData: Record<string, ProcurementStepData>; // stepId -> step data
  createdAt: string;
  updatedAt: string;
}

interface ProcurementStepData {
  plannedDate?: string;
  actualDate?: string;
  forecastDate?: string;
  planDuration?: number; // Days to next step
  forecastDuration?: number;
}

interface ProcurementStepDefinition {
  id: string;
  projectId?: string;
  enterpriseId?: string;
  name: string;
  order: number;
  isEnterpriseStandard?: boolean;
  defaultDurationDays?: number;
  enterpriseStepId?: string;
}
```

#### 10. ScheduleItem & Calendar
```typescript
interface ScheduleItem {
  id: string;
  projectId: string;
  activityId: string;
  description: string;
  activityPercentComplete: number;
  baselineStartDate: string;
  baselineEndDate: string;
  plannedStartDate: string;
  plannedEndDate: string;
  currentStartDate: string;
  currentEndDate: string;
  updatedAt: string;
}

interface Calendar {
  id: string;
  projectId?: string;
  enterpriseId?: string;
  name: string;
  weekends: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  holidays: string[]; // ISO dates "YYYY-MM-DD"
  createdAt: string;
}
```

#### 11. Enterprise & User
```typescript
interface Enterprise {
  id: string;
  enterpriseId: string;
  name: string;
  logoURL?: string;
  adminUsers: string[]; // UIDs
  createdAt: string;
  theme?: 'light' | 'dark';
  users?: Record<string, {
    email: string;
    name?: string;
    displayName?: string;
    photoURL?: string;
    joinedDate?: string;
    joinedAt?: string;
    role: 'Enterprise System Admin' | 'Enterprise User';
  }>;
  // Attributes (10 slots each)
  projectAttributes?: ProjectAttribute[];
  lineItemAttributes?: ProjectAttribute[];
  costCodeAttributes?: ProjectAttribute[];
  subcontractAttributes?: ProjectAttribute[];
  changeAttributes?: ProjectAttribute[];
  riskAttributes?: ProjectAttribute[];
  procurementAttributes?: ProjectAttribute[];
  progressAttributes?: ProjectAttribute[];
  
  changeTypes?: string[];
  riskTypes?: string[];
  resourceRates?: ResourceRate[];
  costElements?: CostElement[];
  categories?: string[];
  controlAccounts?: string[];
  orderNumbers?: string[];
  vendors?: Vendor[];
}

interface ProjectAttribute {
  id: string; // "01" to "10"
  title: string;
  values: ProjectAttributeValue[];
}

interface ProjectAttributeValue {
  id: string;
  description: string;
  sortOrder: number;
}
```

---

## 5. Domain Logic: Formulas & Calculations

All canonical formulas defined in `src/domain/` files.

### EAC (Estimate at Completion)

**File**: `src/domain/eac.ts`

**Method 1: Manual EAC**
```
EAC = manually entered value
```

**Method 2: Change Management**
```
EAC = Actuals to Date + Sum(Approved Changes)
```

**Method 3: ETC Details**
```
EAC = Actuals to Date + Sum(ETC Detail amounts)
```

**Method 4: Sub-Contract Management**
```
EAC = Sum(Subcontract total amounts)
```

**Cost Variance**
```
CostVariance = ApprovedBudget - EAC
(positive = under-budget)
```

**Movement (Period-to-Period)**
```
Movement = CurrentPeriodValue - PriorPeriodValue
```

### Risk Exposure (Beta-PERT)

**File**: `src/domain/risk.ts`

```typescript
// Beta-PERT weighted impact
betaPertImpact = (min + 4×mostLikely + max) / 6

// Risk exposure
betaPertExposure = betaPertImpact × probability
```

**Example**:
```
Min: $100k, Most Likely: $200k, Max: $300k, Probability: 40%
betaPertImpact = (100 + 4×200 + 300) / 6 = 1300 / 6 = $216.7k
exposure = $216.7k × 0.4 = $86.7k
```

### Progress & Earned Value

**File**: `src/domain/progress.ts`

```typescript
// Rule-of-credit percent complete
rocPercentComplete(steps, progress) = 
  Σ(progress[step.id] × step.weight / 100)

// Earned quantity
earnedQty = (rocPercent / 100) × totalQty

// Overall project percent complete
overallPercentComplete = (totalEarned / totalQty) × 100
```

**Example**:
```
Steps:
  - Start (50% weight)
  - 50% complete (30% weight)
  - Final (20% weight)

Progress:
  - Start: 100%
  - 50% complete: 50%
  - Final: 0%

rocPercent = (100×0.5 + 50×0.3 + 0×0.2) / 100 = 65%
earnedQty = (65/100) × 1000 units = 650 units
```

### Time Phasing Distribution

**File**: `src/domain/phasing.ts`

```typescript
// Distribute total amount across periods using method
calculatePhasing(
  total: number,
  periods: number,
  method: 'even' | 'front' | 'back' | 'bell' | 'scurve'
): Record<periodId, number>
```

Methods:
- **Even**: Split equally across all periods
- **Front**: Concentrate at beginning
- **Back**: Concentrate at end
- **Bell**: Peak in middle, taper at ends
- **S-Curve**: Slow start, faster middle, slower end

### Procurement Date Calculations

**File**: `src/domain/procurement.ts`

```typescript
// Check if working day
isWorkingDay(date, calendar): boolean
  // Return false if day-of-week is in calendar.weekends
  // Return false if date is in calendar.holidays

// Add business days (forward)
addBusinessDays(startDate, days, calendar): string
  // Increment date by days, skip non-working days

// Subtract business days (backward)
subtractBusinessDays(startDate, days, calendar): string
  // Decrement date by days, skip non-working days

// Recalculate planned dates (backward from last step)
recalculatePlannedDates(stepData, steps, calendar): Record<string, any>
  // For each step, compute plannedDate = next step's plannedDate - planDuration

// Recalculate forecast dates (forward from first step)
recalculateForecastDates(stepData, steps, calendar, cutoffDate): Record<string, any>
  // First step: IF(actual, actual, MAX(planned, cutoffDate))
  // Other steps: IF(actual, actual, prevForecast + prevDuration)
```

---

## 6. Firestore Collections & Security

### Firestore Collections (26 Total)

| Collection | Path | Partitioning | Purpose |
|---|---|---|---|
| enterprises | `/enterprises/{enterpriseId}` | By enterprise | Tenant root |
| users (sub) | `/enterprises/{enterpriseId}/users/{uid}` | By enterprise | Enterprise members |
| projects | `/projects/{projectId}` | By enterprise (query filter) | Project metadata |
| costCodes | `/projects/{projectId}/costCodes/{id}` | By project | Cost tracking |
| changes | `/projects/{projectId}/changes/{id}` | By project | Change orders |
| changeRecords | `/projects/{projectId}/changeRecords/{id}` | By project | Change decomposition |
| risks | `/projects/{projectId}/risks/{id}` | By project | Risk register |
| riskRecords | `/projects/{projectId}/riskRecords/{id}` | By project | Risk decomposition |
| subcontracts | `/projects/{projectId}/subcontracts/{id}` | By project | Subcontract headers |
| invoices | `/projects/{projectId}/invoices/{id}` | By project | Invoices |
| progressPackages | `/projects/{projectId}/progressPackages/{id}` | By project | Progress grouping |
| progressItems | `/projects/{projectId}/progressItems/{id}` | By project | Earned value items |
| rulesOfCredit | `/projects/{projectId}/rulesOfCredit/{id}` | By project | ROC definitions |
| procurementItems | `/projects/{projectId}/procurementItems/{id}` | By project | Procurement items |
| procurementSteps | `/projects/{projectId}/procurementSteps/{id}` | By project | Step definitions |
| scheduleItems | `/projects/{projectId}/scheduleItems/{id}` | By project | Schedule activities |
| calendars (project) | `/projects/{projectId}/calendars/{id}` | By project | Project calendars |
| actualCosts | `/projects/{projectId}/actualCosts/{id}` | By project | Cost actuals |
| baselineBudgets | `/projects/{projectId}/baselineBudgets/{id}` | By project | Baseline allocations |
| etcDetails | `/projects/{projectId}/etcDetails/{id}` | By project | ETC line items |
| costPhasing | `/projects/{projectId}/costPhasing/{id}` | By project | Phasing allocations |
| reportingPeriods | `/projects/{projectId}/reportingPeriods/{id}` | By project | Cost periods |
| sheets | `/sheets/{sheetId}` | By user | Legacy forecast sheets |
| savedViews | `/savedViews/{id}` | By user | Grid view presets |
| userRoles | `/userRoles/{uid}` | By user | Role assignments |
| enterpriseCalendars | `/enterprises/{enterpriseId}/calendars/{id}` | By enterprise | Enterprise calendars |

### Firestore Security Rules Summary

**Location**: `firestore.rules`

**Core Principles**:
1. Users can only access their own enterprise(s)
2. Users can only access projects they're members of (or admins see all)
3. Platform admins (hardcoded emails) can access all enterprises
4. Writes restricted to authorizedUsers based on role

**Rule Functions** (examples):
```firestore
// Check if user is platform admin
function isPlatformAdmin() {
  return request.auth.token.email in ['tarek.guindy@gmail.com', 'tarek_guindy@hotmail.com']
}

// Check if user is enterprise admin
function isEnterpriseAdmin(enterpriseId) {
  return isPlatformAdmin() || 
    get(/databases/$(database)/documents/enterprises/$(enterpriseId)).data.adminUsers[request.auth.uid] == true
}

// Check if user is project member
function isProjectMember(projectId) {
  return get(/databases/$(database)/documents/projects/$(projectId)).data.users[request.auth.uid] != null
}

// Check if user can write to cost code
function canWriteCostCode(projectId) {
  return isProjectMember(projectId) &&
    (get(/databases/$(database)/documents/projects/$(projectId)).data.users[request.auth.uid] in ['Project Admin', 'Project User'])
}
```

**Collection-Level Rules**:
- **Enterprises**: Read/Write restricted to admins; Platform admins see all
- **Projects**: Read/Write restricted to project members; Enterprise admins see all within enterprise
- **Subcollections** (costCodes, etc.): Inherit project permissions; must specify projectId in queries
- **userRoles**: Each user can only read their own
- **sheets** & **savedViews**: Each user can only read their own

---

## 7. Authentication & Authorization

### Firebase Authentication
- **Provider**: Google OAuth, Email/Password
- **User ID**: Firebase UID
- **Token**: JWT (stored in browser)
- **Verification**: Email verification required before account activation

### Role Model

**Platform Roles**:
```typescript
type PlatformRole = 'platform_admin';
```

**Enterprise Roles**:
```typescript
type EnterpriseRole = 'enterprise_admin' | 'enterprise_member';
```

**Project Roles**:
```typescript
type ProjectRole = 'project_admin' | 'project_writer' | 'project_reader' | 'project_guest';
```

**Role Hierarchy**:
```
Platform Admin
├── (all enterprises visible & modifiable)
└── (all projects visible & modifiable)

Enterprise Admin
├── (enterprise members & projects visible & modifiable)
└── (assigned projects visible & modifiable)

Project Admin
├── (project settings visible & modifiable)
└── (all modules in project visible & modifiable)

Project Writer
└── (all modules in project visible & modifiable, no settings)

Project Reader
└── (all modules in project visible only)

Project Guest
└── (limited access, e.g., vendors for invoicing)
```

### Permission Checks in Code

**AuthState Hook** (`src/platform/firestore/hooks.ts`):
```typescript
export function useAuth(): AuthState {
  return {
    user: AuthUser | null,
    roles: UserRoles | null,
    loading: boolean,
    isPlatformAdmin: boolean,
    enterpriseRole: (enterpriseId: string) => EnterpriseRole | null,
  };
}
```

**Component Usage**:
```tsx
const { user, roles, isPlatformAdmin, enterpriseRole } = useAuth();

const isEnterpriseAdmin = enterpriseRole(enterprise.id) === 'enterprise_admin';
const isProjectAdmin = project?.users?.[user?.id]?.role === 'project_admin' || isPlatformAdmin;

if (!isProjectAdmin) {
  return <div>Access Denied</div>;
}
```

---

## 8. Build & Deployment

### Development Commands

```bash
# Install dependencies
npm install

# Development server (Vite + Express)
npm run dev

# Type checking
npm run type-check
npm run lint

# Testing
npm run test          # Run all tests once
npm run test:watch    # Run tests in watch mode
npm run test:ui       # Run tests with UI
npm run test:e2e      # Run Playwright E2E tests
npm run test:e2e:ui   # Run E2E tests with UI
```

### Build & Production

```bash
# Production build
npm run build

# Output:
# - dist/ : Vite bundle (React SPA)
# - dist/server.cjs : Express server (esbuild bundle)

# Production server
npm run start

# Runs on: http://localhost:3001 (default PORT env var)
```

### Environment Variables

**Required** (`.env` or `.env.local`):
```
FIREBASE_API_KEY=xxx
FIREBASE_AUTH_DOMAIN=xxx
FIREBASE_PROJECT_ID=xxx
FIREBASE_STORAGE_BUCKET=xxx
FIREBASE_MESSAGING_SENDER_ID=xxx
FIREBASE_APP_ID=xxx
RESEND_API_KEY=xxx (for email invitations)
```

**Optional**:
```
GEMINI_API_KEY=xxx (for AI features)
VITE_ADAPTER=memory (use memory adapter instead of Firestore)
DISABLE_HMR=true (disable hot module reloading)
PORT=3001 (server port)
NODE_ENV=production (production mode)
```

### Deployment to Vercel

The app is deployable to Vercel with:
- Frontend: Vite SPA (static deployment to `/dist`)
- Backend: Express server bundled as `dist/server.cjs`
- Environment variables set in Vercel project settings
- Automatic deploys on push to main branch

---

## 9. Testing Strategy

### Unit Tests (Vitest)

**Covered Formulas**:
- `src/domain/eac.test.ts`: EAC/ETC computations
- `src/domain/progress.test.ts`: ROC & earned value
- `src/domain/procurement.test.ts`: Business day calculations

**Example Test**:
```typescript
import { betaPertExposure } from '../src/domain/risk';

describe('Beta-PERT Risk Exposure', () => {
  test('calculates exposure correctly', () => {
    const exposure = betaPertExposure(100, 200, 300, 0.4);
    expect(exposure).toBe((100 + 800 + 300) / 6 * 0.4);
  });
});
```

### E2E Tests (Playwright)

**Location**: `tests/e2e/`

**Scope**: Key user workflows
- Login/logout
- Cost code creation & EAC calculation
- Change order approval
- Risk identification & tracking
- Subcontract invoicing workflow

**Run**:
```bash
npm run test:e2e
npm run test:e2e:ui # UI mode
npm run test:e2e:report # View report
```

### Memory Adapter Testing

For testing without Firestore:
```bash
VITE_ADAPTER=memory npm run dev:memory
```

The memory adapter provides:
- In-memory store with BehaviorSubject subscriptions
- Synchronous operations (no network latency)
- Deterministic for isolated testing

---

## 10. Performance & Optimization

### Firestore Optimization
- **Real-time subscriptions**: Only subscribe to visible/necessary data
- **Batch writes**: Bulk operations use `writeBatch()` to reduce round-trips
- **Indexes**: Composite indexes on (enterpriseId, projectId) for queries
- **Collection groups**: Optional for cross-tenant queries (disabled by default)

### React Optimization
- **Memoization**: `useMemo`, `useCallback` for expensive computations
- **Lazy loading**: Code-splitting via React Router for modules
- **Ag-Grid**: Enterprise edition for advanced row virtualization
- **State management**: Minimal global state; component-local state preferred

### Data Grid Performance
- **Ag-Grid row virtualization**: Only renders visible rows
- **Lazy cell rendering**: Custom cell renderers with lazy loading
- **Pagination**: Support for large datasets (optional)
- **Filtering**: Client-side filters on small datasets; consider server-side for 100k+ rows

---

## 11. Error Handling & Logging

### Client-Side Error Handling
- **Error Boundary**: `ErrorBoundary.tsx` catches React render errors
- **Try-catch**: Async operations wrapped in try-catch
- **Toast notifications**: Sonner for user-facing error messages
- **Console logging**: Detailed logs in development mode

### Firestore Error Handling
- **Authentication errors**: Redirect to login
- **Permission denied**: Display "Access Denied" message
- **Network errors**: Retry with exponential backoff
- **Data validation**: Enforce constraints at adapter layer

### Logging
- **Development**: Console logs enabled
- **Production**: Minimal logging (opt-in via env var)
- **Error tracking**: Optional integration with Sentry (not yet implemented)

---

## 12. Security Considerations

### Data Security
1. **Firestore Rules**: Enforce all access control at database level
2. **Authentication**: Firebase Auth with email verification
3. **HTTPS**: All traffic encrypted (Vercel + Firebase)
4. **Token expiry**: JWT tokens auto-refresh via Firebase SDK

### Sensitive Data
- **PII**: User emails, names stored in Firestore (encrypted at rest by Google)
- **Financial data**: Budget, costs stored unencrypted in Firestore
- **No secrets in client**: API keys (GEMINI, RESEND) server-side only
- **Environment variables**: Stored in Vercel secrets (not in repo)

### API Security
- **Express server**: Validates all inputs (RESEND API)
- **CORS**: Configured for Vercel domain
- **Rate limiting**: Not yet implemented (consider for invite endpoint)

---

## 13. Monitoring & Debugging

### Debug Mode
- **URL param**: `?debug=1` enables verbose logging
- **Local storage**: `localStorage.debug=true` persists across page loads

### Performance Monitoring
- **React DevTools**: Browser extension for component profiling
- **Ag-Grid Inspector**: Built-in grid debugging
- **Firestore emulator**: Optional local development

### Common Issues & Solutions

| Issue | Cause | Solution |
|---|---|---|
| **Grid data not updating** | Subscription not re-subscribed | Check `useEffect` dependencies |
| **Permission denied on write** | Role mismatch | Verify Firestore rules & user role |
| **Slow grid rendering** | Too many rows/columns | Enable pagination, optimize cell renderers |
| **Memory leak warning** | Unclean subscription cleanup | Ensure `useEffect` cleanup functions run |
| **Auth token expired** | Session too long | Firebase SDK auto-refreshes; check network |

---

## 14. Known Limitations & Future Work

### Current Limitations
1. **Real-time sync on bulk edits**: Bulk updates may not reflect immediately in all browser tabs
2. **Offline support**: Not implemented (requires local storage + sync)
3. **Audit trail**: Not fully captured; logs available via Firestore history
4. **Data export**: Limited to grid export (no full database backup UI)
5. **Mobile support**: Responsive but not optimized for small screens

### Future Enhancements
1. **AI-assisted forecasting**: Use GEMINI API for EAC recommendations
2. **Advanced analytics**: ML models for risk prediction
3. **Integrations**: API connectors for ERP/accounting systems
4. **Offline sync**: Service worker + local storage for offline capability
5. **Multi-currency**: Support for international projects
6. **Real-time collaboration**: Cursor/comment sync between users

---

## 15. Code Organization Best Practices

### Component Structure
```tsx
// Each feature module has:
// - Main component (e.g., CostCodes.tsx)
// - Subcomponents in folders (e.g., cost-codes/)
// - Column definitions for grids (columns.tsx)
// - Dialogs for forms (CostCodeFormDialog.tsx)
// - Panels for sub-views (EtcDetailsPanel.tsx)

export default function CostCodes({ project, enterprise }) {
  const [data, setData] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  
  // 1. Data fetching (subscriptions)
  useEffect(() => { /* subscribe */ }, []);
  
  // 2. Computed values (memoized)
  const computed = useMemo(() => { /* compute */ }, [data]);
  
  // 3. Event handlers
  const handleCreate = () => { /* create */ };
  const handleDelete = () => { /* delete */ };
  
  // 4. Render
  return <div>...</div>;
}
```

### Naming Conventions
- **Components**: PascalCase (e.g., `CostCodeFormDialog`)
- **Functions**: camelCase (e.g., `calculateEac`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_COST_CODE_LENGTH`)
- **Interfaces**: PascalCase with I prefix (optional, avoid if using domain/types.ts)
- **Files**: Match component/function name (e.g., `CostCodes.tsx`)

### Import Organization
```tsx
// 1. React & external libraries
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// 2. Domain logic
import { computeEac } from '../domain/eac';

// 3. Platform (repos, hooks)
import { useCostRepo } from '../platform/firestore/hooks';

// 4. Components
import CostCodeFormDialog from './CostCodeFormDialog';

// 5. Utilities
import { formatCurrency } from '../lib/utils';

// 6. Styles & assets
import 'ag-grid-community/styles/ag-grid.css';
```

---

## Appendix: Glossary

| Term | Definition |
|---|---|
| **EAC** | Estimate at Completion; forecasted final cost |
| **ETC** | Estimate to Complete; EAC − Actuals to Date |
| **Cost Variance** | Approved Budget − EAC (positive = under-budget) |
| **Beta-PERT** | Weighted-average estimating using min/mostLikely/max |
| **ROC** | Rule of Credit; % complete metric for progress items |
| **Earned Value** | Quantity × % Complete for progress tracking |
| **Phasing** | Distribution of costs across time periods |
| **Cost Code** | Work breakdown structure element; lowest-level cost tracking unit |
| **Subcontract** | Vendor agreement with line items and invoices |
| **Change Order** | Modification to project scope affecting budget/EAC |
| **Risk Record** | Decomposition of risk into a cost code with exposure |
| **Procurement Step** | Phase in vendor selection (e.g., RFQ, Bid, Award) |
| **Reporting Period** | Monthly/weekly bucket for cost actuals |
| **Port** | Abstract interface defining data access contract |
| **Adapter** | Concrete implementation of Port (Firestore or Memory) |
| **Tenant** | Enterprise (multi-tenancy model) |

---

**End of Technical Specification**

