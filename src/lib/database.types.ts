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
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          role?: 'admin' | 'client'
          max_instances?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          role?: 'admin' | 'client'
          max_instances?: number | null
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
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}
