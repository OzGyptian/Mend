import React from 'react';
import { AgGridReact, type AgGridReactProps } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';

export type DataGridProps = AgGridReactProps;

/**
 * Thin wrapper over AgGridReact that enforces consistent defaults across the app.
 * New components should import DataGrid here rather than AgGridReact directly.
 * Existing components migrate opportunistically.
 */
export const DataGrid = React.forwardRef<AgGridReact, DataGridProps>(
  (props, ref) => (
    <div className="ag-theme-quartz" style={{ width: '100%', height: '100%' }}>
      <AgGridReact
        ref={ref}
        rowHeight={36}
        headerHeight={38}
        defaultColDef={{
          resizable: true,
          sortable: true,
          filter: true,
          ...props.defaultColDef,
        }}
        {...props}
        theme="legacy"
      />
    </div>
  )
);

DataGrid.displayName = 'DataGrid';
