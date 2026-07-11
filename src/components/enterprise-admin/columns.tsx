import { ColDef, ColGroupDef } from 'ag-grid-community';
import { Users, MoreVertical, Edit2, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ProjectAttribute } from '../../types';

// ---------------------------------------------------------------------------
// buildUserColumnDefs
// ---------------------------------------------------------------------------

interface UserColumnDeps {
  setContextMenu: (menu: { x: number; y: number; type: 'user' | 'project' | 'attr-value' | 'rate' | 'costElement' | 'vendor'; id: string } | null) => void;
}

export function buildUserColumnDefs(deps: UserColumnDeps): (ColDef | ColGroupDef)[] {
  const { setContextMenu } = deps;
  return [
    {
      headerName: 'Photo',
      field: 'photoURL',
      width: 80,
      cellRenderer: (params: any) => (
        <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center overflow-hidden">
          {params.value ? (
            <img src={params.value} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <Users className="w-4 h-4 text-gray-400" />
          )}
        </div>
      )
    },
    {
      headerName: 'Name',
      field: 'displayName',
      flex: 1,
      editable: true,
      cellRenderer: (params: any) => (
        <div className="flex flex-col">
          <span className="text-xs font-medium dark:text-white">{params.value || params.data.name || 'Anonymous'}</span>
          <span className="text-[10px] text-gray-400">ID: {params.data.uid.slice(0, 8)}...</span>
        </div>
      )
    },
    { headerName: 'Email', field: 'email', flex: 1.5, editable: true },
    {
      headerName: 'Joined',
      field: 'joinedAt',
      width: 120,
      valueFormatter: (params: any) => params.value ? new Date(params.value).toLocaleDateString() : 'N/A'
    },
    {
      headerName: 'Access',
      field: 'role',
      width: 180,
      cellRenderer: (params: any) => (
        <Badge variant="outline" className={cn(
          "text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5",
          params.value === 'Enterprise System Admin' ? "border-blue-200 text-blue-600 bg-blue-50 dark:bg-blue-500/10 dark:border-blue-500/20" : "border-gray-200 text-gray-500 dark:border-white/10 dark:text-gray-400"
        )}>
          {params.value}
        </Badge>
      )
    },
    {
      headerName: '',
      width: 60,
      pinned: 'right',
      cellRenderer: (params: any) => {
        if (params.data.isSubtotal) return null;
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setContextMenu({ x: e.clientX, y: e.clientY, type: 'user', id: params.data.uid });
            }}
            className="p-1 text-gray-400 hover:text-black dark:hover:text-white"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        );
      }
    }
  ];
}

// ---------------------------------------------------------------------------
// buildProjectColumnDefs
// ---------------------------------------------------------------------------

interface ProjectColumnDeps {
  selectedProjectId: string | null;
  activeMenuId: string | null;
  setActiveMenuId: (id: string | null) => void;
  projectAttributes: ProjectAttribute[];
  handleUpdateProjectStatus: (projectId: string, status: string) => Promise<void>;
}

