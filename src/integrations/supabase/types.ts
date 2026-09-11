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
      admin_logs: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          payload: Json | null
          reason: string | null
          reverted_at: string | null
          reverted_by: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          payload?: Json | null
          reason?: string | null
          reverted_at?: string | null
          reverted_by?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          payload?: Json | null
          reason?: string | null
          reverted_at?: string | null
          reverted_by?: string | null
        }
        Relationships: []
      }
      admin_notifications: {
        Row: {
          admin_id: string
          body: string | null
          created_at: string | null
          id: string
          is_read: boolean | null
          link: string | null
          priority: string | null
          read_at: string | null
          title: string
          type: string | null
        }
        Insert: {
          admin_id: string
          body?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          priority?: string | null
          read_at?: string | null
          title: string
          type?: string | null
        }
        Update: {
          admin_id?: string
          body?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          priority?: string | null
          read_at?: string | null
          title?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_notifications_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_notifications_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_view"
            referencedColumns: ["id"]
          },
        ]
      }
      anuncios: {
        Row: {
          accepts_counteroffer: boolean
          ad_type: string
          category: string
          certificate_type: string
          condition: string
          created_at: string
          description: string | null
          desired_item: string | null
          duplicate_of: string | null
          expires_at: string | null
          flagged_duplicate: boolean
          forum_game_ids: string[]
          game_title: string | null
          id: string
          image_hash: string | null
          plataformas: string[] | null
          platform: string | null
          price: number
          seller_id: string
          status: string
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          accepts_counteroffer?: boolean
          ad_type?: string
          category?: string
          certificate_type?: string
          condition?: string
          created_at?: string
          description?: string | null
          desired_item?: string | null
          duplicate_of?: string | null
          expires_at?: string | null
          flagged_duplicate?: boolean
          forum_game_ids?: string[]
          game_title?: string | null
          id?: string
          image_hash?: string | null
          plataformas?: string[] | null
          platform?: string | null
          price?: number
          seller_id: string
          status?: string
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          accepts_counteroffer?: boolean
          ad_type?: string
          category?: string
          certificate_type?: string
          condition?: string
          created_at?: string
          description?: string | null
          desired_item?: string | null
          duplicate_of?: string | null
          expires_at?: string | null
          flagged_duplicate?: boolean
          forum_game_ids?: string[]
          game_title?: string | null
          id?: string
          image_hash?: string | null
          plataformas?: string[] | null
          platform?: string | null
          price?: number
          seller_id?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      avaliacoes: {
        Row: {
          achievement_lock: string | null
          comment: string | null
          created_at: string
          id: string
          is_approved: boolean
          is_spoiler: boolean
          product_id: string | null
          rating: number
          spoiler_achievement_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          achievement_lock?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          is_approved?: boolean
          is_spoiler?: boolean
          product_id?: string | null
          rating: number
          spoiler_achievement_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          achievement_lock?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          is_approved?: boolean
          is_spoiler?: boolean
          product_id?: string | null
          rating?: number
          spoiler_achievement_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "avaliacoes_achievement_lock_fkey"
            columns: ["achievement_lock"]
            isOneToOne: false
            referencedRelation: "user_achievements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_view"
            referencedColumns: ["id"]
          },
        ]
      }
      avaliacoes_usuario: {
        Row: {
          anuncio_id: string | null
          comment: string | null
          created_at: string
          id: string
          is_revealed: boolean
          rating: number
          reveal_deadline: string
          reviewed_id: string
          reviewer_id: string
          trade_id: string | null
        }
        Insert: {
          anuncio_id?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          is_revealed?: boolean
          rating: number
          reveal_deadline?: string
          reviewed_id: string
          reviewer_id: string
          trade_id?: string | null
        }
        Update: {
          anuncio_id?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          is_revealed?: boolean
          rating?: number
          reveal_deadline?: string
          reviewed_id?: string
          reviewer_id?: string
          trade_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "avaliacoes_usuario_anuncio_id_fkey"
            columns: ["anuncio_id"]
            isOneToOne: false
            referencedRelation: "anuncios"
            referencedColumns: ["id"]
          },
        ]
      }
      badge_catalog: {
        Row: {
          category: string
          created_at: string
          description: string
          icon: string
          id: string
          image_url: string | null
          is_custom: boolean
          name: string
        }
        Insert: {
          category?: string
          created_at?: string
          description: string
          icon?: string
          id: string
          image_url?: string | null
          is_custom?: boolean
          name: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          icon?: string
          id?: string
          image_url?: string | null
          is_custom?: boolean
          name?: string
        }
        Relationships: []
      }
      ban_appeals: {
        Row: {
          created_at: string
          description: string
          id: string
          moderator_id: string | null
          moderator_response: string | null
          reason: Database["public"]["Enums"]["ban_appeal_reason"]
          resolved_at: string | null
          status: Database["public"]["Enums"]["ban_appeal_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          moderator_id?: string | null
          moderator_response?: string | null
          reason: Database["public"]["Enums"]["ban_appeal_reason"]
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["ban_appeal_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          moderator_id?: string | null
          moderator_response?: string | null
          reason?: Database["public"]["Enums"]["ban_appeal_reason"]
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["ban_appeal_status"]
          user_id?: string
        }
        Relationships: []
      }
      biblioteca_diario: {
        Row: {
          content: string
          created_at: string
          entry_date: string
          id: string
          product_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          entry_date?: string
          id?: string
          product_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          entry_date?: string
          id?: string
          product_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      biblioteca_lista_itens: {
        Row: {
          created_at: string
          id: string
          lista_id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lista_id: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lista_id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "biblioteca_lista_itens_lista_id_fkey"
            columns: ["lista_id"]
            isOneToOne: false
            referencedRelation: "biblioteca_listas"
            referencedColumns: ["id"]
          },
        ]
      }
      biblioteca_listas: {
        Row: {
          cor: string | null
          created_at: string
          id: string
          nome: string
          user_id: string
        }
        Insert: {
          cor?: string | null
          created_at?: string
          id?: string
          nome: string
          user_id: string
        }
        Update: {
          cor?: string | null
          created_at?: string
          id?: string
          nome?: string
          user_id?: string
        }
        Relationships: []
      }
      biblioteca_usuario: {
        Row: {
          acquired_at: string
          badge_completed: boolean
          badge_platinum: boolean
          badge_verified_source: string | null
          completed_at: string | null
          hours_played: number
          id: string
          lista_custom: string | null
          mood_tags: string[]
          my_screenshots: string[]
          personal_note: string | null
          personal_rating: number | null
          product_id: string | null
          started_at: string | null
          status: string
          status_updated_at: string
          user_id: string
        }
        Insert: {
          acquired_at?: string
          badge_completed?: boolean
          badge_platinum?: boolean
          badge_verified_source?: string | null
          completed_at?: string | null
          hours_played?: number
          id?: string
          lista_custom?: string | null
          mood_tags?: string[]
          my_screenshots?: string[]
          personal_note?: string | null
          personal_rating?: number | null
          product_id?: string | null
          started_at?: string | null
          status?: string
          status_updated_at?: string
          user_id: string
        }
        Update: {
          acquired_at?: string
          badge_completed?: boolean
          badge_platinum?: boolean
          badge_verified_source?: string | null
          completed_at?: string | null
          hours_played?: number
          id?: string
          lista_custom?: string | null
          mood_tags?: string[]
          my_screenshots?: string[]
          personal_note?: string | null
          personal_rating?: number | null
          product_id?: string | null
          started_at?: string | null
          status?: string
          status_updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "biblioteca_usuario_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biblioteca_usuario_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biblioteca_usuario_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_view"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_users: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
          scope: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
          scope?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
          scope?: string
        }
        Relationships: []
      }
      bundle_items: {
        Row: {
          bundle_id: string
          product_id: string
        }
        Insert: {
          bundle_id: string
          product_id: string
        }
        Update: {
          bundle_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bundle_items_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "bundles"
            referencedColumns: ["id"]
          },
        ]
      }
      bundles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          images: string[]
          is_active: boolean
          price: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          images?: string[]
          is_active?: boolean
          price?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          images?: string[]
          is_active?: boolean
          price?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      categorias: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
        }
        Relationships: []
      }
      certificados: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          product_id: string | null
          reason: string | null
          requested_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["certificate_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          product_id?: string | null
          reason?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["certificate_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          product_id?: string | null
          reason?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["certificate_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificados_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificados_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificados_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "public_profiles_view"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_ai_alerts: {
        Row: {
          action_taken: string | null
          conversation_id: string | null
          created_at: string
          id: string
          kind: string
          message_id: string | null
          minor_id: string
          peer_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          severity: string
          snippet: string | null
          status: string
        }
        Insert: {
          action_taken?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          kind: string
          message_id?: string | null
          minor_id: string
          peer_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
          snippet?: string | null
          status?: string
        }
        Update: {
          action_taken?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          message_id?: string | null
          minor_id?: string
          peer_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
          snippet?: string | null
          status?: string
        }
        Relationships: []
      }
      close_friends: {
        Row: {
          created_at: string
          friend_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      config_history: {
        Row: {
          changed_at: string | null
          changed_by: string | null
          config_key: string
          id: string
          new_value: Json | null
          old_value: Json | null
          reason: string | null
        }
        Insert: {
          changed_at?: string | null
          changed_by?: string | null
          config_key: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          reason?: string | null
        }
        Update: {
          changed_at?: string | null
          changed_by?: string | null
          config_key?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "config_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "config_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "public_profiles_view"
            referencedColumns: ["id"]
          },
        ]
      }
      connected_platforms: {
        Row: {
          connected_at: string
          id: string
          is_public: boolean
          platform: string
          profile_url: string | null
          user_id: string
          username: string
        }
        Insert: {
          connected_at?: string
          id?: string
          is_public?: boolean
          platform: string
          profile_url?: string | null
          user_id: string
          username: string
        }
        Update: {
          connected_at?: string
          id?: string
          is_public?: boolean
          platform?: string
          profile_url?: string | null
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      conversas: {
        Row: {
          admin_visible: boolean
          anuncio_id: string | null
          category: string
          channel: string
          created_at: string | null
          group_id: string | null
          has_active_report: boolean
          id: string
          is_admin_chat: boolean
          last_message: string | null
          last_message_at: string | null
          match_id: string | null
          participant_1: string
          participant_2: string
          status: string
          tournament_id: string | null
        }
        Insert: {
          admin_visible?: boolean
          anuncio_id?: string | null
          category?: string
          channel?: string
          created_at?: string | null
          group_id?: string | null
          has_active_report?: boolean
          id?: string
          is_admin_chat?: boolean
          last_message?: string | null
          last_message_at?: string | null
          match_id?: string | null
          participant_1: string
          participant_2: string
          status?: string
          tournament_id?: string | null
        }
        Update: {
          admin_visible?: boolean
          anuncio_id?: string | null
          category?: string
          channel?: string
          created_at?: string | null
          group_id?: string | null
          has_active_report?: boolean
          id?: string
          is_admin_chat?: boolean
          last_message?: string | null
          last_message_at?: string | null
          match_id?: string | null
          participant_1?: string
          participant_2?: string
          status?: string
          tournament_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversas_anuncio_id_fkey"
            columns: ["anuncio_id"]
            isOneToOne: false
            referencedRelation: "anuncios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversas_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_settings: {
        Row: {
          archived: boolean
          conversation_id: string
          created_at: string
          favorited: boolean
          id: string
          muted: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          conversation_id: string
          created_at?: string
          favorited?: boolean
          id?: string
          muted?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          archived?: boolean
          conversation_id?: string
          created_at?: string
          favorited?: boolean
          id?: string
          muted?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_settings_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversas"
            referencedColumns: ["id"]
          },
        ]
      }
      cupon_usos: {
        Row: {
          coupon_id: string
          id: string
          order_id: string
          used_at: string
          user_id: string | null
        }
        Insert: {
          coupon_id: string
          id?: string
          order_id: string
          used_at?: string
          user_id?: string | null
        }
        Update: {
          coupon_id?: string
          id?: string
          order_id?: string
          used_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cupon_usos_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "cupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cupon_usos_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cupon_usos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cupon_usos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_view"
            referencedColumns: ["id"]
          },
        ]
      }
      cupons: {
        Row: {
          code: string
          created_at: string
          discount_percent: number
          id: string
          is_active: boolean
          max_uses: number | null
          uses_count: number
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          code: string
          created_at?: string
          discount_percent?: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          uses_count?: number
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          discount_percent?: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          uses_count?: number
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      curated_lists: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          banner_image: string | null
          category: string | null
          cover_image: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_featured: boolean | null
          is_official: boolean | null
          is_public: boolean | null
          long_description: string | null
          slug: string
          title: string
          updated_at: string | null
          view_count: number | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          banner_image?: string | null
          category?: string | null
          cover_image?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_featured?: boolean | null
          is_official?: boolean | null
          is_public?: boolean | null
          long_description?: string | null
          slug: string
          title: string
          updated_at?: string | null
          view_count?: number | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          banner_image?: string | null
          category?: string | null
          cover_image?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_featured?: boolean | null
          is_official?: boolean | null
          is_public?: boolean | null
          long_description?: string | null
          slug?: string
          title?: string
          updated_at?: string | null
          view_count?: number | null
        }
        Relationships: []
      }
      daily_pick_overrides: {
        Row: {
          created_at: string
          pick_date: string
          product_id: string
          reason: string | null
          set_by: string | null
        }
        Insert: {
          created_at?: string
          pick_date: string
          product_id: string
          reason?: string | null
          set_by?: string | null
        }
        Update: {
          created_at?: string
          pick_date?: string
          product_id?: string
          reason?: string | null
          set_by?: string | null
        }
        Relationships: []
      }
      denuncias: {
        Row: {
          category: string
          cautionary_action: string | null
          created_at: string
          description: string | null
          id: string
          priority: string
          reason: string
          report_count: number
          reporter_id: string
          reporters: string[]
          resolved_at: string | null
          resolved_by: string | null
          status: string
          target_id: string
          target_type: string
        }
        Insert: {
          category?: string
          cautionary_action?: string | null
          created_at?: string
          description?: string | null
          id?: string
          priority?: string
          reason: string
          report_count?: number
          reporter_id: string
          reporters?: string[]
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          target_id: string
          target_type: string
        }
        Update: {
          category?: string
          cautionary_action?: string | null
          created_at?: string
          description?: string | null
          id?: string
          priority?: string
          reason?: string
          report_count?: number
          reporter_id?: string
          reporters?: string[]
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "denuncias_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "denuncias_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "public_profiles_view"
            referencedColumns: ["id"]
          },
        ]
      }
      developers: {
        Row: {
          banner_url: string | null
          bio: string | null
          country: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          employees: number | null
          founded_year: number | null
          headquarters: string | null
          id: string
          logo_url: string | null
          name: string
          notable_games: string[] | null
          parent_company: string | null
          slug: string
          social_links: Json | null
          updated_at: string | null
          website: string | null
          wiki_data: Json | null
          wikipedia_url: string | null
        }
        Insert: {
          banner_url?: string | null
          bio?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          employees?: number | null
          founded_year?: number | null
          headquarters?: string | null
          id?: string
          logo_url?: string | null
          name: string
          notable_games?: string[] | null
          parent_company?: string | null
          slug: string
          social_links?: Json | null
          updated_at?: string | null
          website?: string | null
          wiki_data?: Json | null
          wikipedia_url?: string | null
        }
        Update: {
          banner_url?: string | null
          bio?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          employees?: number | null
          founded_year?: number | null
          headquarters?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          notable_games?: string[] | null
          parent_company?: string | null
          slug?: string
          social_links?: Json | null
          updated_at?: string | null
          website?: string | null
          wiki_data?: Json | null
          wikipedia_url?: string | null
        }
        Relationships: []
      }
      device_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform?: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      favoritos: {
        Row: {
          created_at: string
          id: string
          product_id: string
          target_price: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          target_price?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          target_price?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favoritos_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      favoritos_anuncio: {
        Row: {
          anuncio_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          anuncio_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          anuncio_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favoritos_anuncio_anuncio_id_fkey"
            columns: ["anuncio_id"]
            isOneToOne: false
            referencedRelation: "anuncios"
            referencedColumns: ["id"]
          },
        ]
      }
      flash_promotions: {
        Row: {
          created_at: string
          created_by: string | null
          discount_percent: number
          ends_at: string
          id: string
          is_active: boolean
          product_id: string
          starts_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          discount_percent: number
          ends_at: string
          id?: string
          is_active?: boolean
          product_id: string
          starts_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          discount_percent?: number
          ends_at?: string
          id?: string
          is_active?: boolean
          product_id?: string
          starts_at?: string
        }
        Relationships: []
      }
      follow_requests: {
        Row: {
          created_at: string
          id: string
          requester_id: string
          target_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          requester_id: string
          target_id: string
        }
        Update: {
          created_at?: string
          id?: string
          requester_id?: string
          target_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_requests_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_requests_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_view"
            referencedColumns: ["id"]
          },
        ]
      }
      fornecedores: {
        Row: {
          address: string | null
          cnpj: string | null
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          cnpj?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          cnpj?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      forum_categories: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_community: boolean
          name: string
          parent_slug: string | null
          slug: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_community?: boolean
          name: string
          parent_slug?: string | null
          slug: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_community?: boolean
          name?: string
          parent_slug?: string | null
          slug?: string
        }
        Relationships: []
      }
      forum_post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: []
      }
      forum_posts: {
        Row: {
          achievement_lock: string | null
          category_slug: string | null
          content: string
          created_at: string | null
          id: string
          is_locked: boolean
          is_pinned: boolean
          is_spoiler: boolean
          likes_count: number
          product_id: string | null
          spoiler_achievement_name: string | null
          title: string | null
          tournament_id: string | null
          updated_at: string | null
          user_id: string
          visibility: string
        }
        Insert: {
          achievement_lock?: string | null
          category_slug?: string | null
          content: string
          created_at?: string | null
          id?: string
          is_locked?: boolean
          is_pinned?: boolean
          is_spoiler?: boolean
          likes_count?: number
          product_id?: string | null
          spoiler_achievement_name?: string | null
          title?: string | null
          tournament_id?: string | null
          updated_at?: string | null
          user_id: string
          visibility?: string
        }
        Update: {
          achievement_lock?: string | null
          category_slug?: string | null
          content?: string
          created_at?: string | null
          id?: string
          is_locked?: boolean
          is_pinned?: boolean
          is_spoiler?: boolean
          likes_count?: number
          product_id?: string | null
          spoiler_achievement_name?: string | null
          title?: string | null
          tournament_id?: string | null
          updated_at?: string | null
          user_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_posts_achievement_lock_fkey"
            columns: ["achievement_lock"]
            isOneToOne: false
            referencedRelation: "user_achievements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_posts_category_slug_fkey"
            columns: ["category_slug"]
            isOneToOne: false
            referencedRelation: "forum_categories"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "forum_posts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_posts_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_posts_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_view"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_replies: {
        Row: {
          content: string
          created_at: string | null
          id: string
          is_solution: boolean
          likes_count: number
          post_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          is_solution?: boolean
          likes_count?: number
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          is_solution?: boolean
          likes_count?: number
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_replies_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "forum_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_reply_likes: {
        Row: {
          created_at: string
          id: string
          reply_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reply_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reply_id?: string
          user_id?: string
        }
        Relationships: []
      }
      fotos_anuncio: {
        Row: {
          anuncio_id: string
          created_at: string
          id: string
          image_url: string
          position: number
        }
        Insert: {
          anuncio_id: string
          created_at?: string
          id?: string
          image_url: string
          position?: number
        }
        Update: {
          anuncio_id?: string
          created_at?: string
          id?: string
          image_url?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "fotos_anuncio_anuncio_id_fkey"
            columns: ["anuncio_id"]
            isOneToOne: false
            referencedRelation: "anuncios"
            referencedColumns: ["id"]
          },
        ]
      }
      friend_activity_states: {
        Row: {
          activity_ref_id: string
          activity_type: string
          created_at: string
          friend_id: string
          id: string
          state: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_ref_id: string
          activity_type: string
          created_at?: string
          friend_id: string
          id?: string
          state?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_ref_id?: string
          activity_type?: string
          created_at?: string
          friend_id?: string
          id?: string
          state?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      friend_favorites: {
        Row: {
          created_at: string
          friend_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          user_id?: string
        }
        Relationships: []
      }
      game_clips: {
        Row: {
          created_at: string
          duration_seconds: number | null
          id: string
          is_spoiler: boolean
          product_id: string
          spoiler_achievement_name: string | null
          thumbnail_url: string | null
          title: string | null
          user_id: string
          video_url: string
          visibility: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          is_spoiler?: boolean
          product_id: string
          spoiler_achievement_name?: string | null
          thumbnail_url?: string | null
          title?: string | null
          user_id: string
          video_url: string
          visibility?: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          is_spoiler?: boolean
          product_id?: string
          spoiler_achievement_name?: string | null
          thumbnail_url?: string | null
          title?: string | null
          user_id?: string
          video_url?: string
          visibility?: string
        }
        Relationships: []
      }
      game_opinion_likes: {
        Row: {
          created_at: string
          opinion_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          opinion_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          opinion_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_opinion_likes_opinion_id_fkey"
            columns: ["opinion_id"]
            isOneToOne: false
            referencedRelation: "game_opinions"
            referencedColumns: ["id"]
          },
        ]
      }
      game_opinion_replies: {
        Row: {
          conversation_id: string | null
          created_at: string
          id: string
          images: string[] | null
          opinion_id: string
          responder_id: string
          sender_id: string
          text: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          id?: string
          images?: string[] | null
          opinion_id: string
          responder_id: string
          sender_id: string
          text: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          id?: string
          images?: string[] | null
          opinion_id?: string
          responder_id?: string
          sender_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_opinion_replies_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "opinion_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_opinion_replies_opinion_id_fkey"
            columns: ["opinion_id"]
            isOneToOne: false
            referencedRelation: "game_opinions"
            referencedColumns: ["id"]
          },
        ]
      }
      game_opinions: {
        Row: {
          created_at: string
          id: string
          images: string[] | null
          is_spoiler: boolean
          likes_count: number
          product_id: string
          replies_count: number
          spoiler_achievement_name: string | null
          text: string
          updated_at: string
          user_id: string
          visibility: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          images?: string[] | null
          is_spoiler?: boolean
          likes_count?: number
          product_id: string
          replies_count?: number
          spoiler_achievement_name?: string | null
          text: string
          updated_at?: string
          user_id: string
          visibility?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          images?: string[] | null
          is_spoiler?: boolean
          likes_count?: number
          product_id?: string
          replies_count?: number
          spoiler_achievement_name?: string | null
          text?: string
          updated_at?: string
          user_id?: string
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_opinions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_opinions_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_opinions_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_view"
            referencedColumns: ["id"]
          },
        ]
      }
      game_rewards: {
        Row: {
          asset_url: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["reward_kind"]
          name: string
          payload: Json
          product_id: string
          rarity: Database["public"]["Enums"]["reward_rarity"]
          unlock_criteria: Json
          updated_at: string
        }
        Insert: {
          asset_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          kind: Database["public"]["Enums"]["reward_kind"]
          name: string
          payload?: Json
          product_id: string
          rarity?: Database["public"]["Enums"]["reward_rarity"]
          unlock_criteria?: Json
          updated_at?: string
        }
        Update: {
          asset_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["reward_kind"]
          name?: string
          payload?: Json
          product_id?: string
          rarity?: Database["public"]["Enums"]["reward_rarity"]
          unlock_criteria?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_rewards_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      game_screenshot_likes: {
        Row: {
          created_at: string
          screenshot_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          screenshot_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          screenshot_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_screenshot_likes_screenshot_id_fkey"
            columns: ["screenshot_id"]
            isOneToOne: false
            referencedRelation: "game_screenshots"
            referencedColumns: ["id"]
          },
        ]
      }
      game_screenshots: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          images: string[]
          is_spoiler: boolean
          likes_count: number
          product_id: string
          spoiler_achievement_name: string | null
          user_id: string
          visibility: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          images: string[]
          is_spoiler?: boolean
          likes_count?: number
          product_id: string
          spoiler_achievement_name?: string | null
          user_id: string
          visibility?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          images?: string[]
          is_spoiler?: boolean
          likes_count?: number
          product_id?: string
          spoiler_achievement_name?: string | null
          user_id?: string
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_screenshots_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      game_suggestions: {
        Row: {
          admin_notes: string | null
          cover_url: string | null
          created_at: string
          created_product_id: string | null
          description: string | null
          id: string
          requested_by: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["suggestion_status"]
          title: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          cover_url?: string | null
          created_at?: string
          created_product_id?: string | null
          description?: string | null
          id?: string
          requested_by: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["suggestion_status"]
          title: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          cover_url?: string | null
          created_at?: string
          created_product_id?: string | null
          description?: string | null
          id?: string
          requested_by?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["suggestion_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      game_timeline_events: {
        Row: {
          created_at: string
          id: string
          kind: string
          payload: Json | null
          product_id: string
          user_id: string
          user_note: string | null
          visibility: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          payload?: Json | null
          product_id: string
          user_id: string
          user_note?: string | null
          visibility?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          payload?: Json | null
          product_id?: string
          user_id?: string
          user_note?: string | null
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_timeline_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      games_catalog: {
        Row: {
          cover_url: string | null
          created_at: string
          id: string
          platforms: string[] | null
          popularity: number
          publisher: string | null
          slug: string
          tags: string[] | null
          title: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          id?: string
          platforms?: string[] | null
          popularity?: number
          publisher?: string | null
          slug: string
          tags?: string[] | null
          title: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          id?: string
          platforms?: string[] | null
          popularity?: number
          publisher?: string | null
          slug?: string
          tags?: string[] | null
          title?: string
        }
        Relationships: []
      }
      group_blocks: {
        Row: {
          created_at: string
          group_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_blocks_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_events: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          group_id: string
          id: string
          starts_at: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          group_id: string
          id?: string
          starts_at: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          group_id?: string
          id?: string
          starts_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_events_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string
          role: Database["public"]["Enums"]["group_role"]
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["group_role"]
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["group_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_poll_votes: {
        Row: {
          created_at: string
          id: string
          option_index: number
          poll_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          option_index: number
          poll_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          option_index?: number
          poll_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "group_polls"
            referencedColumns: ["id"]
          },
        ]
      }
      group_polls: {
        Row: {
          closes_at: string | null
          created_at: string
          created_by: string
          group_id: string
          id: string
          options: Json
          question: string
        }
        Insert: {
          closes_at?: string | null
          created_at?: string
          created_by: string
          group_id: string
          id?: string
          options: Json
          question: string
        }
        Update: {
          closes_at?: string | null
          created_at?: string
          created_by?: string
          group_id?: string
          id?: string
          options?: Json
          question?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_polls_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          disabled_at: string | null
          disabled_by: string | null
          disabled_reason: string | null
          id: string
          image_url: string | null
          is_disabled: boolean
          name: string
          owner_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          disabled_at?: string | null
          disabled_by?: string | null
          disabled_reason?: string | null
          id?: string
          image_url?: string | null
          is_disabled?: boolean
          name: string
          owner_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          disabled_at?: string | null
          disabled_by?: string | null
          disabled_reason?: string | null
          id?: string
          image_url?: string | null
          is_disabled?: boolean
          name?: string
          owner_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_view"
            referencedColumns: ["id"]
          },
        ]
      }
      guardian_link_requests: {
        Row: {
          atestado_url: string
          created_at: string
          guardian_cpf: string
          guardian_full_name: string
          guardian_id: string | null
          guardian_phone: string
          id: string
          minor_id: string
          reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          atestado_url: string
          created_at?: string
          guardian_cpf: string
          guardian_full_name: string
          guardian_id?: string | null
          guardian_phone: string
          id?: string
          minor_id: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          atestado_url?: string
          created_at?: string
          guardian_cpf?: string
          guardian_full_name?: string
          guardian_id?: string | null
          guardian_phone?: string
          id?: string
          minor_id?: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      integration_webhooks: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          event: string
          id: string
          last_test_at: string | null
          last_test_status: string | null
          name: string
          secret: string | null
          updated_at: string
          url: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          event: string
          id?: string
          last_test_at?: string | null
          last_test_status?: string | null
          name: string
          secret?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          event?: string
          id?: string
          last_test_at?: string | null
          last_test_status?: string | null
          name?: string
          secret?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      itens_pedido: {
        Row: {
          bundle_id: string | null
          created_at: string
          id: string
          order_id: string
          price_at_purchase: number
          product_id: string
          quantity: number
        }
        Insert: {
          bundle_id?: string | null
          created_at?: string
          id?: string
          order_id: string
          price_at_purchase: number
          product_id: string
          quantity?: number
        }
        Update: {
          bundle_id?: string | null
          created_at?: string
          id?: string
          order_id?: string
          price_at_purchase?: number
          product_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "itens_pedido_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_pedido_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_pedido_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      library_custom_covers: {
        Row: {
          cover_url: string
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          cover_url: string
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          cover_url?: string
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: []
      }
      lista_visibilidade: {
        Row: {
          created_at: string
          id: string
          lista_custom: string
          updated_at: string
          user_id: string
          visibility: string
        }
        Insert: {
          created_at?: string
          id?: string
          lista_custom: string
          updated_at?: string
          user_id: string
          visibility?: string
        }
        Update: {
          created_at?: string
          id?: string
          lista_custom?: string
          updated_at?: string
          user_id?: string
          visibility?: string
        }
        Relationships: []
      }
      login_history: {
        Row: {
          created_at: string
          id: string
          ip_address: string | null
          logged_in_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address?: string | null
          logged_in_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: string | null
          logged_in_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      mensagens: {
        Row: {
          anuncio_id: string | null
          content: string
          created_at: string
          flagged_auto: boolean
          group_id: string | null
          id: string
          image_url: string | null
          is_admin_chat: boolean
          is_read: boolean
          match_id: string | null
          message_type: string
          payload: Json | null
          receiver_id: string
          reply_to_id: string | null
          sender_id: string
          tournament_id: string | null
        }
        Insert: {
          anuncio_id?: string | null
          content: string
          created_at?: string
          flagged_auto?: boolean
          group_id?: string | null
          id?: string
          image_url?: string | null
          is_admin_chat?: boolean
          is_read?: boolean
          match_id?: string | null
          message_type?: string
          payload?: Json | null
          receiver_id: string
          reply_to_id?: string | null
          sender_id: string
          tournament_id?: string | null
        }
        Update: {
          anuncio_id?: string | null
          content?: string
          created_at?: string
          flagged_auto?: boolean
          group_id?: string | null
          id?: string
          image_url?: string | null
          is_admin_chat?: boolean
          is_read?: boolean
          match_id?: string | null
          message_type?: string
          payload?: Json | null
          receiver_id?: string
          reply_to_id?: string | null
          sender_id?: string
          tournament_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mensagens_anuncio_id_fkey"
            columns: ["anuncio_id"]
            isOneToOne: false
            referencedRelation: "anuncios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensagens_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensagens_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "mensagens"
            referencedColumns: ["id"]
          },
        ]
      }
      mentions: {
        Row: {
          context_preview: string | null
          created_at: string
          id: string
          mentioned_by: string
          mentioned_user_id: string
          namespace: string
          source_id: string
          source_type: string
        }
        Insert: {
          context_preview?: string | null
          created_at?: string
          id?: string
          mentioned_by: string
          mentioned_user_id: string
          namespace?: string
          source_id: string
          source_type: string
        }
        Update: {
          context_preview?: string | null
          created_at?: string
          id?: string
          mentioned_by?: string
          mentioned_user_id?: string
          namespace?: string
          source_id?: string
          source_type?: string
        }
        Relationships: []
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "mensagens"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_history: {
        Row: {
          action: string
          created_at: string
          duration_days: number | null
          id: string
          moderator_id: string
          reason: string | null
          reference_id: string | null
          reference_type: string | null
          target_user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          duration_days?: number | null
          id?: string
          moderator_id: string
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          target_user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          duration_days?: number | null
          id?: string
          moderator_id?: string
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          target_user_id?: string
        }
        Relationships: []
      }
      movimentacoes_estoque: {
        Row: {
          created_at: string
          employee_id: string | null
          id: string
          notes: string | null
          product_id: string
          quantity: number
          quantity_after: number
          quantity_before: number
          reference_id: string | null
          reference_type: string | null
          type: Database["public"]["Enums"]["stock_movement_type"]
        }
        Insert: {
          created_at?: string
          employee_id?: string | null
          id?: string
          notes?: string | null
          product_id: string
          quantity: number
          quantity_after?: number
          quantity_before?: number
          reference_id?: string | null
          reference_type?: string | null
          type: Database["public"]["Enums"]["stock_movement_type"]
        }
        Update: {
          created_at?: string
          employee_id?: string | null
          id?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          quantity_after?: number
          quantity_before?: number
          reference_id?: string | null
          reference_type?: string | null
          type?: Database["public"]["Enums"]["stock_movement_type"]
        }
        Relationships: [
          {
            foreignKeyName: "movimentacoes_estoque_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_estoque_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_estoque_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          forum_mentions: boolean
          forum_replies: boolean
          forum_topics: boolean
          library_activity: boolean
          library_opinion: boolean
          library_review_completa: boolean
          library_screenshot: boolean
          midias_especiais: boolean
          social_follows: boolean
          social_likes: boolean
          social_replies: boolean
          tournament_1d: boolean
          tournament_1h: boolean
          tournament_7d: boolean
          tournament_match: boolean
          tournament_result: boolean
          tournament_signup: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          forum_mentions?: boolean
          forum_replies?: boolean
          forum_topics?: boolean
          library_activity?: boolean
          library_opinion?: boolean
          library_review_completa?: boolean
          library_screenshot?: boolean
          midias_especiais?: boolean
          social_follows?: boolean
          social_likes?: boolean
          social_replies?: boolean
          tournament_1d?: boolean
          tournament_1h?: boolean
          tournament_7d?: boolean
          tournament_match?: boolean
          tournament_result?: boolean
          tournament_signup?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          forum_mentions?: boolean
          forum_replies?: boolean
          forum_topics?: boolean
          library_activity?: boolean
          library_opinion?: boolean
          library_review_completa?: boolean
          library_screenshot?: boolean
          midias_especiais?: boolean
          social_follows?: boolean
          social_likes?: boolean
          social_replies?: boolean
          tournament_1d?: boolean
          tournament_1h?: boolean
          tournament_7d?: boolean
          tournament_match?: boolean
          tournament_result?: boolean
          tournament_signup?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          banner_url: string | null
          body: string | null
          created_at: string
          cta_label: string | null
          cta_url: string | null
          id: string
          is_read: boolean
          kind: Database["public"]["Enums"]["notification_kind"]
          reference_id: string | null
          reference_type: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          banner_url?: string | null
          body?: string | null
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          id?: string
          is_read?: boolean
          kind?: Database["public"]["Enums"]["notification_kind"]
          reference_id?: string | null
          reference_type?: string | null
          title: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          banner_url?: string | null
          body?: string | null
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          id?: string
          is_read?: boolean
          kind?: Database["public"]["Enums"]["notification_kind"]
          reference_id?: string | null
          reference_type?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: []
      }
      opinion_conversations: {
        Row: {
          author_id: string
          created_at: string
          id: string
          opinion_id: string
          responder_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          created_at?: string
          id?: string
          opinion_id: string
          responder_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          created_at?: string
          id?: string
          opinion_id?: string
          responder_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "opinion_conversations_opinion_id_fkey"
            columns: ["opinion_id"]
            isOneToOne: false
            referencedRelation: "game_opinions"
            referencedColumns: ["id"]
          },
        ]
      }
      opinion_mutes: {
        Row: {
          created_at: string
          id: string
          kind: string
          target_product_id: string | null
          target_user_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          target_product_id?: string | null
          target_user_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          target_product_id?: string | null
          target_user_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      pedidos: {
        Row: {
          coupon_code: string | null
          created_at: string
          discount_amount: number
          employee_id: string | null
          id: string
          installments: number | null
          payment_method: string | null
          source: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          coupon_code?: string | null
          created_at?: string
          discount_amount?: number
          employee_id?: string | null
          id?: string
          installments?: number | null
          payment_method?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          coupon_code?: string | null
          created_at?: string
          discount_amount?: number
          employee_id?: string | null
          id?: string
          installments?: number | null
          payment_method?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      price_history: {
        Row: {
          discount: number
          id: string
          original_price: number
          price: number
          product_id: string
          recorded_at: string
        }
        Insert: {
          discount?: number
          id?: string
          original_price?: number
          price: number
          product_id: string
          recorded_at?: string
        }
        Update: {
          discount?: number
          id?: string
          original_price?: number
          price?: number
          product_id?: string
          recorded_at?: string
        }
        Relationships: []
      }
      privacy_grants: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          scope: string
          viewer_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id: string
          scope: string
          viewer_id: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          scope?: string
          viewer_id?: string
        }
        Relationships: []
      }
      product_keys: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          imported_at: string | null
          imported_by: string | null
          key_code: string
          order_id: string | null
          platform: string | null
          product_id: string
          reserved_at: string | null
          sold_at: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          imported_at?: string | null
          imported_by?: string | null
          key_code: string
          order_id?: string | null
          platform?: string | null
          product_id: string
          reserved_at?: string | null
          sold_at?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          imported_at?: string | null
          imported_by?: string | null
          key_code?: string
          order_id?: string | null
          platform?: string | null
          product_id?: string
          reserved_at?: string | null
          sold_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_keys_imported_by_fkey"
            columns: ["imported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_keys_imported_by_fkey"
            columns: ["imported_by"]
            isOneToOne: false
            referencedRelation: "public_profiles_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_keys_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_keys_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      product_views: {
        Row: {
          id: string
          product_id: string
          session_id: string | null
          user_id: string | null
          viewed_at: string
        }
        Insert: {
          id?: string
          product_id: string
          session_id?: string | null
          user_id?: string | null
          viewed_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          session_id?: string | null
          user_id?: string | null
          viewed_at?: string
        }
        Relationships: []
      }
      produto_imagens: {
        Row: {
          created_at: string
          id: string
          image_url: string
          position: number
          product_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          position?: number
          product_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          position?: number
          product_id?: string
        }
        Relationships: []
      }
      produtos: {
        Row: {
          awaiting_first_stock: boolean
          catalog_game_id: string | null
          category: string | null
          category_id: string | null
          classificacao_indicativa: Database["public"]["Enums"]["classificacao_indicativa"]
          cost_price: number | null
          created_at: string
          description: string | null
          developer_id: string | null
          discount: number
          estado_publicacao: Database["public"]["Enums"]["produto_estado"]
          featured: boolean
          id: string
          image_url: string | null
          is_active: boolean
          original_price: number
          platform: string[] | null
          price: number
          product_type: Database["public"]["Enums"]["product_type"]
          publisher: string | null
          publisher_id: string | null
          rating: number | null
          release_date: string | null
          stock: number
          stock_alert_threshold: number
          supplier_id: string | null
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          awaiting_first_stock?: boolean
          catalog_game_id?: string | null
          category?: string | null
          category_id?: string | null
          classificacao_indicativa?: Database["public"]["Enums"]["classificacao_indicativa"]
          cost_price?: number | null
          created_at?: string
          description?: string | null
          developer_id?: string | null
          discount?: number
          estado_publicacao?: Database["public"]["Enums"]["produto_estado"]
          featured?: boolean
          id?: string
          image_url?: string | null
          is_active?: boolean
          original_price?: number
          platform?: string[] | null
          price?: number
          product_type?: Database["public"]["Enums"]["product_type"]
          publisher?: string | null
          publisher_id?: string | null
          rating?: number | null
          release_date?: string | null
          stock?: number
          stock_alert_threshold?: number
          supplier_id?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          awaiting_first_stock?: boolean
          catalog_game_id?: string | null
          category?: string | null
          category_id?: string | null
          classificacao_indicativa?: Database["public"]["Enums"]["classificacao_indicativa"]
          cost_price?: number | null
          created_at?: string
          description?: string | null
          developer_id?: string | null
          discount?: number
          estado_publicacao?: Database["public"]["Enums"]["produto_estado"]
          featured?: boolean
          id?: string
          image_url?: string | null
          is_active?: boolean
          original_price?: number
          platform?: string[] | null
          price?: number
          product_type?: Database["public"]["Enums"]["product_type"]
          publisher?: string | null
          publisher_id?: string | null
          rating?: number | null
          release_date?: string | null
          stock?: number
          stock_alert_threshold?: number
          supplier_id?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "produtos_catalog_game_id_fkey"
            columns: ["catalog_game_id"]
            isOneToOne: false
            referencedRelation: "games_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produtos_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produtos_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_highlights: {
        Row: {
          created_at: string
          id: string
          position: number
          ref_id: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          position?: number
          ref_id: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          position?: number
          ref_id?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active_title_id: string | null
          adult_transitioned_at: string | null
          age_verified: boolean
          always_hide_spoilers: boolean
          anonymized_at: string | null
          avatar_url: string | null
          backlog_note: string | null
          ban_reason: string | null
          ban_reason_public: string | null
          banned_until: string | null
          banner_url: string | null
          bio: string | null
          birth_date: string | null
          chat_privacy_mode: string
          contact_email: string | null
          cpf: string | null
          created_at: string
          current_game_id: string | null
          data_saver_mode: boolean
          display_name: string | null
          email_notifications: boolean
          favorite_genres: string[] | null
          frequent_seller_at: string | null
          frequent_seller_notice_dismissed_at: string | null
          gamer_personality: string | null
          guardian_user_id: string | null
          hide_adult_content: boolean
          hide_owned_games: boolean
          id: string
          is_frequent_seller: boolean
          is_paused: boolean
          is_private: boolean
          is_verified_account: boolean
          library_visibility: string
          minor_chat_approval_mode: string
          minor_chat_level: string | null
          monthly_favorites: string[] | null
          notifications_snoozed_until: string | null
          onboarded_at: string | null
          opinions_visibility: string
          paused_at: string | null
          personal_theme: Json
          phone: string | null
          privacy_exceptions: string[]
          profile_cover_url: string | null
          push_notifications: boolean
          referral_code: string | null
          referred_by: string | null
          require_follow_approval: boolean
          screenshots_visibility: string
          seller_bio: string | null
          stats_hidden_types: string[]
          theme_color: string | null
          timeline_visibility: string
          tournament_penalty_count: number
          tournament_penalty_skip_remaining: number
          trophy_showcase: string[] | null
          updated_at: string
          username: string | null
          verified_at: string | null
        }
        Insert: {
          active_title_id?: string | null
          adult_transitioned_at?: string | null
          age_verified?: boolean
          always_hide_spoilers?: boolean
          anonymized_at?: string | null
          avatar_url?: string | null
          backlog_note?: string | null
          ban_reason?: string | null
          ban_reason_public?: string | null
          banned_until?: string | null
          banner_url?: string | null
          bio?: string | null
          birth_date?: string | null
          chat_privacy_mode?: string
          contact_email?: string | null
          cpf?: string | null
          created_at?: string
          current_game_id?: string | null
          data_saver_mode?: boolean
          display_name?: string | null
          email_notifications?: boolean
          favorite_genres?: string[] | null
          frequent_seller_at?: string | null
          frequent_seller_notice_dismissed_at?: string | null
          gamer_personality?: string | null
          guardian_user_id?: string | null
          hide_adult_content?: boolean
          hide_owned_games?: boolean
          id: string
          is_frequent_seller?: boolean
          is_paused?: boolean
          is_private?: boolean
          is_verified_account?: boolean
          library_visibility?: string
          minor_chat_approval_mode?: string
          minor_chat_level?: string | null
          monthly_favorites?: string[] | null
          notifications_snoozed_until?: string | null
          onboarded_at?: string | null
          opinions_visibility?: string
          paused_at?: string | null
          personal_theme?: Json
          phone?: string | null
          privacy_exceptions?: string[]
          profile_cover_url?: string | null
          push_notifications?: boolean
          referral_code?: string | null
          referred_by?: string | null
          require_follow_approval?: boolean
          screenshots_visibility?: string
          seller_bio?: string | null
          stats_hidden_types?: string[]
          theme_color?: string | null
          timeline_visibility?: string
          tournament_penalty_count?: number
          tournament_penalty_skip_remaining?: number
          trophy_showcase?: string[] | null
          updated_at?: string
          username?: string | null
          verified_at?: string | null
        }
        Update: {
          active_title_id?: string | null
          adult_transitioned_at?: string | null
          age_verified?: boolean
          always_hide_spoilers?: boolean
          anonymized_at?: string | null
          avatar_url?: string | null
          backlog_note?: string | null
          ban_reason?: string | null
          ban_reason_public?: string | null
          banned_until?: string | null
          banner_url?: string | null
          bio?: string | null
          birth_date?: string | null
          chat_privacy_mode?: string
          contact_email?: string | null
          cpf?: string | null
          created_at?: string
          current_game_id?: string | null
          data_saver_mode?: boolean
          display_name?: string | null
          email_notifications?: boolean
          favorite_genres?: string[] | null
          frequent_seller_at?: string | null
          frequent_seller_notice_dismissed_at?: string | null
          gamer_personality?: string | null
          guardian_user_id?: string | null
          hide_adult_content?: boolean
          hide_owned_games?: boolean
          id?: string
          is_frequent_seller?: boolean
          is_paused?: boolean
          is_private?: boolean
          is_verified_account?: boolean
          library_visibility?: string
          minor_chat_approval_mode?: string
          minor_chat_level?: string | null
          monthly_favorites?: string[] | null
          notifications_snoozed_until?: string | null
          onboarded_at?: string | null
          opinions_visibility?: string
          paused_at?: string | null
          personal_theme?: Json
          phone?: string | null
          privacy_exceptions?: string[]
          profile_cover_url?: string | null
          push_notifications?: boolean
          referral_code?: string | null
          referred_by?: string | null
          require_follow_approval?: boolean
          screenshots_visibility?: string
          seller_bio?: string | null
          stats_hidden_types?: string[]
          theme_color?: string | null
          timeline_visibility?: string
          tournament_penalty_count?: number
          tournament_penalty_skip_remaining?: number
          trophy_showcase?: string[] | null
          updated_at?: string
          username?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "public_profiles_view"
            referencedColumns: ["id"]
          },
        ]
      }
      publishers: {
        Row: {
          banner_url: string | null
          bio: string | null
          country: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          employees: number | null
          founded_year: number | null
          headquarters: string | null
          id: string
          logo_url: string | null
          name: string
          notable_games: string[] | null
          parent_company: string | null
          slug: string
          social_links: Json | null
          updated_at: string | null
          website: string | null
          wiki_data: Json | null
          wikipedia_url: string | null
        }
        Insert: {
          banner_url?: string | null
          bio?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          employees?: number | null
          founded_year?: number | null
          headquarters?: string | null
          id?: string
          logo_url?: string | null
          name: string
          notable_games?: string[] | null
          parent_company?: string | null
          slug: string
          social_links?: Json | null
          updated_at?: string | null
          website?: string | null
          wiki_data?: Json | null
          wikipedia_url?: string | null
        }
        Update: {
          banner_url?: string | null
          bio?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          employees?: number | null
          founded_year?: number | null
          headquarters?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          notable_games?: string[] | null
          parent_company?: string | null
          slug?: string
          social_links?: Json | null
          updated_at?: string | null
          website?: string | null
          wiki_data?: Json | null
          wikipedia_url?: string | null
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          count: number
          id: string
          key: string
          user_id: string
          window_start: string
        }
        Insert: {
          count?: number
          id?: string
          key: string
          user_id: string
          window_start?: string
        }
        Update: {
          count?: number
          id?: string
          key?: string
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      reembolsos: {
        Row: {
          created_at: string
          id: string
          motivo: string
          pedido_id: string
          processado_em: string
          processado_por: string
          valor: number
        }
        Insert: {
          created_at?: string
          id?: string
          motivo: string
          pedido_id: string
          processado_em?: string
          processado_por: string
          valor: number
        }
        Update: {
          created_at?: string
          id?: string
          motivo?: string
          pedido_id?: string
          processado_em?: string
          processado_por?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "reembolsos_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      review_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          review_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          review_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          review_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_comments_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "avaliacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      review_completa_visibility: {
        Row: {
          created_at: string
          id: string
          review_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          review_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          review_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_completa_visibility_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews_completas"
            referencedColumns: ["id"]
          },
        ]
      }
      review_likes: {
        Row: {
          created_at: string
          id: string
          review_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          review_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          review_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_likes_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "avaliacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      review_metadata: {
        Row: {
          completion: string | null
          created_at: string
          difficulty: string | null
          has_spoiler: boolean
          hours_played: number | null
          mood: string | null
          platform: string | null
          review_id: string
          updated_at: string
        }
        Insert: {
          completion?: string | null
          created_at?: string
          difficulty?: string | null
          has_spoiler?: boolean
          hours_played?: number | null
          mood?: string | null
          platform?: string | null
          review_id: string
          updated_at?: string
        }
        Update: {
          completion?: string | null
          created_at?: string
          difficulty?: string | null
          has_spoiler?: boolean
          hours_played?: number | null
          mood?: string | null
          platform?: string | null
          review_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      review_screenshots: {
        Row: {
          created_at: string
          id: string
          image_url: string
          owner_id: string | null
          position: number
          review_id: string
          visibility: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          owner_id?: string | null
          position?: number
          review_id: string
          visibility?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          owner_id?: string | null
          position?: number
          review_id?: string
          visibility?: string
        }
        Relationships: []
      }
      reviews_completas: {
        Row: {
          analise: string
          contras: string[] | null
          created_at: string
          dificuldade: string | null
          horas_jogadas: number | null
          id: string
          is_spoiler: boolean
          momentos_favoritos: string | null
          personagens_favoritos: string | null
          plataforma: string | null
          product_id: string
          pros: string[] | null
          recomendacao: string | null
          spoiler_achievement_name: string | null
          status: string | null
          tags_emocionais: string[] | null
          trilha_sonora_favorita: string | null
          updated_at: string
          user_id: string
          visibility: string
        }
        Insert: {
          analise: string
          contras?: string[] | null
          created_at?: string
          dificuldade?: string | null
          horas_jogadas?: number | null
          id?: string
          is_spoiler?: boolean
          momentos_favoritos?: string | null
          personagens_favoritos?: string | null
          plataforma?: string | null
          product_id: string
          pros?: string[] | null
          recomendacao?: string | null
          spoiler_achievement_name?: string | null
          status?: string | null
          tags_emocionais?: string[] | null
          trilha_sonora_favorita?: string | null
          updated_at?: string
          user_id: string
          visibility?: string
        }
        Update: {
          analise?: string
          contras?: string[] | null
          created_at?: string
          dificuldade?: string | null
          horas_jogadas?: number | null
          id?: string
          is_spoiler?: boolean
          momentos_favoritos?: string | null
          personagens_favoritos?: string | null
          plataforma?: string | null
          product_id?: string
          pros?: string[] | null
          recomendacao?: string | null
          spoiler_achievement_name?: string | null
          status?: string | null
          tags_emocionais?: string[] | null
          trilha_sonora_favorita?: string | null
          updated_at?: string
          user_id?: string
          visibility?: string
        }
        Relationships: []
      }
      seller_profiles: {
        Row: {
          admin_suspended: boolean
          admin_suspended_at: string | null
          admin_suspension_reason: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string
          first_listing_at: string | null
          handle: string
          id: string
          is_private: boolean
          rating: number
          total_sales: number
          total_trades: number
          updated_at: string
          user_id: string
          vacation_message: string | null
          vacation_mode: boolean
        }
        Insert: {
          admin_suspended?: boolean
          admin_suspended_at?: string | null
          admin_suspension_reason?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name: string
          first_listing_at?: string | null
          handle: string
          id?: string
          is_private?: boolean
          rating?: number
          total_sales?: number
          total_trades?: number
          updated_at?: string
          user_id: string
          vacation_message?: string | null
          vacation_mode?: boolean
        }
        Update: {
          admin_suspended?: boolean
          admin_suspended_at?: string | null
          admin_suspension_reason?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string
          first_listing_at?: string | null
          handle?: string
          id?: string
          is_private?: boolean
          rating?: number
          total_sales?: number
          total_trades?: number
          updated_at?: string
          user_id?: string
          vacation_message?: string | null
          vacation_mode?: boolean
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      site_settings_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          new_value: Json | null
          old_value: Json | null
          setting_key: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          setting_key: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          setting_key?: string
        }
        Relationships: []
      }
      social_content_states: {
        Row: {
          content_id: string
          content_type: string
          state: Database["public"]["Enums"]["social_content_state"]
          updated_at: string
          user_id: string
        }
        Insert: {
          content_id: string
          content_type: string
          state?: Database["public"]["Enums"]["social_content_state"]
          updated_at?: string
          user_id: string
        }
        Update: {
          content_id?: string
          content_type?: string
          state?: Database["public"]["Enums"]["social_content_state"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      social_favorites: {
        Row: {
          content_id: string
          content_type: string
          created_at: string
          user_id: string
        }
        Insert: {
          content_id: string
          content_type: string
          created_at?: string
          user_id: string
        }
        Update: {
          content_id?: string
          content_type?: string
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          banner_url: string | null
          bio: string | null
          created_at: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          long_description: string | null
          name: string
          photo_url: string | null
          role: string
          slug: string
          social_links: Json | null
          updated_at: string | null
        }
        Insert: {
          banner_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          long_description?: string | null
          name: string
          photo_url?: string | null
          role: string
          slug: string
          social_links?: Json | null
          updated_at?: string | null
        }
        Update: {
          banner_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          long_description?: string | null
          name?: string
          photo_url?: string | null
          role?: string
          slug?: string
          social_links?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ticket_messages: {
        Row: {
          attachments: string[]
          content: string
          created_at: string
          id: string
          sender_id: string
          ticket_id: string
        }
        Insert: {
          attachments?: string[]
          content: string
          created_at?: string
          id?: string
          sender_id: string
          ticket_id: string
        }
        Update: {
          attachments?: string[]
          content?: string
          created_at?: string
          id?: string
          sender_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          assigned_to: string | null
          attachments: string[]
          body: string | null
          channel: Database["public"]["Enums"]["ticket_channel"]
          created_at: string
          id: string
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          attachments?: string[]
          body?: string | null
          channel: Database["public"]["Enums"]["ticket_channel"]
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          attachments?: string[]
          body?: string | null
          channel?: Database["public"]["Enums"]["ticket_channel"]
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tournament_bans: {
        Row: {
          banned_by: string | null
          created_at: string
          id: string
          reason: string | null
          tournament_id: string
          user_id: string
        }
        Insert: {
          banned_by?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          tournament_id: string
          user_id: string
        }
        Update: {
          banned_by?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          tournament_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_bans_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          kind: string
          match_id: string | null
          payload: Json | null
          tournament_id: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          kind?: string
          match_id?: string | null
          payload?: Json | null
          tournament_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          kind?: string
          match_id?: string | null
          payload?: Json | null
          tournament_id?: string
          user_id?: string
        }
        Relationships: []
      }
      tournament_chat_mutes: {
        Row: {
          created_at: string
          id: string
          muted_by: string
          muted_until: string
          reason: string | null
          tournament_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          muted_by: string
          muted_until: string
          reason?: string | null
          tournament_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          muted_by?: string
          muted_until?: string
          reason?: string | null
          tournament_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_chat_mutes_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_confirmations: {
        Row: {
          confirmed_at: string | null
          expires_at: string | null
          id: string
          sent_at: string
          stage: string
          tournament_id: string
          user_id: string
        }
        Insert: {
          confirmed_at?: string | null
          expires_at?: string | null
          id?: string
          sent_at?: string
          stage: string
          tournament_id: string
          user_id: string
        }
        Update: {
          confirmed_at?: string | null
          expires_at?: string | null
          id?: string
          sent_at?: string
          stage?: string
          tournament_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_confirmations_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_duplicate_alerts: {
        Row: {
          created_at: string
          id: string
          reason: string
          resolved: boolean
          resolved_by: string | null
          tournament_id: string
          user_ids: string[]
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          resolved?: boolean
          resolved_by?: string | null
          tournament_id: string
          user_ids: string[]
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          resolved?: boolean
          resolved_by?: string | null
          tournament_id?: string
          user_ids?: string[]
        }
        Relationships: []
      }
      tournament_highlights: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          image_url: string | null
          match_id: string | null
          title: string
          tournament_id: string
          video_url: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          match_id?: string | null
          title: string
          tournament_id: string
          video_url?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          match_id?: string | null
          title?: string
          tournament_id?: string
          video_url?: string | null
        }
        Relationships: []
      }
      tournament_live_events: {
        Row: {
          actor_id: string | null
          created_at: string
          id: string
          kind: string
          payload: Json
          tournament_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: string
          kind: string
          payload?: Json
          tournament_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          payload?: Json
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_live_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_live_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_live_events_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_match_events: {
        Row: {
          created_at: string
          id: string
          kind: string
          match_id: string
          payload: Json | null
          tournament_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          match_id: string
          payload?: Json | null
          tournament_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          match_id?: string
          payload?: Json | null
          tournament_id?: string
        }
        Relationships: []
      }
      tournament_matches: {
        Row: {
          bracket_side: string
          created_at: string
          dispute_open: boolean
          ended_at: string | null
          id: string
          is_live: boolean
          momentum: number
          mvp_user_id: string | null
          player_a: string | null
          player_b: string | null
          position: number
          reported_at: string | null
          reported_by: string | null
          reported_score_a: number | null
          reported_score_b: number | null
          round: number
          round_label: string | null
          scheduled_at: string | null
          score_a: number | null
          score_b: number | null
          started_at: string | null
          status: string
          stream_url: string | null
          tournament_id: string
          winner: string | null
        }
        Insert: {
          bracket_side?: string
          created_at?: string
          dispute_open?: boolean
          ended_at?: string | null
          id?: string
          is_live?: boolean
          momentum?: number
          mvp_user_id?: string | null
          player_a?: string | null
          player_b?: string | null
          position?: number
          reported_at?: string | null
          reported_by?: string | null
          reported_score_a?: number | null
          reported_score_b?: number | null
          round?: number
          round_label?: string | null
          scheduled_at?: string | null
          score_a?: number | null
          score_b?: number | null
          started_at?: string | null
          status?: string
          stream_url?: string | null
          tournament_id: string
          winner?: string | null
        }
        Update: {
          bracket_side?: string
          created_at?: string
          dispute_open?: boolean
          ended_at?: string | null
          id?: string
          is_live?: boolean
          momentum?: number
          mvp_user_id?: string | null
          player_a?: string | null
          player_b?: string | null
          position?: number
          reported_at?: string | null
          reported_by?: string | null
          reported_score_a?: number | null
          reported_score_b?: number | null
          round?: number
          round_label?: string | null
          scheduled_at?: string | null
          score_a?: number | null
          score_b?: number | null
          started_at?: string | null
          status?: string
          stream_url?: string | null
          tournament_id?: string
          winner?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_moderators: {
        Row: {
          created_at: string
          id: string
          role: string
          tournament_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string
          tournament_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          tournament_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_moderators_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_mvp_votes: {
        Row: {
          created_at: string
          id: string
          match_id: string
          tournament_id: string
          voted_for_id: string
          voter_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          match_id: string
          tournament_id: string
          voted_for_id: string
          voter_id: string
        }
        Update: {
          created_at?: string
          id?: string
          match_id?: string
          tournament_id?: string
          voted_for_id?: string
          voter_id?: string
        }
        Relationships: []
      }
      tournament_participants: {
        Row: {
          chat_role: Database["public"]["Enums"]["tournament_chat_role"]
          device_fingerprint: string | null
          final_rank: number | null
          id: string
          joined_at: string
          phone_verified: boolean
          signup_ip: unknown
          tournament_id: string
          user_id: string
        }
        Insert: {
          chat_role?: Database["public"]["Enums"]["tournament_chat_role"]
          device_fingerprint?: string | null
          final_rank?: number | null
          id?: string
          joined_at?: string
          phone_verified?: boolean
          signup_ip?: unknown
          tournament_id: string
          user_id: string
        }
        Update: {
          chat_role?: Database["public"]["Enums"]["tournament_chat_role"]
          device_fingerprint?: string | null
          final_rank?: number | null
          id?: string
          joined_at?: string
          phone_verified?: boolean
          signup_ip?: unknown
          tournament_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_participants_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_predictions: {
        Row: {
          created_at: string
          id: string
          match_id: string
          predicted_winner_id: string
          tournament_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          match_id: string
          predicted_winner_id: string
          tournament_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          match_id?: string
          predicted_winner_id?: string
          tournament_id?: string
          user_id?: string
        }
        Relationships: []
      }
      tournament_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          match_id: string | null
          tournament_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          match_id?: string | null
          tournament_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          match_id?: string | null
          tournament_id?: string
          user_id?: string
        }
        Relationships: []
      }
      tournament_reminder_log: {
        Row: {
          id: string
          reminder_window: string
          sent_at: string
          tournament_id: string
          user_id: string
        }
        Insert: {
          id?: string
          reminder_window: string
          sent_at?: string
          tournament_id: string
          user_id: string
        }
        Update: {
          id?: string
          reminder_window?: string
          sent_at?: string
          tournament_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_reminder_log_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_storylines: {
        Row: {
          auto_generated: boolean
          created_at: string
          id: string
          kind: string
          match_id: string | null
          narrative: string
          tournament_id: string
        }
        Insert: {
          auto_generated?: boolean
          created_at?: string
          id?: string
          kind: string
          match_id?: string | null
          narrative: string
          tournament_id: string
        }
        Update: {
          auto_generated?: boolean
          created_at?: string
          id?: string
          kind?: string
          match_id?: string | null
          narrative?: string
          tournament_id?: string
        }
        Relationships: []
      }
      tournament_waitlist: {
        Row: {
          created_at: string
          id: string
          offer_expires_at: string | null
          offered_at: string | null
          position: number
          tournament_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          offer_expires_at?: string | null
          offered_at?: string | null
          position: number
          tournament_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          offer_expires_at?: string | null
          offered_at?: string | null
          position?: number
          tournament_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_waitlist_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          adaptado_pcd: boolean
          archived_at: string | null
          banner_url: string | null
          bracket_type: string
          created_at: string
          created_by: string | null
          default_bo: number
          default_format: string
          description: string | null
          ends_at: string | null
          entry_price: number
          event_state: string
          forum_thread_id: string | null
          hype_score: number
          id: string
          is_community: boolean
          kind: string
          live_current_topic: string | null
          live_started_at: string | null
          live_state: string
          live_stream_platform: string | null
          max_participants: number
          narrative: string | null
          prize: string | null
          prize_badge_id: string | null
          prize_confirmed: boolean
          prize_coupon_id: string | null
          prize_distribution: Json
          prize_game_id: string | null
          prize_pool_amount: number | null
          prize_title: string | null
          prize_types: string[]
          prize_xp_bonus: number
          refund_policy: string | null
          rewards_distributed: boolean
          runner_up_id: string | null
          starts_at: string | null
          status: string
          stream_url: string | null
          third_place_id: string | null
          title: string
          type: string
          unlisted: boolean
          updated_at: string
          verified: boolean
          walkover_minutes: number
          winner_id: string | null
          xp_champion: number
          xp_match_win: number
          xp_signup: number
        }
        Insert: {
          adaptado_pcd?: boolean
          archived_at?: string | null
          banner_url?: string | null
          bracket_type?: string
          created_at?: string
          created_by?: string | null
          default_bo?: number
          default_format?: string
          description?: string | null
          ends_at?: string | null
          entry_price?: number
          event_state?: string
          forum_thread_id?: string | null
          hype_score?: number
          id?: string
          is_community?: boolean
          kind?: string
          live_current_topic?: string | null
          live_started_at?: string | null
          live_state?: string
          live_stream_platform?: string | null
          max_participants?: number
          narrative?: string | null
          prize?: string | null
          prize_badge_id?: string | null
          prize_confirmed?: boolean
          prize_coupon_id?: string | null
          prize_distribution?: Json
          prize_game_id?: string | null
          prize_pool_amount?: number | null
          prize_title?: string | null
          prize_types?: string[]
          prize_xp_bonus?: number
          refund_policy?: string | null
          rewards_distributed?: boolean
          runner_up_id?: string | null
          starts_at?: string | null
          status?: string
          stream_url?: string | null
          third_place_id?: string | null
          title: string
          type?: string
          unlisted?: boolean
          updated_at?: string
          verified?: boolean
          walkover_minutes?: number
          winner_id?: string | null
          xp_champion?: number
          xp_match_win?: number
          xp_signup?: number
        }
        Update: {
          adaptado_pcd?: boolean
          archived_at?: string | null
          banner_url?: string | null
          bracket_type?: string
          created_at?: string
          created_by?: string | null
          default_bo?: number
          default_format?: string
          description?: string | null
          ends_at?: string | null
          entry_price?: number
          event_state?: string
          forum_thread_id?: string | null
          hype_score?: number
          id?: string
          is_community?: boolean
          kind?: string
          live_current_topic?: string | null
          live_started_at?: string | null
          live_state?: string
          live_stream_platform?: string | null
          max_participants?: number
          narrative?: string | null
          prize?: string | null
          prize_badge_id?: string | null
          prize_confirmed?: boolean
          prize_coupon_id?: string | null
          prize_distribution?: Json
          prize_game_id?: string | null
          prize_pool_amount?: number | null
          prize_title?: string | null
          prize_types?: string[]
          prize_xp_bonus?: number
          refund_policy?: string | null
          rewards_distributed?: boolean
          runner_up_id?: string | null
          starts_at?: string | null
          status?: string
          stream_url?: string | null
          third_place_id?: string | null
          title?: string
          type?: string
          unlisted?: boolean
          updated_at?: string
          verified?: boolean
          walkover_minutes?: number
          winner_id?: string | null
          xp_champion?: number
          xp_match_win?: number
          xp_signup?: number
        }
        Relationships: []
      }
      trade_proposals: {
        Row: {
          anuncio_id: string
          checkin_note: string | null
          completed_at: string | null
          created_at: string
          delivered_at: string | null
          dispute_evidence_url: string | null
          dispute_opened_at: string | null
          dispute_reason: string | null
          dispute_status: string | null
          id: string
          offered_item: string
          paid_confirmed_at: string | null
          proposer_confirmed: boolean
          proposer_id: string
          resolution: string | null
          resolved_at: string | null
          seller_confirmed: boolean
          seller_response: string | null
          shipped_at: string | null
          status: string
          tracking_code: string | null
          updated_at: string
        }
        Insert: {
          anuncio_id: string
          checkin_note?: string | null
          completed_at?: string | null
          created_at?: string
          delivered_at?: string | null
          dispute_evidence_url?: string | null
          dispute_opened_at?: string | null
          dispute_reason?: string | null
          dispute_status?: string | null
          id?: string
          offered_item: string
          paid_confirmed_at?: string | null
          proposer_confirmed?: boolean
          proposer_id: string
          resolution?: string | null
          resolved_at?: string | null
          seller_confirmed?: boolean
          seller_response?: string | null
          shipped_at?: string | null
          status?: string
          tracking_code?: string | null
          updated_at?: string
        }
        Update: {
          anuncio_id?: string
          checkin_note?: string | null
          completed_at?: string | null
          created_at?: string
          delivered_at?: string | null
          dispute_evidence_url?: string | null
          dispute_opened_at?: string | null
          dispute_reason?: string | null
          dispute_status?: string | null
          id?: string
          offered_item?: string
          paid_confirmed_at?: string | null
          proposer_confirmed?: boolean
          proposer_id?: string
          resolution?: string | null
          resolved_at?: string | null
          seller_confirmed?: boolean
          seller_response?: string | null
          shipped_at?: string | null
          status?: string
          tracking_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_proposals_anuncio_id_fkey"
            columns: ["anuncio_id"]
            isOneToOne: false
            referencedRelation: "anuncios"
            referencedColumns: ["id"]
          },
        ]
      }
      tutorials_seen: {
        Row: {
          completed: boolean | null
          seen_at: string
          step: number | null
          tutorial_key: string
          user_id: string
        }
        Insert: {
          completed?: boolean | null
          seen_at?: string
          step?: number | null
          tutorial_key: string
          user_id: string
        }
        Update: {
          completed?: boolean | null
          seen_at?: string
          step?: number | null
          tutorial_key?: string
          user_id?: string
        }
        Relationships: []
      }
      user_achievements: {
        Row: {
          achievement_description: string | null
          achievement_name: string
          icon_url: string | null
          id: string
          product_id: string
          rarity: string | null
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_description?: string | null
          achievement_name: string
          icon_url?: string | null
          id?: string
          product_id: string
          rarity?: string | null
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_description?: string | null
          achievement_name?: string
          icon_url?: string | null
          id?: string
          product_id?: string
          rarity?: string | null
          unlocked_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          awarded_at: string
          badge_id: string
          id: string
          user_id: string
        }
        Insert: {
          awarded_at?: string
          badge_id: string
          id?: string
          user_id: string
        }
        Update: {
          awarded_at?: string
          badge_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badge_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      user_cosmetic_loadout: {
        Row: {
          id: string
          reward_id: string | null
          slot: string
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          reward_id?: string | null
          slot: string
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          reward_id?: string | null
          slot?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_cosmetic_loadout_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "game_rewards"
            referencedColumns: ["id"]
          },
        ]
      }
      user_follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: []
      }
      user_game_mutes: {
        Row: {
          created_at: string
          product_id: string
          scope: string
          user_id: string
        }
        Insert: {
          created_at?: string
          product_id: string
          scope?: string
          user_id: string
        }
        Update: {
          created_at?: string
          product_id?: string
          scope?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_game_mutes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      user_game_page_loadout: {
        Row: {
          id: string
          product_id: string
          reward_id: string | null
          slot: string
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          product_id: string
          reward_id?: string | null
          slot: string
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          product_id?: string
          reward_id?: string | null
          slot?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_game_page_loadout_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_game_page_loadout_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "game_rewards"
            referencedColumns: ["id"]
          },
        ]
      }
      user_game_rewards: {
        Row: {
          id: string
          reward_id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          id?: string
          reward_id: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          id?: string
          reward_id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_game_rewards_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "game_rewards"
            referencedColumns: ["id"]
          },
        ]
      }
      user_playtime: {
        Row: {
          hours_played: number
          id: string
          last_played_at: string | null
          platform: string | null
          product_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          hours_played?: number
          id?: string
          last_played_at?: string | null
          platform?: string | null
          product_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          hours_played?: number
          id?: string
          last_played_at?: string | null
          platform?: string | null
          product_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          position: Database["public"]["Enums"]["employee_position"] | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          position?: Database["public"]["Enums"]["employee_position"] | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          position?: Database["public"]["Enums"]["employee_position"] | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_titles: {
        Row: {
          awarded_at: string
          awarded_by: string | null
          id: string
          name: string
          source: string
          tournament_id: string | null
          unlock_rule: Json | null
          user_id: string
        }
        Insert: {
          awarded_at?: string
          awarded_by?: string | null
          id?: string
          name: string
          source?: string
          tournament_id?: string | null
          unlock_rule?: Json | null
          user_id: string
        }
        Update: {
          awarded_at?: string
          awarded_by?: string | null
          id?: string
          name?: string
          source?: string
          tournament_id?: string | null
          unlock_rule?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      user_xp_log: {
        Row: {
          action: string
          awarded_date: string
          created_at: string
          id: string
          reference_id: string | null
          reference_type: string | null
          user_id: string
          xp: number
        }
        Insert: {
          action: string
          awarded_date?: string
          created_at?: string
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          user_id: string
          xp: number
        }
        Update: {
          action?: string
          awarded_date?: string
          created_at?: string
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          user_id?: string
          xp?: number
        }
        Relationships: []
      }
      xp_levels: {
        Row: {
          level: number
          title: string
          xp_required: number
        }
        Insert: {
          level: number
          title: string
          xp_required: number
        }
        Update: {
          level?: number
          title?: string
          xp_required?: number
        }
        Relationships: []
      }
    }
    Views: {
      public_profiles_view: {
        Row: {
          active_title_id: string | null
          avatar_url: string | null
          backlog_note: string | null
          banner_url: string | null
          bio: string | null
          created_at: string | null
          current_game_id: string | null
          display_name: string | null
          favorite_genres: string[] | null
          gamer_personality: string | null
          id: string | null
          monthly_favorites: string[] | null
          profile_cover_url: string | null
          seller_bio: string | null
          theme_color: string | null
          trophy_showcase: string[] | null
          username: string | null
        }
        Insert: {
          active_title_id?: string | null
          avatar_url?: string | null
          backlog_note?: string | null
          banner_url?: string | null
          bio?: string | null
          created_at?: string | null
          current_game_id?: string | null
          display_name?: string | null
          favorite_genres?: string[] | null
          gamer_personality?: string | null
          id?: string | null
          monthly_favorites?: string[] | null
          profile_cover_url?: string | null
          seller_bio?: string | null
          theme_color?: string | null
          trophy_showcase?: string[] | null
          username?: string | null
        }
        Update: {
          active_title_id?: string | null
          avatar_url?: string | null
          backlog_note?: string | null
          banner_url?: string | null
          bio?: string | null
          created_at?: string | null
          current_game_id?: string | null
          display_name?: string | null
          favorite_genres?: string[] | null
          gamer_personality?: string | null
          id?: string | null
          monthly_favorites?: string[] | null
          profile_cover_url?: string | null
          seller_bio?: string | null
          theme_color?: string | null
          trophy_showcase?: string[] | null
          username?: string | null
        }
        Relationships: []
      }
      user_xp_totals: {
        Row: {
          actions_count: number | null
          total_xp: number | null
          user_id: string | null
        }
        Relationships: []
      }
      v_friendships: {
        Row: {
          friend_id: string | null
          since: string | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _detect_stream_platform: { Args: { _url: string }; Returns: string }
      accept_follow_request: {
        Args: { _request_id: string }
        Returns: undefined
      }
      admin_ban_user: {
        Args: { _reason: string; _until?: string; _user_id: string }
        Returns: undefined
      }
      admin_delete_game_media: {
        Args: { _id: string; _kind: string; _reason: string }
        Returns: undefined
      }
      admin_delete_product: {
        Args: { _product_id: string; _reason: string }
        Returns: undefined
      }
      admin_grant_xp: {
        Args: { _reason: string; _user_id: string; _xp: number }
        Returns: undefined
      }
      admin_list_game_media: {
        Args: { _kind: string; _reason: string }
        Returns: {
          created_at: string
          id: string
          images: string[]
          is_spoiler: boolean
          likes_count: number
          product_id: string
          texto: string
          user_id: string
          visibility: string
        }[]
      }
      admin_refund_order: {
        Args: { _motivo: string; _pedido_id: string; _valor: number }
        Returns: string
      }
      admin_revert_action: {
        Args: { _log_id: string; _reason: string }
        Returns: undefined
      }
      admin_review_guardian_link: {
        Args: { _approve: boolean; _id: string; _reason: string }
        Returns: undefined
      }
      admin_set_content_visibility: {
        Args: {
          _id: string
          _kind: string
          _reason: string
          _visibility: string
        }
        Returns: undefined
      }
      admin_set_group_disabled: {
        Args: { _disabled: boolean; _group_id: string; _reason: string }
        Returns: undefined
      }
      age_bracket: { Args: { _birth: string }; Returns: string }
      announce_new_notification_type: {
        Args: {
          _body: string
          _cta_url?: string
          _pref_column: string
          _title: string
        }
        Returns: number
      }
      apply_tournament_penalty: {
        Args: { _skip_next: number; _user_id: string }
        Returns: undefined
      }
      are_mutual_friends: { Args: { _a: string; _b: string }; Returns: boolean }
      are_users_all_mutual_friends: {
        Args: { _users: string[] }
        Returns: boolean
      }
      auto_resolve_stale_disputes: { Args: never; Returns: number }
      auto_reveal_stale_ratings: { Args: never; Returns: number }
      award_tournament_rewards: {
        Args: { _tournament_id: string }
        Returns: undefined
      }
      award_xp: {
        Args: {
          _action: string
          _ref_id?: string
          _ref_type?: string
          _user_id: string
          _xp: number
        }
        Returns: undefined
      }
      calc_tournament_xp: {
        Args: { _max_participants: number }
        Returns: {
          xp_champion: number
          xp_match_win: number
          xp_signup: number
        }[]
      }
      can_equip_title: {
        Args: { _title: string; _user: string }
        Returns: boolean
      }
      can_view_friend_content: {
        Args: { _owner: string; _viewer: string; _visibility: string }
        Returns: boolean
      }
      can_view_full_profile: {
        Args: { _owner: string; _viewer: string }
        Returns: boolean
      }
      can_view_post: {
        Args: {
          _kind: string
          _owner: string
          _row_vis: string
          _viewer: string
        }
        Returns: boolean
      }
      can_view_profile_content: {
        Args: { _kind: string; _owner: string; _viewer: string }
        Returns: boolean
      }
      can_view_scope: {
        Args: { _owner: string; _scope: string; _viewer: string }
        Returns: boolean
      }
      cancel_product_key_reservation: {
        Args: { _key_code: string; _order_id: string }
        Returns: undefined
      }
      check_and_award_badges: { Args: { _user_id: string }; Returns: undefined }
      check_game_reward_unlocks: {
        Args: { _product_id: string; _user_id: string }
        Returns: undefined
      }
      confirm_match_result: {
        Args: { _agree: boolean; _match_id: string }
        Returns: undefined
      }
      confirm_product_key_sale: {
        Args: { _key_code: string; _order_id: string }
        Returns: undefined
      }
      create_order_secure: {
        Args: {
          _client_total: number
          _coupon_code: string
          _installments: number
          _items: Json
          _payment_method: string
        }
        Returns: Json
      }
      delete_my_account: { Args: never; Returns: undefined }
      emit_webhook_event: {
        Args: { _event: string; _payload: Json }
        Returns: undefined
      }
      enqueue_chat_ai_alert: {
        Args: {
          _conversation_id: string
          _kind: string
          _message_id: string
          _minor: string
          _peer: string
          _severity: string
          _snippet: string
        }
        Returns: string
      }
      ensure_match_conversation: {
        Args: { _match_id: string }
        Returns: string
      }
      gen_referral_code: { Args: never; Returns: string }
      get_employee_position: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["employee_position"]
      }
      get_mutual_friends: {
        Args: { _user_id: string }
        Returns: {
          friend_id: string
        }[]
      }
      get_my_profile: {
        Args: never
        Returns: {
          active_title_id: string | null
          adult_transitioned_at: string | null
          age_verified: boolean
          always_hide_spoilers: boolean
          anonymized_at: string | null
          avatar_url: string | null
          backlog_note: string | null
          ban_reason: string | null
          ban_reason_public: string | null
          banned_until: string | null
          banner_url: string | null
          bio: string | null
          birth_date: string | null
          chat_privacy_mode: string
          contact_email: string | null
          cpf: string | null
          created_at: string
          current_game_id: string | null
          data_saver_mode: boolean
          display_name: string | null
          email_notifications: boolean
          favorite_genres: string[] | null
          frequent_seller_at: string | null
          frequent_seller_notice_dismissed_at: string | null
          gamer_personality: string | null
          guardian_user_id: string | null
          hide_adult_content: boolean
          hide_owned_games: boolean
          id: string
          is_frequent_seller: boolean
          is_paused: boolean
          is_private: boolean
          is_verified_account: boolean
          library_visibility: string
          minor_chat_approval_mode: string
          minor_chat_level: string | null
          monthly_favorites: string[] | null
          notifications_snoozed_until: string | null
          onboarded_at: string | null
          opinions_visibility: string
          paused_at: string | null
          personal_theme: Json
          phone: string | null
          privacy_exceptions: string[]
          profile_cover_url: string | null
          push_notifications: boolean
          referral_code: string | null
          referred_by: string | null
          require_follow_approval: boolean
          screenshots_visibility: string
          seller_bio: string | null
          stats_hidden_types: string[]
          theme_color: string | null
          timeline_visibility: string
          tournament_penalty_count: number
          tournament_penalty_skip_remaining: number
          trophy_showcase: string[] | null
          updated_at: string
          username: string | null
          verified_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_product_avg_rating: {
        Args: { p_product_id: string }
        Returns: {
          avg_rating: number
          total_reviews: number
        }[]
      }
      get_profile_admin: {
        Args: { _id: string }
        Returns: {
          active_title_id: string | null
          adult_transitioned_at: string | null
          age_verified: boolean
          always_hide_spoilers: boolean
          anonymized_at: string | null
          avatar_url: string | null
          backlog_note: string | null
          ban_reason: string | null
          ban_reason_public: string | null
          banned_until: string | null
          banner_url: string | null
          bio: string | null
          birth_date: string | null
          chat_privacy_mode: string
          contact_email: string | null
          cpf: string | null
          created_at: string
          current_game_id: string | null
          data_saver_mode: boolean
          display_name: string | null
          email_notifications: boolean
          favorite_genres: string[] | null
          frequent_seller_at: string | null
          frequent_seller_notice_dismissed_at: string | null
          gamer_personality: string | null
          guardian_user_id: string | null
          hide_adult_content: boolean
          hide_owned_games: boolean
          id: string
          is_frequent_seller: boolean
          is_paused: boolean
          is_private: boolean
          is_verified_account: boolean
          library_visibility: string
          minor_chat_approval_mode: string
          minor_chat_level: string | null
          monthly_favorites: string[] | null
          notifications_snoozed_until: string | null
          onboarded_at: string | null
          opinions_visibility: string
          paused_at: string | null
          personal_theme: Json
          phone: string | null
          privacy_exceptions: string[]
          profile_cover_url: string | null
          push_notifications: boolean
          referral_code: string | null
          referred_by: string | null
          require_follow_approval: boolean
          screenshots_visibility: string
          seller_bio: string | null
          stats_hidden_types: string[]
          theme_color: string | null
          timeline_visibility: string
          tournament_penalty_count: number
          tournament_penalty_skip_remaining: number
          trophy_showcase: string[] | null
          updated_at: string
          username: string | null
          verified_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_public_profile: {
        Args: { _uid: string }
        Returns: {
          active_title_id: string
          always_hide_spoilers: boolean
          avatar_url: string
          backlog_note: string
          banned_until: string
          banner_url: string
          bio: string
          can_see_full: boolean
          created_at: string
          current_game_id: string
          display_name: string
          favorite_genres: string[]
          gamer_personality: string
          id: string
          is_private: boolean
          library_visibility: string
          monthly_favorites: string[]
          profile_cover_url: string
          seller_bio: string
          theme_color: string
          trophy_showcase: string[]
          username: string
        }[]
      }
      get_seller_profile: {
        Args: { _user_id: string }
        Returns: {
          admin_suspended: boolean
          admin_suspended_at: string | null
          admin_suspension_reason: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string
          first_listing_at: string | null
          handle: string
          id: string
          is_private: boolean
          rating: number
          total_sales: number
          total_trades: number
          updated_at: string
          user_id: string
          vacation_message: string | null
          vacation_mode: boolean
        }
        SetofOptions: {
          from: "*"
          to: "seller_profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_active_certificate: { Args: { _user_id: string }; Returns: boolean }
      has_position: { Args: { _positions: string[] }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hash_distance: { Args: { _a: string; _b: string }; Returns: number }
      hit_rate_limit: {
        Args: { _key: string; _limit: number; _window_secs: number }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_admin_pleno: { Args: never; Returns: boolean }
      is_atendente: { Args: never; Returns: boolean }
      is_atendimento: { Args: never; Returns: boolean }
      is_close_friend: {
        Args: { _owner: string; _viewer: string }
        Returns: boolean
      }
      is_direcao: { Args: never; Returns: boolean }
      is_group_admin: {
        Args: { _group: string; _user: string }
        Returns: boolean
      }
      is_group_member: {
        Args: { _group: string; _user: string }
        Returns: boolean
      }
      is_group_owner: {
        Args: { _group: string; _user: string }
        Returns: boolean
      }
      is_marketplace_staff: { Args: never; Returns: boolean }
      is_moderador: { Args: never; Returns: boolean }
      is_operacao_estoque: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      is_tournament_mod: { Args: { _t: string; _u: string }; Returns: boolean }
      is_user_banned: { Args: { _user_id: string }; Returns: boolean }
      list_profiles_admin: {
        Args: { _ids: string[] }
        Returns: {
          active_title_id: string | null
          adult_transitioned_at: string | null
          age_verified: boolean
          always_hide_spoilers: boolean
          anonymized_at: string | null
          avatar_url: string | null
          backlog_note: string | null
          ban_reason: string | null
          ban_reason_public: string | null
          banned_until: string | null
          banner_url: string | null
          bio: string | null
          birth_date: string | null
          chat_privacy_mode: string
          contact_email: string | null
          cpf: string | null
          created_at: string
          current_game_id: string | null
          data_saver_mode: boolean
          display_name: string | null
          email_notifications: boolean
          favorite_genres: string[] | null
          frequent_seller_at: string | null
          frequent_seller_notice_dismissed_at: string | null
          gamer_personality: string | null
          guardian_user_id: string | null
          hide_adult_content: boolean
          hide_owned_games: boolean
          id: string
          is_frequent_seller: boolean
          is_paused: boolean
          is_private: boolean
          is_verified_account: boolean
          library_visibility: string
          minor_chat_approval_mode: string
          minor_chat_level: string | null
          monthly_favorites: string[] | null
          notifications_snoozed_until: string | null
          onboarded_at: string | null
          opinions_visibility: string
          paused_at: string | null
          personal_theme: Json
          phone: string | null
          privacy_exceptions: string[]
          profile_cover_url: string | null
          push_notifications: boolean
          referral_code: string | null
          referred_by: string | null
          require_follow_approval: boolean
          screenshots_visibility: string
          seller_bio: string | null
          stats_hidden_types: string[]
          theme_color: string | null
          timeline_visibility: string
          tournament_penalty_count: number
          tournament_penalty_skip_remaining: number
          trophy_showcase: string[] | null
          updated_at: string
          username: string | null
          verified_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      open_trade_dispute: {
        Args: { _evidence_url?: string; _proposal_id: string; _reason: string }
        Returns: undefined
      }
      param_num: { Args: { _default: number; _key: string }; Returns: number }
      pause_my_account: { Args: never; Returns: undefined }
      pode_acessar_conteudo: {
        Args: {
          _classificacao: Database["public"]["Enums"]["classificacao_indicativa"]
          _user: string
        }
        Returns: boolean
      }
      promote_minors_to_adults: { Args: never; Returns: number }
      read_user_library_admin: {
        Args: { _reason: string; _target: string }
        Returns: {
          acquired_at: string
          badge_completed: boolean
          badge_platinum: boolean
          badge_verified_source: string | null
          completed_at: string | null
          hours_played: number
          id: string
          lista_custom: string | null
          mood_tags: string[]
          my_screenshots: string[]
          personal_note: string | null
          personal_rating: number | null
          product_id: string | null
          started_at: string | null
          status: string
          status_updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "biblioteca_usuario"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      record_login: { Args: { _user_agent?: string }; Returns: undefined }
      redeem_referral: { Args: { _code: string }; Returns: Json }
      report_match_result: {
        Args: { _match_id: string; _score_a: number; _score_b: number }
        Returns: undefined
      }
      reserve_product_key: {
        Args: { _order_id: string; _product_id: string }
        Returns: string
      }
      resume_my_account: { Args: never; Returns: undefined }
      review_chat_ai_alert: {
        Args: { _action: string; _id: string; _safe: boolean }
        Returns: undefined
      }
      should_notify: { Args: { _pref: string; _uid: string }; Returns: boolean }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      start_conversation:
        | { Args: { _channel?: string; _other: string }; Returns: Json }
        | {
            Args: {
              p_anuncio_id?: string
              p_channel?: string
              p_target: string
              p_torneio_id?: string
            }
            Returns: {
              conversation_id: string
              status: string
            }[]
          }
      submit_ban_appeal: {
        Args: {
          _description: string
          _reason: Database["public"]["Enums"]["ban_appeal_reason"]
        }
        Returns: string
      }
      submit_guardian_link: {
        Args: {
          _atestado_url: string
          _cpf: string
          _full_name: string
          _phone: string
        }
        Returns: string
      }
      toggle_like: { Args: { p_kind: string; p_target: string }; Returns: Json }
      toggle_message_reaction: {
        Args: { p_emoji: string; p_message_id: string }
        Returns: Json
      }
      tournament_post_live_message: {
        Args: { _kind: string; _text: string; _tournament_id: string }
        Returns: string
      }
      tournament_set_live_state: {
        Args: {
          _state: string
          _stream_url?: string
          _topic?: string
          _tournament_id: string
        }
        Returns: undefined
      }
      validate_and_use_coupon: {
        Args: { _code: string; _order_id: string }
        Returns: string
      }
      validate_discount_price: {
        Args: {
          _preco_atual: number
          _preco_original: number
          _produto_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "user" | "atendente"
      ban_appeal_reason: "nao_concordo" | "conta_invadida"
      ban_appeal_status: "pendente" | "em_analise" | "deferido" | "indeferido"
      certificate_status:
        | "pendente"
        | "ativo"
        | "recusado"
        | "revogado"
        | "expirado"
      classificacao_indicativa: "L" | "10" | "12" | "14" | "16" | "18"
      employee_position:
        | "admin"
        | "gerente"
        | "moderador"
        | "atendente_marketplace"
        | "estoquista"
        | "atendente"
      group_role: "admin" | "member" | "observer"
      notification_kind: "comum" | "destacada" | "especial"
      notification_type:
        | "nova_mensagem"
        | "proposta_aceita"
        | "proposta_recusada"
        | "comentario_review"
        | "certificado_aprovado"
        | "certificado_recusado"
        | "certificado_revogado"
        | "novo_seguidor"
        | "lembrete_torneio"
      order_status:
        | "pending"
        | "confirmed"
        | "processing"
        | "shipped"
        | "delivered"
        | "cancelled"
        | "refunded"
      product_type: "digital" | "physical" | "subscription"
      produto_estado:
        | "ativo"
        | "oculto"
        | "somente_forum"
        | "somente_loja"
        | "descontinuado"
      reward_kind:
        | "avatar_frame"
        | "profile_banner"
        | "profile_accent"
        | "game_card_skin"
        | "game_page_theme"
        | "character_icon"
        | "sticker"
      reward_rarity: "common" | "rare" | "epic" | "legendary" | "mythic"
      social_content_state: "novo" | "visto" | "curtido" | "oculto"
      stock_movement_type: "entrada" | "saida" | "ajuste"
      suggestion_status: "pendente" | "aprovado" | "rejeitado"
      ticket_channel: "mobile" | "web"
      ticket_status:
        | "aberto"
        | "em_andamento"
        | "aguardando_usuario"
        | "resolvido"
        | "fechado"
      tournament_chat_role: "admin" | "member" | "observer"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "user", "atendente"],
      ban_appeal_reason: ["nao_concordo", "conta_invadida"],
      ban_appeal_status: ["pendente", "em_analise", "deferido", "indeferido"],
      certificate_status: [
        "pendente",
        "ativo",
        "recusado",
        "revogado",
        "expirado",
      ],
      classificacao_indicativa: ["L", "10", "12", "14", "16", "18"],
      employee_position: [
        "admin",
        "gerente",
        "moderador",
        "atendente_marketplace",
        "estoquista",
        "atendente",
      ],
      group_role: ["admin", "member", "observer"],
      notification_kind: ["comum", "destacada", "especial"],
      notification_type: [
        "nova_mensagem",
        "proposta_aceita",
        "proposta_recusada",
        "comentario_review",
        "certificado_aprovado",
        "certificado_recusado",
        "certificado_revogado",
        "novo_seguidor",
        "lembrete_torneio",
      ],
      order_status: [
        "pending",
        "confirmed",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
        "refunded",
      ],
      product_type: ["digital", "physical", "subscription"],
      produto_estado: [
        "ativo",
        "oculto",
        "somente_forum",
        "somente_loja",
        "descontinuado",
      ],
      reward_kind: [
        "avatar_frame",
        "profile_banner",
        "profile_accent",
        "game_card_skin",
        "game_page_theme",
        "character_icon",
        "sticker",
      ],
      reward_rarity: ["common", "rare", "epic", "legendary", "mythic"],
      social_content_state: ["novo", "visto", "curtido", "oculto"],
      stock_movement_type: ["entrada", "saida", "ajuste"],
      suggestion_status: ["pendente", "aprovado", "rejeitado"],
      ticket_channel: ["mobile", "web"],
      ticket_status: [
        "aberto",
        "em_andamento",
        "aguardando_usuario",
        "resolvido",
        "fechado",
      ],
      tournament_chat_role: ["admin", "member", "observer"],
    },
  },
} as const
