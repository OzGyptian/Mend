export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      actual_costs: {
        Row: {
          amount: number
          cost_code_id: string
          created_at: string
          description: string | null
          id: string
          period: string
          project_id: string
        }
        Insert: {
          amount: number
          cost_code_id: string
          created_at?: string
          description?: string | null
          id?: string
          period: string
          project_id: string
        }
        Update: {
          amount?: number
          cost_code_id?: string
          created_at?: string
          description?: string | null
          id?: string
          period?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "actual_costs_cost_code_id_fkey"
            columns: ["cost_code_id"]
            isOneToOne: false
            referencedRelation: "cost_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actual_costs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_user_id: string | null
          created_at: string
          details: Json
          enterprise_id: string
          id: string
          project_id: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_user_id?: string | null
          created_at?: string
          details?: Json
          enterprise_id: string
          id?: string
          project_id?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_user_id?: string | null
          created_at?: string
          details?: Json
          enterprise_id?: string
          id?: string
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      baseline_budgets: {
        Row: {
          amount: number
          cost_code_id: string
          created_at: string
          effective_date: string | null
          id: string
          project_id: string
        }
        Insert: {
          amount: number
          cost_code_id: string
          created_at?: string
          effective_date?: string | null
          id?: string
          project_id: string
        }
        Update: {
          amount?: number
          cost_code_id?: string
          created_at?: string
          effective_date?: string | null
          id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "baseline_budgets_cost_code_id_fkey"
            columns: ["cost_code_id"]
            isOneToOne: false
            referencedRelation: "cost_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "baseline_budgets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      calendars: {
        Row: {
          created_at: string
          enterprise_id: string | null
          holidays: string[]
          id: string
          name: string
          project_id: string | null
          weekends: number[]
        }
        Insert: {
          created_at?: string
          enterprise_id?: string | null
          holidays?: string[]
          id?: string
          name: string
          project_id?: string | null
          weekends?: number[]
        }
        Update: {
          created_at?: string
          enterprise_id?: string | null
          holidays?: string[]
          id?: string
          name?: string
          project_id?: string | null
          weekends?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "calendars_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendars_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      change_records: {
        Row: {
          budget_amount: number
          change_id: string
          cost_code_id: string | null
          created_at: string
          eac_amount: number
          enterprise_attributes: Json
          id: string
          project_attributes: Json
          project_id: string
          updated_at: string
        }
        Insert: {
          budget_amount?: number
          change_id: string
          cost_code_id?: string | null
          created_at?: string
          eac_amount?: number
          enterprise_attributes?: Json
          id?: string
          project_attributes?: Json
          project_id: string
          updated_at?: string
        }
        Update: {
          budget_amount?: number
          change_id?: string
          cost_code_id?: string | null
          created_at?: string
          eac_amount?: number
          enterprise_attributes?: Json
          id?: string
          project_attributes?: Json
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "change_records_change_id_fkey"
            columns: ["change_id"]
            isOneToOne: false
            referencedRelation: "changes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_records_cost_code_id_fkey"
            columns: ["cost_code_id"]
            isOneToOne: false
            referencedRelation: "cost_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_records_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      changes: {
        Row: {
          change_code: string | null
          created_at: string
          description: string | null
          enterprise_attributes: Json
          id: string
          project_attributes: Json
          project_id: string
          status: string | null
          updated_at: string
        }
        Insert: {
          change_code?: string | null
          created_at?: string
          description?: string | null
          enterprise_attributes?: Json
          id?: string
          project_attributes?: Json
          project_id: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          change_code?: string | null
          created_at?: string
          description?: string | null
          enterprise_attributes?: Json
          id?: string
          project_attributes?: Json
          project_id?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "changes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_code_assigned_users: {
        Row: {
          cost_code_id: string
          user_id: string
        }
        Insert: {
          cost_code_id: string
          user_id: string
        }
        Update: {
          cost_code_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_code_assigned_users_cost_code_id_fkey"
            columns: ["cost_code_id"]
            isOneToOne: false
            referencedRelation: "cost_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_codes: {
        Row: {
          activity_id: string | null
          approved_budget_movement: number | null
          approved_budget_previous: number | null
          baseline_budget: number
          code: string
          cost_variance_movement: number | null
          cost_variance_previous: number | null
          created_at: string
          eac_method: string
          enterprise_attributes: Json
          estimate_at_completion_movement: number | null
          estimate_at_completion_previous: number | null
          id: string
          name: string
          planned_end_date: string | null
          planned_start_date: string | null
          project_attributes: Json
          project_id: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          activity_id?: string | null
          approved_budget_movement?: number | null
          approved_budget_previous?: number | null
          baseline_budget?: number
          code: string
          cost_variance_movement?: number | null
          cost_variance_previous?: number | null
          created_at?: string
          eac_method?: string
          enterprise_attributes?: Json
          estimate_at_completion_movement?: number | null
          estimate_at_completion_previous?: number | null
          id?: string
          name: string
          planned_end_date?: string | null
          planned_start_date?: string | null
          project_attributes?: Json
          project_id: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          activity_id?: string | null
          approved_budget_movement?: number | null
          approved_budget_previous?: number | null
          baseline_budget?: number
          code?: string
          cost_variance_movement?: number | null
          cost_variance_previous?: number | null
          created_at?: string
          eac_method?: string
          enterprise_attributes?: Json
          estimate_at_completion_movement?: number | null
          estimate_at_completion_previous?: number | null
          id?: string
          name?: string
          planned_end_date?: string | null
          planned_start_date?: string | null
          project_attributes?: Json
          project_id?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_codes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_phasing: {
        Row: {
          cost_code_id: string
          created_at: string
          distribution_method: string
          id: string
          period_values: Json
          project_id: string | null
          updated_at: string
        }
        Insert: {
          cost_code_id: string
          created_at?: string
          distribution_method?: string
          id?: string
          period_values?: Json
          project_id?: string | null
          updated_at?: string
        }
        Update: {
          cost_code_id?: string
          created_at?: string
          distribution_method?: string
          id?: string
          period_values?: Json
          project_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_phasing_cost_code_id_fkey"
            columns: ["cost_code_id"]
            isOneToOne: false
            referencedRelation: "cost_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_phasing_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_members: {
        Row: {
          created_at: string
          enterprise_id: string
          role: Database["public"]["Enums"]["enterprise_member_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          enterprise_id: string
          role?: Database["public"]["Enums"]["enterprise_member_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          enterprise_id?: string
          role?: Database["public"]["Enums"]["enterprise_member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_members_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprises: {
        Row: {
          categories: string[]
          change_attributes: Json
          change_types: string[]
          control_accounts: string[]
          cost_code_attributes: Json
          cost_elements: Json
          created_at: string
          enterprise_code: string | null
          id: string
          line_item_attributes: Json
          logo_url: string | null
          name: string
          order_numbers: string[]
          procurement_attributes: Json
          progress_attributes: Json
          project_attributes: Json
          resource_rates: Json
          risk_attributes: Json
          risk_types: string[]
          subcontract_attributes: Json
          theme: string | null
          updated_at: string
        }
        Insert: {
          categories?: string[]
          change_attributes?: Json
          change_types?: string[]
          control_accounts?: string[]
          cost_code_attributes?: Json
          cost_elements?: Json
          created_at?: string
          enterprise_code?: string | null
          id?: string
          line_item_attributes?: Json
          logo_url?: string | null
          name: string
          order_numbers?: string[]
          procurement_attributes?: Json
          progress_attributes?: Json
          project_attributes?: Json
          resource_rates?: Json
          risk_attributes?: Json
          risk_types?: string[]
          subcontract_attributes?: Json
          theme?: string | null
          updated_at?: string
        }
        Update: {
          categories?: string[]
          change_attributes?: Json
          change_types?: string[]
          control_accounts?: string[]
          cost_code_attributes?: Json
          cost_elements?: Json
          created_at?: string
          enterprise_code?: string | null
          id?: string
          line_item_attributes?: Json
          logo_url?: string | null
          name?: string
          order_numbers?: string[]
          procurement_attributes?: Json
          progress_attributes?: Json
          project_attributes?: Json
          resource_rates?: Json
          risk_attributes?: Json
          risk_types?: string[]
          subcontract_attributes?: Json
          theme?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      etc_details: {
        Row: {
          activity_id: string | null
          calendar_id: string | null
          category: string | null
          cost_code: string | null
          cost_code_id: string
          created_at: string
          description: string | null
          enterprise_attributes: Json
          id: string
          is_enterprise_resource: boolean | null
          item: string | null
          order_number: string | null
          period_values: Json
          phasing_end_date: string | null
          phasing_method: string | null
          phasing_qty: number | null
          phasing_start_date: string | null
          phasing_unit: string | null
          project_attributes: Json
          project_id: string | null
          qty: number | null
          rate: number | null
          resource_id: string | null
          sort_order: number | null
          total_etc_previous: number | null
          udf1: string | null
          udf2: string | null
          udf3: string | null
          udf4: string | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          activity_id?: string | null
          calendar_id?: string | null
          category?: string | null
          cost_code?: string | null
          cost_code_id: string
          created_at?: string
          description?: string | null
          enterprise_attributes?: Json
          id?: string
          is_enterprise_resource?: boolean | null
          item?: string | null
          order_number?: string | null
          period_values?: Json
          phasing_end_date?: string | null
          phasing_method?: string | null
          phasing_qty?: number | null
          phasing_start_date?: string | null
          phasing_unit?: string | null
          project_attributes?: Json
          project_id?: string | null
          qty?: number | null
          rate?: number | null
          resource_id?: string | null
          sort_order?: number | null
          total_etc_previous?: number | null
          udf1?: string | null
          udf2?: string | null
          udf3?: string | null
          udf4?: string | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          activity_id?: string | null
          calendar_id?: string | null
          category?: string | null
          cost_code?: string | null
          cost_code_id?: string
          created_at?: string
          description?: string | null
          enterprise_attributes?: Json
          id?: string
          is_enterprise_resource?: boolean | null
          item?: string | null
          order_number?: string | null
          period_values?: Json
          phasing_end_date?: string | null
          phasing_method?: string | null
          phasing_qty?: number | null
          phasing_start_date?: string | null
          phasing_unit?: string | null
          project_attributes?: Json
          project_id?: string | null
          qty?: number | null
          rate?: number | null
          resource_id?: string | null
          sort_order?: number | null
          total_etc_previous?: number | null
          udf1?: string | null
          udf2?: string | null
          udf3?: string | null
          udf4?: string | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "etc_details_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "calendars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "etc_details_cost_code_id_fkey"
            columns: ["cost_code_id"]
            isOneToOne: false
            referencedRelation: "cost_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "etc_details_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      forecast_rows: {
        Row: {
          actual_cost_to_date: number
          budget: number
          committed_cost: number
          cost_code: string | null
          cost_to_go: number
          description: string | null
          distribution_method: string
          eac: number
          end_date: string | null
          enterprise_change_attributes: Json
          enterprise_cost_code_attributes: Json
          enterprise_line_item_attributes: Json
          enterprise_subcontract_attributes: Json
          id: string
          project_attributes: Json
          qty: number | null
          rate: number | null
          sheet_id: string
          start_date: string | null
          time_phasing: Json
          vendor: string | null
        }
        Insert: {
          actual_cost_to_date?: number
          budget?: number
          committed_cost?: number
          cost_code?: string | null
          cost_to_go?: number
          description?: string | null
          distribution_method?: string
          eac?: number
          end_date?: string | null
          enterprise_change_attributes?: Json
          enterprise_cost_code_attributes?: Json
          enterprise_line_item_attributes?: Json
          enterprise_subcontract_attributes?: Json
          id?: string
          project_attributes?: Json
          qty?: number | null
          rate?: number | null
          sheet_id: string
          start_date?: string | null
          time_phasing?: Json
          vendor?: string | null
        }
        Update: {
          actual_cost_to_date?: number
          budget?: number
          committed_cost?: number
          cost_code?: string | null
          cost_to_go?: number
          description?: string | null
          distribution_method?: string
          eac?: number
          end_date?: string | null
          enterprise_change_attributes?: Json
          enterprise_cost_code_attributes?: Json
          enterprise_line_item_attributes?: Json
          enterprise_subcontract_attributes?: Json
          id?: string
          project_attributes?: Json
          qty?: number | null
          rate?: number | null
          sheet_id?: string
          start_date?: string | null
          time_phasing?: Json
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "forecast_rows_sheet_id_fkey"
            columns: ["sheet_id"]
            isOneToOne: false
            referencedRelation: "sheets"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          enterprise_id: string
          enterprise_name: string
          id: string
          invited_by: string | null
          invited_email: string
          role: Database["public"]["Enums"]["enterprise_member_role"]
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          enterprise_id: string
          enterprise_name: string
          id?: string
          invited_by?: string | null
          invited_email: string
          role?: Database["public"]["Enums"]["enterprise_member_role"]
          status?: string
          token: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          enterprise_id?: string
          enterprise_name?: string
          id?: string
          invited_by?: string | null
          invited_email?: string
          role?: Database["public"]["Enums"]["enterprise_member_role"]
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          certified_percent: number
          certified_qty: number
          certified_value: number
          claim_percent: number
          claim_qty: number
          claim_value: number
          commentary: string | null
          description: string | null
          id: string
          invoice_id: string
          item_no: string
          periodic_certified_percent: number | null
          periodic_certified_qty: number | null
          periodic_certified_value: number | null
          periodic_claim_percent: number | null
          periodic_claim_qty: number | null
          periodic_claim_value: number | null
          qty: number
          rate: number
          subcontract_line_item_id: string
          total: number
          type: string | null
          unit: string | null
        }
        Insert: {
          certified_percent?: number
          certified_qty?: number
          certified_value?: number
          claim_percent?: number
          claim_qty?: number
          claim_value?: number
          commentary?: string | null
          description?: string | null
          id?: string
          invoice_id: string
          item_no: string
          periodic_certified_percent?: number | null
          periodic_certified_qty?: number | null
          periodic_certified_value?: number | null
          periodic_claim_percent?: number | null
          periodic_claim_qty?: number | null
          periodic_claim_value?: number | null
          qty?: number
          rate?: number
          subcontract_line_item_id: string
          total?: number
          type?: string | null
          unit?: string | null
        }
        Update: {
          certified_percent?: number
          certified_qty?: number
          certified_value?: number
          claim_percent?: number
          claim_qty?: number
          claim_value?: number
          commentary?: string | null
          description?: string | null
          id?: string
          invoice_id?: string
          item_no?: string
          periodic_certified_percent?: number | null
          periodic_certified_qty?: number | null
          periodic_certified_value?: number | null
          periodic_claim_percent?: number | null
          periodic_claim_qty?: number | null
          periodic_claim_value?: number | null
          qty?: number
          rate?: number
          subcontract_line_item_id?: string
          total?: number
          type?: string | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_subcontract_line_item_id_fkey"
            columns: ["subcontract_line_item_id"]
            isOneToOne: false
            referencedRelation: "subcontract_line_items"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          certified_amount: number
          certified_date: string | null
          created_at: string
          created_by: string | null
          description: string | null
          enterprise_id: string
          id: string
          initiator: string | null
          invoice_code: string
          payment_date: string | null
          project_id: string
          status: string
          subcontract_id: string
          submitted_date: string | null
          total_amount: number
          updated_at: string
          vendor_id: string
        }
        Insert: {
          certified_amount?: number
          certified_date?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          enterprise_id: string
          id?: string
          initiator?: string | null
          invoice_code: string
          payment_date?: string | null
          project_id: string
          status?: string
          subcontract_id: string
          submitted_date?: string | null
          total_amount?: number
          updated_at?: string
          vendor_id: string
        }
        Update: {
          certified_amount?: number
          certified_date?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          enterprise_id?: string
          id?: string
          initiator?: string | null
          invoice_code?: string
          payment_date?: string | null
          project_id?: string
          status?: string
          subcontract_id?: string
          submitted_date?: string | null
          total_amount?: number
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_subcontract_id_fkey"
            columns: ["subcontract_id"]
            isOneToOne: false
            referencedRelation: "subcontracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      period_snapshots: {
        Row: {
          cost_codes: Json
          created_at: string
          id: string
          period_id: string
          period_name: string
          project_id: string
        }
        Insert: {
          cost_codes: Json
          created_at?: string
          id?: string
          period_id: string
          period_name: string
          project_id: string
        }
        Update: {
          cost_codes?: Json
          created_at?: string
          id?: string
          period_id?: string
          period_name?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "period_snapshots_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      procurement_items: {
        Row: {
          calendar_id: string | null
          category: string | null
          created_at: string
          description: string
          enterprise_attributes: Json
          id: string
          package_id: string | null
          project_attributes: Json
          project_id: string
          step_data: Json
          updated_at: string
        }
        Insert: {
          calendar_id?: string | null
          category?: string | null
          created_at?: string
          description: string
          enterprise_attributes?: Json
          id?: string
          package_id?: string | null
          project_attributes?: Json
          project_id: string
          step_data?: Json
          updated_at?: string
        }
        Update: {
          calendar_id?: string | null
          category?: string | null
          created_at?: string
          description?: string
          enterprise_attributes?: Json
          id?: string
          package_id?: string | null
          project_attributes?: Json
          project_id?: string
          step_data?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "procurement_items_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "calendars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      procurement_step_definitions: {
        Row: {
          default_duration_days: number | null
          enterprise_id: string | null
          enterprise_step_id: string | null
          id: string
          is_enterprise_standard: boolean
          name: string
          order: number
          project_id: string | null
        }
        Insert: {
          default_duration_days?: number | null
          enterprise_id?: string | null
          enterprise_step_id?: string | null
          id?: string
          is_enterprise_standard?: boolean
          name: string
          order: number
          project_id?: string | null
        }
        Update: {
          default_duration_days?: number | null
          enterprise_id?: string | null
          enterprise_step_id?: string | null
          id?: string
          is_enterprise_standard?: boolean
          name?: string
          order?: number
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "procurement_step_definitions_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_step_definitions_enterprise_step_id_fkey"
            columns: ["enterprise_step_id"]
            isOneToOne: false
            referencedRelation: "procurement_step_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_step_definitions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      progress_attributes: {
        Row: {
          id: string
          project_id: string
          title: string
          type: string
          values: Json
        }
        Insert: {
          id?: string
          project_id: string
          title: string
          type: string
          values?: Json
        }
        Update: {
          id?: string
          project_id?: string
          title?: string
          type?: string
          values?: Json
        }
        Relationships: [
          {
            foreignKeyName: "progress_attributes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      progress_items: {
        Row: {
          activity_id: string | null
          actual_period_values: Json
          cost_code_id: string
          created_at: string
          current_end_date: string | null
          current_period_values: Json
          current_phasing_curve: string | null
          current_phasing_method: string | null
          current_start_date: string | null
          description: string
          earned_qty_previous: number | null
          enterprise_attributes: Json
          id: string
          item_code: string
          package_id: string
          period_values: Json
          phasing_curve: string
          phasing_method: string
          planned_end_date: string | null
          planned_start_date: string | null
          project_attributes: Json
          project_id: string
          rule_of_credit_id: string | null
          rule_of_credit_progress: Json
          sort_order: number | null
          total_qty: number
          total_qty_previous: number | null
          updated_at: string
        }
        Insert: {
          activity_id?: string | null
          actual_period_values?: Json
          cost_code_id: string
          created_at?: string
          current_end_date?: string | null
          current_period_values?: Json
          current_phasing_curve?: string | null
          current_phasing_method?: string | null
          current_start_date?: string | null
          description: string
          earned_qty_previous?: number | null
          enterprise_attributes?: Json
          id?: string
          item_code: string
          package_id: string
          period_values?: Json
          phasing_curve?: string
          phasing_method?: string
          planned_end_date?: string | null
          planned_start_date?: string | null
          project_attributes?: Json
          project_id: string
          rule_of_credit_id?: string | null
          rule_of_credit_progress?: Json
          sort_order?: number | null
          total_qty?: number
          total_qty_previous?: number | null
          updated_at?: string
        }
        Update: {
          activity_id?: string | null
          actual_period_values?: Json
          cost_code_id?: string
          created_at?: string
          current_end_date?: string | null
          current_period_values?: Json
          current_phasing_curve?: string | null
          current_phasing_method?: string | null
          current_start_date?: string | null
          description?: string
          earned_qty_previous?: number | null
          enterprise_attributes?: Json
          id?: string
          item_code?: string
          package_id?: string
          period_values?: Json
          phasing_curve?: string
          phasing_method?: string
          planned_end_date?: string | null
          planned_start_date?: string | null
          project_attributes?: Json
          project_id?: string
          rule_of_credit_id?: string | null
          rule_of_credit_progress?: Json
          sort_order?: number | null
          total_qty?: number
          total_qty_previous?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "progress_items_cost_code_id_fkey"
            columns: ["cost_code_id"]
            isOneToOne: false
            referencedRelation: "cost_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progress_items_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "progress_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progress_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progress_items_rule_of_credit_id_fkey"
            columns: ["rule_of_credit_id"]
            isOneToOne: false
            referencedRelation: "rules_of_credit"
            referencedColumns: ["id"]
          },
        ]
      }
      progress_packages: {
        Row: {
          attributes: Json
          created_at: string
          default_end_date: string | null
          default_phasing_curve: string | null
          default_phasing_method: string | null
          default_start_date: string | null
          description: string
          id: string
          package_code: string
          project_id: string
          rule_of_credit_id: string | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          attributes?: Json
          created_at?: string
          default_end_date?: string | null
          default_phasing_curve?: string | null
          default_phasing_method?: string | null
          default_start_date?: string | null
          description: string
          id?: string
          package_code: string
          project_id: string
          rule_of_credit_id?: string | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          attributes?: Json
          created_at?: string
          default_end_date?: string | null
          default_phasing_curve?: string | null
          default_phasing_method?: string | null
          default_start_date?: string | null
          description?: string
          id?: string
          package_code?: string
          project_id?: string
          rule_of_credit_id?: string | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "progress_packages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progress_packages_rule_of_credit_id_fkey"
            columns: ["rule_of_credit_id"]
            isOneToOne: false
            referencedRelation: "rules_of_credit"
            referencedColumns: ["id"]
          },
        ]
      }
      progress_reporting_periods: {
        Row: {
          created_at: string
          end_date: string
          id: string
          period_name: string
          project_id: string
          start_date: string
          status: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          period_name: string
          project_id: string
          start_date: string
          status?: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          period_name?: string
          project_id?: string
          start_date?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "progress_reporting_periods_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          created_at: string
          project_id: string
          role: Database["public"]["Enums"]["project_member_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          project_id: string
          role?: Database["public"]["Enums"]["project_member_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          project_id?: string
          role?: Database["public"]["Enums"]["project_member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          attributes: Json
          categories: string[]
          change_attributes: Json
          change_types: string[]
          client_name: string | null
          control_accounts: string[]
          cost_code_attributes: Json
          cost_elements: Json
          created_at: string
          created_by: string | null
          created_by_email: string | null
          current_reporting_month: string | null
          cutoff_date: string | null
          end_date: string | null
          enterprise_id: string
          first_cost_reporting_month: string | null
          id: string
          last_reporting_month: string | null
          line_item_attributes: Json
          modified_by: string | null
          modified_by_email: string | null
          order_numbers: string[]
          photo_url: string | null
          procurement_attributes: Json
          procurement_defaults: Json
          progress_attributes: Json
          progress_periods: Json
          project_budget: number
          project_code: string
          project_manager_name: string | null
          project_name: string
          reporting_periods: Json
          resource_rates: Json
          risk_attributes: Json
          risk_types: string[]
          scope_description: string | null
          start_date: string | null
          status: string | null
          subcontract_attributes: Json
          updated_at: string
        }
        Insert: {
          attributes?: Json
          categories?: string[]
          change_attributes?: Json
          change_types?: string[]
          client_name?: string | null
          control_accounts?: string[]
          cost_code_attributes?: Json
          cost_elements?: Json
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          current_reporting_month?: string | null
          cutoff_date?: string | null
          end_date?: string | null
          enterprise_id: string
          first_cost_reporting_month?: string | null
          id?: string
          last_reporting_month?: string | null
          line_item_attributes?: Json
          modified_by?: string | null
          modified_by_email?: string | null
          order_numbers?: string[]
          photo_url?: string | null
          procurement_attributes?: Json
          procurement_defaults?: Json
          progress_attributes?: Json
          progress_periods?: Json
          project_budget?: number
          project_code: string
          project_manager_name?: string | null
          project_name: string
          reporting_periods?: Json
          resource_rates?: Json
          risk_attributes?: Json
          risk_types?: string[]
          scope_description?: string | null
          start_date?: string | null
          status?: string | null
          subcontract_attributes?: Json
          updated_at?: string
        }
        Update: {
          attributes?: Json
          categories?: string[]
          change_attributes?: Json
          change_types?: string[]
          client_name?: string | null
          control_accounts?: string[]
          cost_code_attributes?: Json
          cost_elements?: Json
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          current_reporting_month?: string | null
          cutoff_date?: string | null
          end_date?: string | null
          enterprise_id?: string
          first_cost_reporting_month?: string | null
          id?: string
          last_reporting_month?: string | null
          line_item_attributes?: Json
          modified_by?: string | null
          modified_by_email?: string | null
          order_numbers?: string[]
          photo_url?: string | null
          procurement_attributes?: Json
          procurement_defaults?: Json
          progress_attributes?: Json
          progress_periods?: Json
          project_budget?: number
          project_code?: string
          project_manager_name?: string | null
          project_name?: string
          reporting_periods?: Json
          resource_rates?: Json
          risk_attributes?: Json
          risk_types?: string[]
          scope_description?: string | null
          start_date?: string | null
          status?: string | null
          subcontract_attributes?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_records: {
        Row: {
          beta_pert_impact_amount: number | null
          cost_code_id: string | null
          created_at: string
          enterprise_attributes: Json
          id: string
          max_impact_amount: number
          min_impact_amount: number
          most_likely_impact_amount: number
          probability: number
          project_attributes: Json
          project_id: string
          risk_id: string
          scope: string | null
          updated_at: string
        }
        Insert: {
          beta_pert_impact_amount?: number | null
          cost_code_id?: string | null
          created_at?: string
          enterprise_attributes?: Json
          id?: string
          max_impact_amount: number
          min_impact_amount: number
          most_likely_impact_amount: number
          probability: number
          project_attributes?: Json
          project_id: string
          risk_id: string
          scope?: string | null
          updated_at?: string
        }
        Update: {
          beta_pert_impact_amount?: number | null
          cost_code_id?: string | null
          created_at?: string
          enterprise_attributes?: Json
          id?: string
          max_impact_amount?: number
          min_impact_amount?: number
          most_likely_impact_amount?: number
          probability?: number
          project_attributes?: Json
          project_id?: string
          risk_id?: string
          scope?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_records_cost_code_id_fkey"
            columns: ["cost_code_id"]
            isOneToOne: false
            referencedRelation: "cost_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_records_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_records_risk_id_fkey"
            columns: ["risk_id"]
            isOneToOne: false
            referencedRelation: "risks"
            referencedColumns: ["id"]
          },
        ]
      }
      risks: {
        Row: {
          created_at: string
          description: string
          enterprise_attributes: Json
          id: string
          initiator: string | null
          mitigation: string | null
          period_id: string | null
          project_attributes: Json
          project_id: string
          reference: string | null
          residual_exposure: string | null
          risk_code: string
          status: string
          strategy: string | null
          type: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          enterprise_attributes?: Json
          id?: string
          initiator?: string | null
          mitigation?: string | null
          period_id?: string | null
          project_attributes?: Json
          project_id: string
          reference?: string | null
          residual_exposure?: string | null
          risk_code: string
          status?: string
          strategy?: string | null
          type?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          enterprise_attributes?: Json
          id?: string
          initiator?: string | null
          mitigation?: string | null
          period_id?: string | null
          project_attributes?: Json
          project_id?: string
          reference?: string | null
          residual_exposure?: string | null
          risk_code?: string
          status?: string
          strategy?: string | null
          type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "risks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      rule_of_credit_steps: {
        Row: {
          description: string
          id: string
          order_no: number
          rule_of_credit_id: string
          weight: number
        }
        Insert: {
          description: string
          id?: string
          order_no: number
          rule_of_credit_id: string
          weight: number
        }
        Update: {
          description?: string
          id?: string
          order_no?: number
          rule_of_credit_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "rule_of_credit_steps_rule_of_credit_id_fkey"
            columns: ["rule_of_credit_id"]
            isOneToOne: false
            referencedRelation: "rules_of_credit"
            referencedColumns: ["id"]
          },
        ]
      }
      rules_of_credit: {
        Row: {
          created_at: string
          description: string
          id: string
          package_id: string | null
          project_id: string
          rule_code: string
          user_field1: string | null
          user_field2: string | null
          user_field3: string | null
          user_field4: string | null
          user_field5: string | null
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          package_id?: string | null
          project_id: string
          rule_code: string
          user_field1?: string | null
          user_field2?: string | null
          user_field3?: string | null
          user_field4?: string | null
          user_field5?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          package_id?: string | null
          project_id?: string
          rule_code?: string
          user_field1?: string | null
          user_field2?: string | null
          user_field3?: string | null
          user_field4?: string | null
          user_field5?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rules_of_credit_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "progress_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rules_of_credit_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_views: {
        Row: {
          columns: string[]
          created_at: string
          grid_state: Json | null
          id: string
          name: string
          table_id: string
          user_id: string
        }
        Insert: {
          columns?: string[]
          created_at?: string
          grid_state?: Json | null
          id?: string
          name: string
          table_id: string
          user_id: string
        }
        Update: {
          columns?: string[]
          created_at?: string
          grid_state?: Json | null
          id?: string
          name?: string
          table_id?: string
          user_id?: string
        }
        Relationships: []
      }
      schedule_items: {
        Row: {
          activity_id: string
          activity_percent_complete: number
          baseline_end_date: string | null
          baseline_start_date: string | null
          current_end_date: string | null
          current_start_date: string | null
          description: string
          id: string
          planned_end_date: string | null
          planned_start_date: string | null
          project_id: string
          updated_at: string
        }
        Insert: {
          activity_id: string
          activity_percent_complete?: number
          baseline_end_date?: string | null
          baseline_start_date?: string | null
          current_end_date?: string | null
          current_start_date?: string | null
          description: string
          id?: string
          planned_end_date?: string | null
          planned_start_date?: string | null
          project_id: string
          updated_at?: string
        }
        Update: {
          activity_id?: string
          activity_percent_complete?: number
          baseline_end_date?: string | null
          baseline_start_date?: string | null
          current_end_date?: string | null
          current_start_date?: string | null
          description?: string
          id?: string
          planned_end_date?: string | null
          planned_start_date?: string | null
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      sheets: {
        Row: {
          created_at: string
          created_by: string | null
          forecast_method: string
          id: string
          locked_status: boolean
          project_id: string
          sheet_name: string
          updated_at: string
          users: string[]
          version: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          forecast_method?: string
          id?: string
          locked_status?: boolean
          project_id: string
          sheet_name: string
          updated_at?: string
          users?: string[]
          version?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          forecast_method?: string
          id?: string
          locked_status?: boolean
          project_id?: string
          sheet_name?: string
          updated_at?: string
          users?: string[]
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "sheets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      subcontract_line_items: {
        Row: {
          activity_id: string | null
          cost_code_id: string | null
          created_at: string
          date: string | null
          description: string
          distribution: string | null
          end_date: string | null
          enterprise_attributes: Json
          id: string
          item_no: string
          note: string | null
          period_values: Json
          phasing_source: string | null
          project_attributes: Json
          project_id: string
          qty: number
          rate: number
          start_date: string | null
          status: string
          subcontract_id: string
          total: number
          type: string
          unit: string | null
          updated_at: string
          user_defined: Json
        }
        Insert: {
          activity_id?: string | null
          cost_code_id?: string | null
          created_at?: string
          date?: string | null
          description: string
          distribution?: string | null
          end_date?: string | null
          enterprise_attributes?: Json
          id?: string
          item_no: string
          note?: string | null
          period_values?: Json
          phasing_source?: string | null
          project_attributes?: Json
          project_id: string
          qty?: number
          rate?: number
          start_date?: string | null
          status?: string
          subcontract_id: string
          total?: number
          type?: string
          unit?: string | null
          updated_at?: string
          user_defined?: Json
        }
        Update: {
          activity_id?: string | null
          cost_code_id?: string | null
          created_at?: string
          date?: string | null
          description?: string
          distribution?: string | null
          end_date?: string | null
          enterprise_attributes?: Json
          id?: string
          item_no?: string
          note?: string | null
          period_values?: Json
          phasing_source?: string | null
          project_attributes?: Json
          project_id?: string
          qty?: number
          rate?: number
          start_date?: string | null
          status?: string
          subcontract_id?: string
          total?: number
          type?: string
          unit?: string | null
          updated_at?: string
          user_defined?: Json
        }
        Relationships: [
          {
            foreignKeyName: "subcontract_line_items_cost_code_id_fkey"
            columns: ["cost_code_id"]
            isOneToOne: false
            referencedRelation: "cost_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subcontract_line_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subcontract_line_items_subcontract_id_fkey"
            columns: ["subcontract_id"]
            isOneToOne: false
            referencedRelation: "subcontracts"
            referencedColumns: ["id"]
          },
        ]
      }
      subcontracts: {
        Row: {
          award_date: string | null
          created_at: string
          created_by: string | null
          default_cost_code_id: string | null
          default_distribution: string | null
          default_end_date: string | null
          default_phasing_source: string | null
          default_start_date: string | null
          enterprise_id: string
          enterprise_subcontract_attributes: Json
          forecast_changes: number | null
          id: string
          order_code: string
          order_name: string
          order_scope: string | null
          payment_type: string
          project_attributes: Json
          project_id: string
          status: string
          total_amount: number
          updated_at: string
          vendor_id: string
          vendor_users: string[]
        }
        Insert: {
          award_date?: string | null
          created_at?: string
          created_by?: string | null
          default_cost_code_id?: string | null
          default_distribution?: string | null
          default_end_date?: string | null
          default_phasing_source?: string | null
          default_start_date?: string | null
          enterprise_id: string
          enterprise_subcontract_attributes?: Json
          forecast_changes?: number | null
          id?: string
          order_code: string
          order_name: string
          order_scope?: string | null
          payment_type: string
          project_attributes?: Json
          project_id: string
          status?: string
          total_amount?: number
          updated_at?: string
          vendor_id: string
          vendor_users?: string[]
        }
        Update: {
          award_date?: string | null
          created_at?: string
          created_by?: string | null
          default_cost_code_id?: string | null
          default_distribution?: string | null
          default_end_date?: string | null
          default_phasing_source?: string | null
          default_start_date?: string | null
          enterprise_id?: string
          enterprise_subcontract_attributes?: Json
          forecast_changes?: number | null
          id?: string
          order_code?: string
          order_name?: string
          order_scope?: string | null
          payment_type?: string
          project_attributes?: Json
          project_id?: string
          status?: string
          total_amount?: number
          updated_at?: string
          vendor_id?: string
          vendor_users?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "subcontracts_default_cost_code_id_fkey"
            columns: ["default_cost_code_id"]
            isOneToOne: false
            referencedRelation: "cost_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subcontracts_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subcontracts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subcontracts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string
          platform_role: Database["public"]["Enums"]["platform_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email: string
          platform_role?: Database["public"]["Enums"]["platform_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string
          platform_role?: Database["public"]["Enums"]["platform_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          memberships: Json
          platform_role: string | null
          user_id: string
        }
        Insert: {
          memberships?: Json
          platform_role?: string | null
          user_id: string
        }
        Update: {
          memberships?: Json
          platform_role?: string | null
          user_id?: string
        }
        Relationships: []
      }
      vendors: {
        Row: {
          code: string | null
          contact_email: string | null
          contact_name: string | null
          created_at: string
          enterprise_id: string
          id: string
          name: string
        }
        Insert: {
          code?: string | null
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          enterprise_id: string
          id?: string
          name: string
        }
        Update: {
          code?: string | null
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          enterprise_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendors_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_enterprise: { Args: { ent_id: string }; Returns: boolean }
      can_access_project: { Args: { proj_id: string }; Returns: boolean }
      is_enterprise_admin: { Args: { ent_id: string }; Returns: boolean }
      is_platform_admin: { Args: never; Returns: boolean }
      is_project_admin: { Args: { proj_id: string }; Returns: boolean }
    }
    Enums: {
      enterprise_member_role: "admin" | "member"
      platform_role: "admin" | "user"
      project_member_role: "Project Admin" | "Project User"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      enterprise_member_role: ["admin", "member"],
      platform_role: ["admin", "user"],
      project_member_role: ["Project Admin", "Project User"],
    },
  },
} as const