export function buildProjectColumnDefs(deps: ProjectColumnDeps): (ColDef | ColGroupDef)[] {
  const { selectedProjectId, activeMenuId, setActiveMenuId, projectAttributes, handleUpdateProjectStatus } = deps;
  return [
    {
      headerName: 'Project Code',
      field: 'projectCode',
      width: 150,
      pinned: 'left',
      lockPosition: 'left',
      cellStyle: { fontWeight: 'bold' },
      editable: false
    },
    {
      headerName: 'Project Name',
      field: 'projectName',
      flex: 1,
      minWidth: 200,
      editable: true,
      cellStyle: (params: any) => ({ color: selectedProjectId === params.data.id ? '#2563eb' : undefined })
    },
    {
      headerName: 'Enterprise Project Attributes',
      openByDefault: true,
      children: (projectAttributes || [])
        .filter((attr: ProjectAttribute) => attr.title)
        .map((attr: ProjectAttribute) => ({
          headerName: attr.title,
          field: `attributes.${attr.id}`,
          width: 200,
          editable: true,
          cellEditor: 'agRichSelectCellEditor',
          cellEditorParams: {
            values: (attr.values || [])
              .sort((a: any, b: any) => (a.id || '').localeCompare(b.id || ''))
              .map((v: any) => `${v.id} | ${v.description}`),
            searchType: 'matchAny',
            allowTyping: true,
            filterList: true
          },
          valueParser: (params: any) => {
            if (typeof params.newValue === 'string') {
              const val = params.newValue.split(' | ')[0].trim();
              return val;
            }
            return params.newValue;
          },
          valueSetter: (params: any) => {
            const val = params.newValue;
            if (!params.data.attributes) {
              params.data.attributes = {};
            }
            params.data.attributes[attr.id] = val;
            return true;
          },
          valueFormatter: (params: any) => {
            if (!params.value) return '';
            const match = attr.values?.find((v: any) => v.id === params.value);
            return match ? `${match.id} | ${match.description}` : params.value;
          }
        }))
    },
    {
      headerName: 'System Columns',
      children: [
        {
          headerName: 'Status',
          field: 'status',
          width: 120,
          cellRenderer: (params: any) => (
            <select
              value={params.value || 'Active'}
              onChange={(e) => handleUpdateProjectStatus(params.data.id, e.target.value)}
              className="text-[10px] font-bold uppercase tracking-widest bg-gray-100 dark:bg-white/5 border-none rounded-lg px-2 py-1 text-gray-700 dark:text-gray-300 focus:ring-1 focus:ring-blue-500 outline-none w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <option value="Active">Active</option>
              <option value="On Hold">On Hold</option>
              <option value="Closed">Closed</option>
              <option value="Archived">Archived</option>
            </select>
          )
        },
        {
          headerName: 'Created Date',
          field: 'dateCreated',
          width: 130,
          valueFormatter: (params: any) => params.value ? new Date(params.value).toLocaleDateString() : 'N/A'
        },
        {
          headerName: 'Created By',
          field: 'createdByEmail',
          width: 180,
          cellClass: 'text-gray-500'
        },
        {
          headerName: 'Modified Date',
          field: 'dateLastModified',
          width: 130,
          valueFormatter: (params: any) => params.value ? new Date(params.value).toLocaleDateString() : 'N/A'
        },
        {
          headerName: 'Modified By',
          field: 'modifiedByEmail',
          width: 180,
          cellClass: 'text-gray-500'
        },
        {
          headerName: 'Users',
          field: 'users',
          width: 80,
          valueGetter: (params: any) => Object.keys(params.value || {}).length
        }
      ]
    },
    {
      headerName: '',
      width: 60,
      pinned: 'right',
      cellRenderer: (params: any) => {
        if (params.data.isSubtotal) return null;
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActiveMenuId(activeMenuId === `project-${params.data.id}` ? null : `project-${params.data.id}`);
            }}
            className="p-1 text-gray-400 hover:text-black dark:hover:text-white"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        );
      }
    }
  ];
}

// ---------------------------------------------------------------------------
// buildAttributeValueColumnDefs
// ---------------------------------------------------------------------------

type AttributeType = 'project' | 'lineItem' | 'costCode' | 'subcontract' | 'procurement' | 'change' | 'risk' | 'progress';

interface AttributeValueColumnDeps {
  activeTab: string;
  selectedAttrId: string | null;
  deleteAttributeValue: (type: AttributeType, attrId: string, valueId: string) => Promise<void>;
}

export function buildAttributeValueColumnDefs(deps: AttributeValueColumnDeps): (ColDef | ColGroupDef)[] {
  const { activeTab, selectedAttrId, deleteAttributeValue } = deps;
  return [
    {
      headerName: 'ID',
      field: 'id',
      width: 120,
      pinned: 'left',
      lockPosition: 'left',
      cellStyle: { fontWeight: 'bold' },
      editable: false
    },
    {
      headerName: 'Description',
      field: 'description',
      flex: 1,
      editable: true
    },
    {
      headerName: 'Sort Order',
      field: 'sortOrder',
      width: 120,
      editable: true
    },
    {
      headerName: '',
      width: 60,
      pinned: 'right',
      cellRenderer: (params: any) => {
        if (params.data.isSubtotal) return null;
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              const type = activeTab === 'projectAttributes' ? 'project' : activeTab === 'costCodeAttributes' ? 'costCode' : activeTab === 'subcontractAttributes' ? 'subcontract' : activeTab === 'procurementAttributes' ? 'procurement' : activeTab === 'changeAttributes' ? 'change' : activeTab === 'riskAttributes' ? 'risk' : activeTab === 'progressAttributes' ? 'progress' : 'lineItem';
              deleteAttributeValue(type as AttributeType, selectedAttrId!, params.data.id);
            }}
            className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        );
      }
    }
  ];
}

