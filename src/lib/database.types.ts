export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      subscription_plans: {
        Row: {
          id: string
          name: string
          description: string
          price: number
          features: Json
          max_instances: number
          max_messages_per_day: number
          is_active: boolean
          display_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string
          price?: number
          features?: Json
          max_instances?: number
          max_messages_per_day?: number
          is_active?: boolean
          display_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string
          price?: number
          features?: Json
          max_instances?: number
          max_messages_per_day?: number
          is_active?: boolean
          display_order?: number
          created_at?: string
          updated_at?: string
        }
      }
      system_settings: {
        Row: {
          id: string
          key: string
          value: string | null
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          key: string
          value?: string | null
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          key?: string
          value?: string | null
          description?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          email: string
          role: 'admin' | 'client'
          max_instances: number | null
          chat_url: string | null
          chat_api_key: string | null
          chat_account_id: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          role?: 'admin' | 'client'
          max_instances?: number | null
          chat_url?: string | null
          chat_api_key?: string | null
          chat_account_id?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          role?: 'admin' | 'client'
          max_instances?: number | null
          chat_url?: string | null
          chat_api_key?: string | null
          chat_account_id?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      whatsapp_instances: {
        Row: {
          id: string
          user_id: string
          name: string
          instance_token: string | null
          system_name: string
          status: 'disconnected' | 'connecting' | 'connected'
          phone_number: string | null
          qr_code: string | null
          pairing_code: string | null
          profile_data: Json | null
          last_disconnect_reason: string | null
          last_disconnect_at: string | null
          admin_field_01: string | null
          admin_field_02: string | null
          chat_enabled: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          instance_token?: string | null
          system_name?: string
          status?: 'disconnected' | 'connecting' | 'connected'
          phone_number?: string | null
          qr_code?: string | null
          pairing_code?: string | null
          profile_data?: Json | null
          last_disconnect_reason?: string | null
          last_disconnect_at?: string | null
          admin_field_01?: string | null
          admin_field_02?: string | null
          chat_enabled?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          instance_token?: string | null
          system_name?: string
          status?: 'disconnected' | 'connecting' | 'connected'
          phone_number?: string | null
          qr_code?: string | null
          pairing_code?: string | null
          profile_data?: Json | null
          last_disconnect_reason?: string | null
          last_disconnect_at?: string | null
          admin_field_01?: string | null
          admin_field_02?: string | null
          chat_enabled?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      api_request_logs: {
        Row: {
          id: string
          created_at: string
          endpoint: string
          method: string
          status_code: number
          latency_ms: number
          success: boolean
          user_id: string | null
          instance_id: string | null
          error_message: string | null
          request_origin: string | null
          ip_address: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          endpoint: string
          method: string
          status_code: number
          latency_ms: number
          success: boolean
          user_id?: string | null
          instance_id?: string | null
          error_message?: string | null
          request_origin?: string | null
          ip_address?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          endpoint?: string
          method?: string
          status_code?: number
          latency_ms?: number
          success?: boolean
          user_id?: string | null
          instance_id?: string | null
          error_message?: string | null
          request_origin?: string | null
          ip_address?: string | null
        }
      }
    }
    Functions: {
      get_api_monitoring_summary: {
        Args: {
          timeframe: string
        }
        Returns: {
          total_requests: number
          requests_change: number
          success_rate: number
          total_failures: number
          failure_change: number
          average_latency_ms: number
          peak_latency_ms: number
          throughput_per_minute: number
          uptime_percent: number
        }[]
      }
      get_api_monitoring_endpoints: {
        Args: {
          timeframe: string
        }
        Returns: {
          endpoint: string
          method: string
          total_requests: number
          success_rate: number
          average_latency_ms: number
          total_failures: number
          status: string
        }[]
      }
      get_api_monitoring_failures: {
        Args: {
          timeframe: string
          target_limit?: number
        }
        Returns: {
          id: string
          endpoint: string
          method: string
          status_code: number
          message: string
          timestamp: string
        }[]
      }
    }
  }
}
