import React, { useMemo, useCallback, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { 
  ColDef, 
  ValueGetterParams, 
  CellValueChangedEvent,
  GridReadyEvent,
  ValueFormatterParams
} from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import { format, addMonths, startOfMonth, parseISO, isAfter } from 'date-fns';
import { Project, Enterprise, ForecastRow } from '../types';

interface AgGridSheetProps {
  sheetId: string;
  sheetType: 'commitment' | 'time-based';
  project: Project;
  enterprise: Enterprise;
  data: ForecastRow[];
  onDataChange: (newData: ForecastRow[]) => void;
  theme: 'light' | 'dark';
}

export default function AgGridSheet({ 
  sheetId,
  sheetType, 
  project, 
  enterprise, 
  data, 
  onDataChange,
  theme 
}: AgGridSheetProps) {
  const gridRef = useRef<AgGridReact>(null);

  // Generate phasing months
  const phasingMonths = useMemo(() => {
    try {
      const startStr = project.startDate || new Date().toISOString();
      const endStr = project.endDate || new Date().toISOString();
      
      const start = startOfMonth(parseISO(startStr));
      const end = parseISO(endStr);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        console.warn('Invalid project dates in AgGridSheet:', { startStr, endStr });
        return [format(new Date(), 'MMM yy')];
      }

      const months = [];
      let current = start;
      let safetyCounter = 0;
      
      // Limit to 120 months (10 years) to prevent infinite loops
      while (!isAfter(current, end) && safetyCounter < 120) {
        months.push(format(current, 'MMM yy'));
        current = addMonths(current, 1);
        safetyCounter++;
      }
      
      return months.length > 0 ? months : [format(start, 'MMM yy')];
    } catch (e) {
      console.error("Phasing months calculation error:", e);
      return [format(new Date(), 'MMM yy')];
    }
  }, [project.startDate, project.endDate]);

  const currencyFormatter = (params: ValueFormatterParams) => {
    if (params.value == null) return '';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(params.value);
  };

  const columnDefs = useMemo<ColDef[]>(() => {
    const categories = project.categories?.length ? project.categories : enterprise.categories || [];
    const controlAccounts = project.controlAccounts?.length ? project.controlAccounts : enterprise.controlAccounts || [];
    const orderNumbers = project.orderNumbers?.length ? project.orderNumbers : enterprise.orderNumbers || [];

    const baseCols: ColDef[] = [
      { 
        headerName: 'Item', 
        field: 'costCode', 
        editable: true, 
        pinned: 'left',
        width: 120 
      },
      { 
        headerName: 'Description', 
        field: 'description', 
        editable: true, 
        pinned: 'left',
        width: 250 
      },
      { 
        headerName: 'Qty', 
        field: 'qty', 
        editable: sheetType === 'commitment',
        type: 'numericColumn',
        width: 100,
        valueGetter: (params: ValueGetterParams) => {
          if (!params.data) return 0;
          if (sheetType === 'time-based') {
            const cutoffStr = project.cutoffDate;
            const cutoff = (cutoffStr && cutoffStr !== 'NOT SET') ? parseISO(cutoffStr) : new Date(1970, 0, 1);
            let sum = 0;
            const monthMap: Record<string, string> = {
              'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06',
              'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
            };
            phasingMonths.forEach(m => {
              const [monthName, yearShort] = m.split(' ');
              if (!monthName || !yearShort || !monthMap[monthName]) return;
              
              const monthDate = parseISO(`20${yearShort}-${monthMap[monthName]}-01`);
              if (isNaN(monthDate.getTime())) return;
              
              if (isAfter(monthDate, cutoff)) {
                sum += Number(params.data.timePhasing?.[m]) || 0;
              }
            });
            return sum;
          }
          return params.data.qty;
        }
      },
      { 
        headerName: 'Unit', 
        field: 'unit', 
        editable: true, 
        width: 80 
      },
      { 
        headerName: 'Rate', 
        field: 'rate', 
        editable: true, 
        type: 'numericColumn',
        width: 100,
        valueFormatter: currencyFormatter
      },
      { 
        headerName: 'Total', 
        field: 'total', 
        width: 120,
        type: 'numericColumn',
        valueGetter: (params: ValueGetterParams) => {
          if (!params.data) return 0;
          const qty = params.getValue('qty') || 0;
          const rate = params.data.rate || 0;
          return qty * rate;
        },
        valueFormatter: currencyFormatter,
        cellStyle: { fontWeight: 'bold', backgroundColor: theme === 'dark' ? '#1a1a1a' : '#f9fafb' }
      },
      { 
        headerName: 'Category', 
        field: 'category', 
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: categories },
        width: 150
      },
      { 
        headerName: 'Control Account', 
        field: 'controlAccount', 
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: controlAccounts },
        width: 180
      },
      { 
        headerName: 'Order Number', 
        field: 'orderNumber', 
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: orderNumbers },
        width: 150
      }
    ];

    const phasingCols: ColDef[] = phasingMonths.map(month => ({
      headerName: month,
      field: `timePhasing.${month.replace(' ', '_')}`,
      editable: true,
      type: 'numericColumn',
      width: 100,
      valueGetter: (params: ValueGetterParams) => {
        if (!params.data) return 0;
        return params.data.timePhasing?.[month] || 0;
      },
      valueSetter: (params) => {
        if (!params.data.timePhasing) params.data.timePhasing = {};
        params.data.timePhasing[month] = Number(params.newValue);
        return true;
      },
      valueFormatter: currencyFormatter
    }));

    return [...baseCols, ...phasingCols];
  }, [sheetType, project, enterprise, phasingMonths, theme]);

  const onCellValueChanged = useCallback((event: CellValueChangedEvent) => {
    const updatedRows = [...data];
    const index = updatedRows.findIndex(r => r.id === event.data.id);
    if (index !== -1) {
      updatedRows[index] = { ...event.data };
      onDataChange(updatedRows);
    }
  }, [data, onDataChange]);

  const onGridReady = (params: GridReadyEvent) => {
    params.api.sizeColumnsToFit();
  };

  const defaultColDef = useMemo(() => ({
    sortable: true,
    filter: true,
    resizable: true,
  }), []);

  return (
    <div className={`w-full h-full ${theme === 'dark' ? 'ag-theme-quartz-dark' : 'ag-theme-quartz'}`}>
      <AgGridReact
        key={sheetId}
        ref={gridRef}
        rowData={data}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        onCellValueChanged={onCellValueChanged}
        onGridReady={onGridReady}
        animateRows={true}
        headerHeight={48}
        rowHeight={40}
        undoRedoCellEditing={true}
        undoRedoCellEditingLimit={20}
      />
      <style>{`
        .ag-theme-quartz, .ag-theme-quartz-dark {
          --ag-font-family: 'Inter', sans-serif;
          --ag-font-size: 13px;
        }
        .ag-theme-quartz-dark {
          --ag-background-color: #141414;
          --ag-header-background-color: #1a1a1a;
          --ag-odd-row-background-color: #181818;
          --ag-border-color: rgba(255,255,255,0.1);
        }
      `}</style>
    </div>
  );
}