// ---------------------------------------------------------------------------
// buildResourceRateColumnDefs
// ---------------------------------------------------------------------------

interface ResourceRateColumnDeps {
  setResourceFormData: (data: any) => void;
  setIsEditingResource: (editing: { id: string | null; insertIndex?: number } | null) => void;
  setDeleteConfirm: (confirm: { type: 'user' | 'bulk-user' | 'project' | 'bulk-project' | 'bulk-attr-value' | 'rate' | 'bulk-rate' | 'costElement' | 'bulk-costElement' | 'vendor' | 'bulk-vendor'; id?: string; name?: string; count?: number } | null) => void;
}

export function buildResourceRateColumnDefs(deps: ResourceRateColumnDeps): (ColDef | ColGroupDef)[] {
  const { setResourceFormData, setIsEditingResource, setDeleteConfirm } = deps;
  return [
    {
      headerName: 'Resource ID',
      field: 'id',
      width: 150,
      pinned: 'left',
      lockPosition: 'left',
      cellStyle: { fontWeight: 'bold' },
      editable: false
    },
    { headerName: 'Resource Name', field: 'name', flex: 1, editable: true },
    { headerName: 'Category', field: 'category', width: 150, editable: true },
    { headerName: 'Unit', field: 'unit', width: 100, editable: true },
    {
      headerName: 'Rate ($)',
      field: 'rate',
      width: 120,
      type: 'numericColumn',
      editable: true,
      valueFormatter: (params: any) => params.value ? `$${params.value.toLocaleString()}` : '-'
    },
    { headerName: 'UDF 1', field: 'udf1', width: 120, editable: true },
    { headerName: 'UDF 2', field: 'udf2', width: 120, editable: true },
    { headerName: 'UDF 3', field: 'udf3', width: 120, editable: true },
    {
      headerName: '',
      width: 60,
      pinned: 'right',
      cellRenderer: (params: any) => {
        if (params.data.isSubtotal) return null;
        return (
          <div className="flex gap-1">
            <button
              onClick={() => {
                setResourceFormData(params.data);
                setIsEditingResource({ id: params.data.id });
              }}
              className="p-1 text-gray-400 hover:text-black dark:hover:text-white"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setDeleteConfirm({ type: 'rate', id: params.data.id, name: params.data.name })}
              className="p-1 text-gray-400 hover:text-red-600"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        );
      }
    }
  ];
}

// ---------------------------------------------------------------------------
// buildVendorColumnDefs
// ---------------------------------------------------------------------------

interface VendorColumnDeps {
  setVendorFormData: (data: any) => void;
  setIsEditingVendor: (editing: { id: string | null; insertIndex?: number } | null) => void;
  setDeleteConfirm: (confirm: { type: 'user' | 'bulk-user' | 'project' | 'bulk-project' | 'bulk-attr-value' | 'rate' | 'bulk-rate' | 'costElement' | 'bulk-costElement' | 'vendor' | 'bulk-vendor'; id?: string; name?: string; count?: number } | null) => void;
}

export function buildVendorColumnDefs(deps: VendorColumnDeps): (ColDef | ColGroupDef)[] {
  const { setVendorFormData, setIsEditingVendor, setDeleteConfirm } = deps;
  return [
    { headerName: 'Vendor ID', field: 'id', width: 150, editable: false },
    { headerName: 'Vendor Name', field: 'name', flex: 1, editable: true },
    { headerName: 'Contact Name', field: 'contactName', width: 150, editable: true },
    { headerName: 'Contact Email', field: 'contactEmail', width: 200, editable: true },
    {
      headerName: '',
      width: 100,
      pinned: 'right',
      cellRenderer: (params: any) => {
        if (params.data.isSubtotal) return null;
        return (
          <div className="flex gap-1">
            <button
              onClick={() => {
                setVendorFormData(params.data);
                setIsEditingVendor({ id: params.data.id });
              }}
              className="p-1 text-gray-400 hover:text-black dark:hover:text-white"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setDeleteConfirm({ type: 'vendor', id: params.data.id, name: params.data.name })}
              className="p-1 text-gray-400 hover:text-red-600"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        );
      }
    }
  ];
}
