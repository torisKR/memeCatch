export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          detail: Json | null
          entity_id: string | null
          entity_type: string
          id: number
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          detail?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: never
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          detail?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: never
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tiktok_provider_identities: {
        Row: {
          created_at: string
          internal_email: string
          provider_subject: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          internal_email: string
          provider_subject: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          internal_email?: string
          provider_subject?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      affiliate_product_daily_metrics: {
        Row: {
          clicks: number
          metric_date: string
          product_id: string
        }
        Insert: {
          clicks?: number
          metric_date: string
          product_id: string
        }
        Update: {
          clicks?: number
          metric_date?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_product_daily_metrics_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "affiliate_products"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_products: {
        Row: {
          affiliate_url: string
          commission_label: string
          external_key: string
          first_seen_at: string
          id: string
          image_url: string | null
          is_active: boolean
          last_seen_at: string
          mall_domain: string | null
          mall_icon_url: string | null
          mall_name: string | null
          original_price: number | null
          product_name: string
          provider: string
          sale_price: number | null
          source_rank: number
          source_type: string
          synced_at: string
          theme_code: string | null
          theme_description: string
          theme_title: string
        }
        Insert: {
          affiliate_url: string
          commission_label: string
          external_key: string
          first_seen_at: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          last_seen_at: string
          mall_domain?: string | null
          mall_icon_url?: string | null
          mall_name?: string | null
          original_price?: number | null
          product_name: string
          provider: string
          sale_price?: number | null
          source_rank: number
          source_type: string
          synced_at: string
          theme_code?: string | null
          theme_description: string
          theme_title: string
        }
        Update: {
          affiliate_url?: string
          commission_label?: string
          external_key?: string
          first_seen_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          last_seen_at?: string
          mall_domain?: string | null
          mall_icon_url?: string | null
          mall_name?: string | null
          original_price?: number | null
          product_name?: string
          provider?: string
          sale_price?: number | null
          source_rank?: number
          source_type?: string
          synced_at?: string
          theme_code?: string | null
          theme_description?: string
          theme_title?: string
        }
        Relationships: []
      }
      affiliate_sync_runs: {
        Row: {
          deactivated_count: number
          error_code: string | null
          fetched_count: number
          finished_at: string | null
          id: string
          provider: string
          scheduled_date: string
          source_type: string
          started_at: string
          status: string
          upserted_count: number
        }
        Insert: {
          deactivated_count?: number
          error_code?: string | null
          fetched_count?: number
          finished_at?: string | null
          id?: string
          provider: string
          scheduled_date: string
          source_type: string
          started_at: string
          status: string
          upserted_count?: number
        }
        Update: {
          deactivated_count?: number
          error_code?: string | null
          fetched_count?: number
          finished_at?: string | null
          id?: string
          provider?: string
          scheduled_date?: string
          source_type?: string
          started_at?: string
          status?: string
          upserted_count?: number
        }
        Relationships: []
      }
      billing_identities: {
        Row: {
          created_at: string
          email: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_identities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_orders: {
        Row: {
          confirmed_at: string | null
          created_at: string
          expires_at: string
          id: string
          order_amount: number
          order_currency: string
          payment_asset: string
          payment_network: string
          plan: string
          provider: string
          provider_link_id: string | null
          refund_transaction_id: string | null
          refunded_at: string | null
          request_id: string
          status: string
          transaction_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          order_amount?: number
          order_currency?: string
          payment_asset?: string
          payment_network?: string
          plan?: string
          provider?: string
          provider_link_id?: string | null
          refund_transaction_id?: string | null
          refunded_at?: string | null
          request_id: string
          status?: string
          transaction_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          order_amount?: number
          order_currency?: string
          payment_asset?: string
          payment_network?: string
          plan?: string
          provider?: string
          provider_link_id?: string | null
          refund_transaction_id?: string | null
          refunded_at?: string | null
          request_id?: string
          status?: string
          transaction_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_subscriptions: {
        Row: {
          amount: number
          created_at: string
          currency: string
          current_period_end: string
          customer_email: string
          external_order_id: string
          last_event_at: string
          provider: string
          provider_product_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          current_period_end: string
          customer_email: string
          external_order_id: string
          last_event_at: string
          provider?: string
          provider_product_id?: string | null
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          current_period_end?: string
          customer_email?: string
          external_order_id?: string
          last_event_at?: string
          provider?: string
          provider_product_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_unifi_payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          item_identifier: string
          payment_id: string
          test_mode: boolean
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency: string
          item_identifier: string
          payment_id: string
          test_mode: boolean
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          item_identifier?: string
          payment_id?: string
          test_mode?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_unifi_payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_webhook_events: {
        Row: {
          amount: number | null
          customer_email: string
          event_key: string
          event_type: string
          id: string
          matched_user_id: string | null
          occurred_at: string
          order_id: string
          payload: Json
          processed_at: string | null
          processing_error: string | null
          provider: string
          provider_product_id: string | null
          received_at: string
          status: string
        }
        Insert: {
          amount?: number | null
          customer_email: string
          event_key: string
          event_type: string
          id?: string
          matched_user_id?: string | null
          occurred_at: string
          order_id: string
          payload: Json
          processed_at?: string | null
          processing_error?: string | null
          provider?: string
          provider_product_id?: string | null
          received_at?: string
          status: string
        }
        Update: {
          amount?: number | null
          customer_email?: string
          event_key?: string
          event_type?: string
          id?: string
          matched_user_id?: string | null
          occurred_at?: string
          order_id?: string
          payload?: Json
          processed_at?: string | null
          processing_error?: string | null
          provider?: string
          provider_product_id?: string | null
          received_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_webhook_events_matched_user_id_fkey"
            columns: ["matched_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_approval_records: {
        Row: {
          created_at: string
          decision: string
          evaluation_id: string
          id: string
          note: string | null
          owner_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          decision: string
          evaluation_id: string
          id?: string
          note?: string | null
          owner_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          decision?: string
          evaluation_id?: string
          id?: string
          note?: string | null
          owner_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_approval_records_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: true
            referencedRelation: "brand_fit_evaluations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_approval_records_evaluation_owner_fkey"
            columns: ["evaluation_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "brand_fit_evaluations"
            referencedColumns: ["id", "owner_id"]
          },
          {
            foreignKeyName: "brand_approval_records_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_approval_records_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "brand_workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_approval_records_workspace_owner_fkey"
            columns: ["workspace_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "brand_workspaces"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      brand_fit_evaluations: {
        Row: {
          created_at: string
          fit_score: number
          id: string
          matched_forbidden_expressions: string[]
          meme_name: string
          meme_path: string | null
          owner_id: string
          proposed_copy: string
          rationale: string
          risk_level: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          fit_score: number
          id?: string
          matched_forbidden_expressions?: string[]
          meme_name: string
          meme_path?: string | null
          owner_id: string
          proposed_copy: string
          rationale: string
          risk_level: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          fit_score?: number
          id?: string
          matched_forbidden_expressions?: string[]
          meme_name?: string
          meme_path?: string | null
          owner_id?: string
          proposed_copy?: string
          rationale?: string
          risk_level?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_fit_evaluations_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_fit_evaluations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "brand_workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_fit_evaluations_workspace_owner_fkey"
            columns: ["workspace_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "brand_workspaces"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      brand_workspaces: {
        Row: {
          brand_context: string
          brand_name: string
          brand_tone: string
          created_at: string
          forbidden_expressions: string[]
          id: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          brand_context: string
          brand_name: string
          brand_tone: string
          created_at?: string
          forbidden_expressions?: string[]
          id?: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          brand_context?: string
          brand_name?: string
          brand_tone?: string
          created_at?: string
          forbidden_expressions?: string[]
          id?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_workspaces_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_post_likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_post_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: {
          body: string
          comment_count: number
          created_at: string
          id: string
          like_count: number
          meme_id: string | null
          status: string
          title: string
          user_id: string
        }
        Insert: {
          body: string
          comment_count?: number
          created_at?: string
          id?: string
          like_count?: number
          meme_id?: string | null
          status?: string
          title: string
          user_id: string
        }
        Update: {
          body?: string
          comment_count?: number
          created_at?: string
          id?: string
          like_count?: number
          meme_id?: string | null
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_posts_meme_id_fkey"
            columns: ["meme_id"]
            isOneToOne: false
            referencedRelation: "memes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      connector_health: {
        Row: {
          connector_key: string
          consecutive_failures: number
          cursor_state: Json
          last_checked_at: string
          last_error: string | null
          last_success_at: string | null
          latency_ms: number | null
          status: string
          updated_at: string
        }
        Insert: {
          connector_key: string
          consecutive_failures?: number
          cursor_state?: Json
          last_checked_at: string
          last_error?: string | null
          last_success_at?: string | null
          latency_ms?: number | null
          status: string
          updated_at?: string
        }
        Update: {
          connector_key?: string
          consecutive_failures?: number
          cursor_state?: Json
          last_checked_at?: string
          last_error?: string | null
          last_success_at?: string | null
          latency_ms?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      discussion_reactions: {
        Row: {
          discussion_id: string
          reaction: Database["public"]["Enums"]["reaction_type"]
          user_id: string
        }
        Insert: {
          discussion_id: string
          reaction: Database["public"]["Enums"]["reaction_type"]
          user_id: string
        }
        Update: {
          discussion_id?: string
          reaction?: Database["public"]["Enums"]["reaction_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discussion_reactions_discussion_id_fkey"
            columns: ["discussion_id"]
            isOneToOne: false
            referencedRelation: "discussions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discussion_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      discussions: {
        Row: {
          body: string
          created_at: string
          id: string
          meme_id: string
          parent_id: string | null
          report_count: number
          status: Database["public"]["Enums"]["discussion_status"]
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          meme_id: string
          parent_id?: string | null
          report_count?: number
          status?: Database["public"]["Enums"]["discussion_status"]
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          meme_id?: string
          parent_id?: string | null
          report_count?: number
          status?: Database["public"]["Enums"]["discussion_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discussions_meme_id_fkey"
            columns: ["meme_id"]
            isOneToOne: false
            referencedRelation: "memes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discussions_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "discussions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discussions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      external_signals: {
        Row: {
          canonical_url: string | null
          collected_at: string
          connector_key: string
          first_seen_at: string
          hashtags: string[]
          id: string
          ingestion_version: number
          korean_relevance: number | null
          language: string | null
          language_confidence: number | null
          last_seen_at: string
          metrics_json: Json
          normalized_text_hash: string | null
          observed_at: string
          payload: Json
          platform: string
          platform_content_id: string
          published_at: string | null
          query_seed: string | null
          raw_expires_at: string
          retention_until: string
          rights_mode: string
          signal_kind: string
          text: string | null
        }
        Insert: {
          canonical_url?: string | null
          collected_at?: string
          connector_key: string
          first_seen_at: string
          hashtags?: string[]
          id?: string
          ingestion_version: number
          korean_relevance?: number | null
          language?: string | null
          language_confidence?: number | null
          last_seen_at: string
          metrics_json?: Json
          normalized_text_hash?: string | null
          observed_at: string
          payload?: Json
          platform: string
          platform_content_id: string
          published_at?: string | null
          query_seed?: string | null
          raw_expires_at?: string
          retention_until?: string
          rights_mode?: string
          signal_kind: string
          text?: string | null
        }
        Update: {
          canonical_url?: string | null
          collected_at?: string
          connector_key?: string
          first_seen_at?: string
          hashtags?: string[]
          id?: string
          ingestion_version?: number
          korean_relevance?: number | null
          language?: string | null
          language_confidence?: number | null
          last_seen_at?: string
          metrics_json?: Json
          normalized_text_hash?: string | null
          observed_at?: string
          payload?: Json
          platform?: string
          platform_content_id?: string
          published_at?: string | null
          query_seed?: string | null
          raw_expires_at?: string
          retention_until?: string
          rights_mode?: string
          signal_kind?: string
          text?: string | null
        }
        Relationships: []
      }
      generation_votes: {
        Row: {
          age_group: string
          created_at: string
          meme_id: string
          user_id: string
          vote: string
        }
        Insert: {
          age_group: string
          created_at?: string
          meme_id: string
          user_id: string
          vote: string
        }
        Update: {
          age_group?: string
          created_at?: string
          meme_id?: string
          user_id?: string
          vote?: string
        }
        Relationships: [
          {
            foreignKeyName: "generation_votes_meme_id_fkey"
            columns: ["meme_id"]
            isOneToOne: false
            referencedRelation: "memes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generation_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      growth_english_pilot_landings: {
        Row: {
          assigned_by: string | null
          created_at: string
          meme_id: string | null
          operator_note: string
          published_at: string | null
          slot: number
          status: string
          updated_at: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          meme_id?: string | null
          operator_note?: string
          published_at?: string | null
          slot: number
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          meme_id?: string | null
          operator_note?: string
          published_at?: string | null
          slot?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "growth_english_pilot_landings_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "growth_english_pilot_landings_meme_id_fkey"
            columns: ["meme_id"]
            isOneToOne: true
            referencedRelation: "memes"
            referencedColumns: ["id"]
          },
        ]
      }
      growth_events: {
        Row: {
          created_at: string
          dedupe_key: string
          event_name: string
          format: string | null
          id: string
          locale: string | null
          meme_id: string | null
          metadata: Json
          occurred_at: string
          order_id: string | null
          path: string | null
          session_id: string | null
          source: string
          surface: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          dedupe_key: string
          event_name: string
          format?: string | null
          id?: string
          locale?: string | null
          meme_id?: string | null
          metadata?: Json
          occurred_at?: string
          order_id?: string | null
          path?: string | null
          session_id?: string | null
          source: string
          surface?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          dedupe_key?: string
          event_name?: string
          format?: string | null
          id?: string
          locale?: string | null
          meme_id?: string | null
          metadata?: Json
          occurred_at?: string
          order_id?: string | null
          path?: string | null
          session_id?: string | null
          source?: string
          surface?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "growth_events_meme_id_fkey"
            columns: ["meme_id"]
            isOneToOne: false
            referencedRelation: "memes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "growth_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "billing_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "growth_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      growth_funnel_baselines: {
        Row: {
          captured_at: string
          counts: Json
          coverage_start: string | null
          definition_version: number
          id: string
          is_complete: boolean
          period_end: string
          period_start: string
          source: string
        }
        Insert: {
          captured_at?: string
          counts: Json
          coverage_start?: string | null
          definition_version?: number
          id?: string
          is_complete: boolean
          period_end: string
          period_start: string
          source?: string
        }
        Update: {
          captured_at?: string
          counts?: Json
          coverage_start?: string | null
          definition_version?: number
          id?: string
          is_complete?: boolean
          period_end?: string
          period_start?: string
          source?: string
        }
        Relationships: []
      }
      growth_pilot_interviews: {
        Row: {
          conducted_by: string
          created_at: string
          evidence_url: string | null
          id: string
          interviewed_at: string
          market: string
          participant_reference: string
          segment: string
          summary: string
        }
        Insert: {
          conducted_by: string
          created_at?: string
          evidence_url?: string | null
          id?: string
          interviewed_at: string
          market: string
          participant_reference: string
          segment: string
          summary: string
        }
        Update: {
          conducted_by?: string
          created_at?: string
          evidence_url?: string | null
          id?: string
          interviewed_at?: string
          market?: string
          participant_reference?: string
          segment?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "growth_pilot_interviews_conducted_by_fkey"
            columns: ["conducted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_runs: {
        Row: {
          detail: Json | null
          finished_at: string | null
          id: number
          job_name: string
          ok: boolean | null
          started_at: string
        }
        Insert: {
          detail?: Json | null
          finished_at?: string | null
          id?: never
          job_name: string
          ok?: boolean | null
          started_at?: string
        }
        Update: {
          detail?: Json | null
          finished_at?: string | null
          id?: never
          job_name?: string
          ok?: boolean | null
          started_at?: string
        }
        Relationships: []
      }
      media_sources: {
        Row: {
          canonical_url: string
          channel_id: string | null
          channel_name: string | null
          created_at: string
          duration_seconds: number | null
          embeddable: boolean | null
          external_id: string | null
          id: string
          last_checked_at: string | null
          license_code: string | null
          made_for_kids: boolean | null
          metadata_expires_at: string | null
          metadata_refreshed_at: string | null
          platform: string
          platform_published_at: string | null
          public_status: string | null
          removed_at: string | null
          thumbnail_url: string | null
          title: string | null
        }
        Insert: {
          canonical_url: string
          channel_id?: string | null
          channel_name?: string | null
          created_at?: string
          duration_seconds?: number | null
          embeddable?: boolean | null
          external_id?: string | null
          id?: string
          last_checked_at?: string | null
          license_code?: string | null
          made_for_kids?: boolean | null
          metadata_expires_at?: string | null
          metadata_refreshed_at?: string | null
          platform: string
          platform_published_at?: string | null
          public_status?: string | null
          removed_at?: string | null
          thumbnail_url?: string | null
          title?: string | null
        }
        Update: {
          canonical_url?: string
          channel_id?: string | null
          channel_name?: string | null
          created_at?: string
          duration_seconds?: number | null
          embeddable?: boolean | null
          external_id?: string | null
          id?: string
          last_checked_at?: string | null
          license_code?: string | null
          made_for_kids?: boolean | null
          metadata_expires_at?: string | null
          metadata_refreshed_at?: string | null
          platform?: string
          platform_published_at?: string | null
          public_status?: string | null
          removed_at?: string | null
          thumbnail_url?: string | null
          title?: string | null
        }
        Relationships: []
      }
      source_ingestions: {
        Row: {
          created_at: string
          error_code: string | null
          error_message: string | null
          id: string
          processing_rights_mode: string
          source_id: string
          status: string
          submitted_by: string | null
          target_meme_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          processing_rights_mode: string
          source_id: string
          status: string
          submitted_by?: string | null
          target_meme_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          processing_rights_mode?: string
          source_id?: string
          status?: string
          submitted_by?: string | null
          target_meme_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_ingestions_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "media_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_ingestions_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_ingestions_target_meme_id_fkey"
            columns: ["target_meme_id"]
            isOneToOne: false
            referencedRelation: "memes"
            referencedColumns: ["id"]
          },
        ]
      }
      meme_claims: {
        Row: {
          claim_text: string
          claim_type: string
          confidence: string
          created_at: string
          id: string
          meme_id: string
          source_id: string | null
          verified: boolean
        }
        Insert: {
          claim_text: string
          claim_type: string
          confidence?: string
          created_at?: string
          id?: string
          meme_id: string
          source_id?: string | null
          verified?: boolean
        }
        Update: {
          claim_text?: string
          claim_type?: string
          confidence?: string
          created_at?: string
          id?: string
          meme_id?: string
          source_id?: string | null
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "meme_claims_meme_id_fkey"
            columns: ["meme_id"]
            isOneToOne: false
            referencedRelation: "memes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meme_claims_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "media_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      meme_contents: {
        Row: {
          availability: Database["public"]["Enums"]["availability_status"]
          caption: string | null
          content_id: string | null
          created_at: string
          id: string
          is_representative: boolean
          meme_id: string
          moderation_status: Database["public"]["Enums"]["submission_status"]
          platform: string | null
          thumbnail_url: string | null
          type: Database["public"]["Enums"]["media_type"]
          url: string | null
        }
        Insert: {
          availability?: Database["public"]["Enums"]["availability_status"]
          caption?: string | null
          content_id?: string | null
          created_at?: string
          id?: string
          is_representative?: boolean
          meme_id: string
          moderation_status?: Database["public"]["Enums"]["submission_status"]
          platform?: string | null
          thumbnail_url?: string | null
          type: Database["public"]["Enums"]["media_type"]
          url?: string | null
        }
        Update: {
          availability?: Database["public"]["Enums"]["availability_status"]
          caption?: string | null
          content_id?: string | null
          created_at?: string
          id?: string
          is_representative?: boolean
          meme_id?: string
          moderation_status?: Database["public"]["Enums"]["submission_status"]
          platform?: string | null
          thumbnail_url?: string | null
          type?: Database["public"]["Enums"]["media_type"]
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meme_contents_meme_id_fkey"
            columns: ["meme_id"]
            isOneToOne: false
            referencedRelation: "memes"
            referencedColumns: ["id"]
          },
        ]
      }
      meme_market_profiles: {
        Row: {
          caution: string | null
          created_at: string
          evidence_source_id: string | null
          id: string
          language_tag: string
          local_aliases: string[]
          local_title: string
          market_code: string
          meme_id: string
          review_state: string
          reviewed_at: string | null
          reviewed_by: string | null
          role: string
          updated_at: string
          usage_note: string | null
        }
        Insert: {
          caution?: string | null
          created_at?: string
          evidence_source_id?: string | null
          id?: string
          language_tag: string
          local_aliases?: string[]
          local_title: string
          market_code: string
          meme_id: string
          review_state?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          role: string
          updated_at?: string
          usage_note?: string | null
        }
        Update: {
          caution?: string | null
          created_at?: string
          evidence_source_id?: string | null
          id?: string
          language_tag?: string
          local_aliases?: string[]
          local_title?: string
          market_code?: string
          meme_id?: string
          review_state?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          role?: string
          updated_at?: string
          usage_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meme_market_profiles_evidence_source_id_fkey"
            columns: ["evidence_source_id"]
            isOneToOne: false
            referencedRelation: "meme_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meme_market_profiles_meme_id_fkey"
            columns: ["meme_id"]
            isOneToOne: false
            referencedRelation: "memes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meme_market_profiles_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meme_media: {
        Row: {
          created_at: string
          meme_id: string
          review_state: string
          reviewed_at: string | null
          reviewer_note: string | null
          rights_basis: string
          source_id: string
          source_role: string
        }
        Insert: {
          created_at?: string
          meme_id: string
          review_state?: string
          reviewed_at?: string | null
          reviewer_note?: string | null
          rights_basis?: string
          source_id: string
          source_role?: string
        }
        Update: {
          created_at?: string
          meme_id?: string
          review_state?: string
          reviewed_at?: string | null
          reviewer_note?: string | null
          rights_basis?: string
          source_id?: string
          source_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "meme_media_meme_id_fkey"
            columns: ["meme_id"]
            isOneToOne: false
            referencedRelation: "memes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meme_media_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "media_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      meme_public_change_events: {
        Row: {
          created_at: string
          id: number
          kind: string
          locale: string | null
          meme_id: string
          source_updated_at: string
        }
        Insert: {
          created_at?: string
          id?: never
          kind: string
          locale?: string | null
          meme_id: string
          source_updated_at?: string
        }
        Update: {
          created_at?: string
          id?: never
          kind?: string
          locale?: string | null
          meme_id?: string
          source_updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meme_public_change_events_meme_id_fkey"
            columns: ["meme_id"]
            isOneToOne: false
            referencedRelation: "memes"
            referencedColumns: ["id"]
          },
        ]
      }
      meme_reactions: {
        Row: {
          created_at: string
          meme_id: string
          reaction: Database["public"]["Enums"]["reaction_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          meme_id: string
          reaction: Database["public"]["Enums"]["reaction_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          meme_id?: string
          reaction?: Database["public"]["Enums"]["reaction_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meme_reactions_meme_id_fkey"
            columns: ["meme_id"]
            isOneToOne: false
            referencedRelation: "memes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meme_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meme_revisions: {
        Row: {
          created_at: string
          editor_id: string | null
          id: string
          meme_id: string
          note: string | null
          snapshot: Json
          status: Database["public"]["Enums"]["revision_status"]
        }
        Insert: {
          created_at?: string
          editor_id?: string | null
          id?: string
          meme_id: string
          note?: string | null
          snapshot: Json
          status?: Database["public"]["Enums"]["revision_status"]
        }
        Update: {
          created_at?: string
          editor_id?: string | null
          id?: string
          meme_id?: string
          note?: string | null
          snapshot?: Json
          status?: Database["public"]["Enums"]["revision_status"]
        }
        Relationships: [
          {
            foreignKeyName: "meme_revisions_editor_id_fkey"
            columns: ["editor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meme_revisions_meme_id_fkey"
            columns: ["meme_id"]
            isOneToOne: false
            referencedRelation: "memes"
            referencedColumns: ["id"]
          },
        ]
      }
      meme_signal_links: {
        Row: {
          created_at: string
          match_confidence: number
          match_method: string
          meme_id: string
          review_state: string
          reviewed_at: string | null
          reviewed_by: string | null
          signal_id: string
        }
        Insert: {
          created_at?: string
          match_confidence: number
          match_method: string
          meme_id: string
          review_state?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          signal_id: string
        }
        Update: {
          created_at?: string
          match_confidence?: number
          match_method?: string
          meme_id?: string
          review_state?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          signal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meme_signal_links_meme_id_fkey"
            columns: ["meme_id"]
            isOneToOne: false
            referencedRelation: "memes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meme_signal_links_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meme_signal_links_signal_id_fkey"
            columns: ["signal_id"]
            isOneToOne: false
            referencedRelation: "external_signals"
            referencedColumns: ["id"]
          },
        ]
      }
      meme_sources: {
        Row: {
          captured_at: string
          copyright_status: Database["public"]["Enums"]["copyright_status"]
          creator_name: string | null
          id: string
          meme_id: string
          platform: string
          rights_basis: string | null
          source_role: string | null
          source_url: string | null
          title: string | null
        }
        Insert: {
          captured_at?: string
          copyright_status?: Database["public"]["Enums"]["copyright_status"]
          creator_name?: string | null
          id?: string
          meme_id: string
          platform: string
          rights_basis?: string | null
          source_role?: string | null
          source_url?: string | null
          title?: string | null
        }
        Update: {
          captured_at?: string
          copyright_status?: Database["public"]["Enums"]["copyright_status"]
          creator_name?: string | null
          id?: string
          meme_id?: string
          platform?: string
          rights_basis?: string | null
          source_role?: string | null
          source_url?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meme_sources_meme_id_fkey"
            columns: ["meme_id"]
            isOneToOne: false
            referencedRelation: "memes"
            referencedColumns: ["id"]
          },
        ]
      }
      meme_state_history: {
        Row: {
          changed_at: string
          confidence: number
          heat_score: number
          id: number
          meme_id: string
          new_state: string
          observation_id: string | null
          old_state: string
          reason: string
        }
        Insert: {
          changed_at?: string
          confidence: number
          heat_score: number
          id?: never
          meme_id: string
          new_state: string
          observation_id?: string | null
          old_state: string
          reason: string
        }
        Update: {
          changed_at?: string
          confidence?: number
          heat_score?: number
          id?: never
          meme_id?: string
          new_state?: string
          observation_id?: string | null
          old_state?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "meme_state_history_meme_id_fkey"
            columns: ["meme_id"]
            isOneToOne: false
            referencedRelation: "memes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meme_state_history_observation_id_fkey"
            columns: ["observation_id"]
            isOneToOne: false
            referencedRelation: "radar_trend_observations"
            referencedColumns: ["id"]
          },
        ]
      }
      meme_submissions: {
        Row: {
          attachment_path: string | null
          claimed_by: string | null
          created_at: string
          description: string
          dup_of: string | null
          guess_reason: string | null
          id: string
          name: string
          reject_reason: string | null
          seen_at: string | null
          source_url: string | null
          status: Database["public"]["Enums"]["submission_status"]
          submitter_id: string
          tags: string[]
          updated_at: string
        }
        Insert: {
          attachment_path?: string | null
          claimed_by?: string | null
          created_at?: string
          description?: string
          dup_of?: string | null
          guess_reason?: string | null
          id?: string
          name: string
          reject_reason?: string | null
          seen_at?: string | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["submission_status"]
          submitter_id: string
          tags?: string[]
          updated_at?: string
        }
        Update: {
          attachment_path?: string | null
          claimed_by?: string | null
          created_at?: string
          description?: string
          dup_of?: string | null
          guess_reason?: string | null
          id?: string
          name?: string
          reject_reason?: string | null
          seen_at?: string | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["submission_status"]
          submitter_id?: string
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meme_submissions_claimed_by_fkey"
            columns: ["claimed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meme_submissions_dup_of_fkey"
            columns: ["dup_of"]
            isOneToOne: false
            referencedRelation: "memes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meme_submissions_submitter_id_fkey"
            columns: ["submitter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meme_tags_map: {
        Row: {
          meme_id: string
          tag_id: string
        }
        Insert: {
          meme_id: string
          tag_id: string
        }
        Update: {
          meme_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meme_tags_map_meme_id_fkey"
            columns: ["meme_id"]
            isOneToOne: false
            referencedRelation: "memes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meme_tags_map_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      meme_translations: {
        Row: {
          aliases: string[]
          caution: string | null
          created_at: string
          description: string
          locale: string
          localized_slug: string
          meme_id: string
          model: string
          origin: string
          prompt_version: number
          provider: string
          reviewed_at: string | null
          reviewed_by: string | null
          source_updated_at: string
          status: string
          summary: string
          title: string
          translated_at: string
          updated_at: string
          usage_examples: Json | null
          usage_note: string | null
        }
        Insert: {
          aliases?: string[]
          caution?: string | null
          created_at?: string
          description?: string
          locale: string
          localized_slug: string
          meme_id: string
          model: string
          origin?: string
          prompt_version?: number
          provider: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_updated_at: string
          status?: string
          summary: string
          title: string
          translated_at?: string
          updated_at?: string
          usage_examples?: Json | null
          usage_note?: string | null
        }
        Update: {
          aliases?: string[]
          caution?: string | null
          created_at?: string
          description?: string
          locale?: string
          localized_slug?: string
          meme_id?: string
          model?: string
          origin?: string
          prompt_version?: number
          provider?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_updated_at?: string
          status?: string
          summary?: string
          title?: string
          translated_at?: string
          updated_at?: string
          usage_examples?: Json | null
          usage_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meme_translations_meme_id_fkey"
            columns: ["meme_id"]
            isOneToOne: false
            referencedRelation: "memes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meme_translations_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meme_trend_metrics: {
        Row: {
          comments: number
          date: string
          meme_id: string
          reactions: number
          reports: number
          saves: number
          shares: number
          submissions: number
          trend_score: number
          views: number
        }
        Insert: {
          comments?: number
          date: string
          meme_id: string
          reactions?: number
          reports?: number
          saves?: number
          shares?: number
          submissions?: number
          trend_score?: number
          views?: number
        }
        Update: {
          comments?: number
          date?: string
          meme_id?: string
          reactions?: number
          reports?: number
          saves?: number
          shares?: number
          submissions?: number
          trend_score?: number
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "meme_trend_metrics_meme_id_fkey"
            columns: ["meme_id"]
            isOneToOne: false
            referencedRelation: "memes"
            referencedColumns: ["id"]
          },
        ]
      }
      meme_variant_links: {
        Row: {
          created_at: string
          evidence_source_id: string | null
          id: string
          relation_kind: string
          review_state: string
          reviewed_at: string | null
          reviewed_by: string | null
          source_meme_id: string
          target_meme_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          evidence_source_id?: string | null
          id?: string
          relation_kind: string
          review_state?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_meme_id: string
          target_meme_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          evidence_source_id?: string | null
          id?: string
          relation_kind?: string
          review_state?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_meme_id?: string
          target_meme_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meme_variant_links_evidence_source_id_fkey"
            columns: ["evidence_source_id"]
            isOneToOne: false
            referencedRelation: "meme_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meme_variant_links_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meme_variant_links_source_meme_id_fkey"
            columns: ["source_meme_id"]
            isOneToOne: false
            referencedRelation: "memes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meme_variant_links_target_meme_id_fkey"
            columns: ["target_meme_id"]
            isOneToOne: false
            referencedRelation: "memes"
            referencedColumns: ["id"]
          },
        ]
      }
      memes: {
        Row: {
          aliases: string[]
          category: Database["public"]["Enums"]["meme_category"]
          caution: string | null
          created_at: string
          description: string
          difficulty: Database["public"]["Enums"]["meme_difficulty"]
          doc_class: string
          era_type: string | null
          house_rights_attested_at: string | null
          id: string
          korea_viral_year: number | null
          lifecycle_status: Database["public"]["Enums"]["lifecycle_status"]
          media_type: Database["public"]["Enums"]["media_type"]
          meme_first_seen_year: number | null
          moderation_status: Database["public"]["Enums"]["moderation_status"]
          origin: string
          origin_kind: string
          origin_year: number | null
          published_at: string | null
          revival_years: number[]
          safety_level: Database["public"]["Enums"]["safety_level"]
          safety_reviewed_at: string | null
          sentiment: Database["public"]["Enums"]["meme_sentiment"]
          short_id: string
          slug: string
          source_work_year: number | null
          submitted_by: string | null
          summary: string
          title: string
          title_chosung: string | null
          trend_score: number
          updated_at: string
          usage_context: Json
          usage_examples: Json | null
          usage_note: string | null
          year_precision: string
        }
        Insert: {
          aliases?: string[]
          category?: Database["public"]["Enums"]["meme_category"]
          caution?: string | null
          created_at?: string
          description?: string
          difficulty?: Database["public"]["Enums"]["meme_difficulty"]
          doc_class?: string
          era_type?: string | null
          house_rights_attested_at?: string | null
          id?: string
          korea_viral_year?: number | null
          lifecycle_status?: Database["public"]["Enums"]["lifecycle_status"]
          media_type?: Database["public"]["Enums"]["media_type"]
          meme_first_seen_year?: number | null
          moderation_status?: Database["public"]["Enums"]["moderation_status"]
          origin?: string
          origin_kind?: string
          origin_year?: number | null
          published_at?: string | null
          revival_years?: number[]
          safety_level?: Database["public"]["Enums"]["safety_level"]
          safety_reviewed_at?: string | null
          sentiment?: Database["public"]["Enums"]["meme_sentiment"]
          short_id?: string
          slug: string
          source_work_year?: number | null
          submitted_by?: string | null
          summary?: string
          title: string
          title_chosung?: string | null
          trend_score?: number
          updated_at?: string
          usage_context?: Json
          usage_examples?: Json | null
          usage_note?: string | null
          year_precision?: string
        }
        Update: {
          aliases?: string[]
          category?: Database["public"]["Enums"]["meme_category"]
          caution?: string | null
          created_at?: string
          description?: string
          difficulty?: Database["public"]["Enums"]["meme_difficulty"]
          doc_class?: string
          era_type?: string | null
          house_rights_attested_at?: string | null
          id?: string
          korea_viral_year?: number | null
          lifecycle_status?: Database["public"]["Enums"]["lifecycle_status"]
          media_type?: Database["public"]["Enums"]["media_type"]
          meme_first_seen_year?: number | null
          moderation_status?: Database["public"]["Enums"]["moderation_status"]
          origin?: string
          origin_kind?: string
          origin_year?: number | null
          published_at?: string | null
          revival_years?: number[]
          safety_level?: Database["public"]["Enums"]["safety_level"]
          safety_reviewed_at?: string | null
          sentiment?: Database["public"]["Enums"]["meme_sentiment"]
          short_id?: string
          slug?: string
          source_work_year?: number | null
          submitted_by?: string | null
          summary?: string
          title?: string
          title_chosung?: string | null
          trend_score?: number
          updated_at?: string
          usage_context?: Json
          usage_examples?: Json | null
          usage_note?: string | null
          year_precision?: string
        }
        Relationships: [
          {
            foreignKeyName: "memes_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_outbox: {
        Row: {
          attempt_count: number
          available_at: string
          channel: string
          claim_token: string | null
          claimed_at: string | null
          created_at: string
          dedupe_key: string
          finished_at: string | null
          id: string
          last_error: string | null
          max_attempts: number
          meme_id: string | null
          payload: Json
          retention_until: string
          status: string
          topic: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          attempt_count?: number
          available_at?: string
          channel: string
          claim_token?: string | null
          claimed_at?: string | null
          created_at?: string
          dedupe_key: string
          finished_at?: string | null
          id?: string
          last_error?: string | null
          max_attempts?: number
          meme_id?: string | null
          payload: Json
          retention_until?: string
          status?: string
          topic: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          attempt_count?: number
          available_at?: string
          channel?: string
          claim_token?: string | null
          claimed_at?: string | null
          created_at?: string
          dedupe_key?: string
          finished_at?: string | null
          id?: string
          last_error?: string | null
          max_attempts?: number
          meme_id?: string | null
          payload?: Json
          retention_until?: string
          status?: string
          topic?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_outbox_meme_id_fkey"
            columns: ["meme_id"]
            isOneToOne: false
            referencedRelation: "memes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_outbox_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plus_digest_deliveries: {
        Row: {
          claimed_at: string | null
          created_at: string
          delivery_date: string
          error_code: string | null
          id: string
          locale: string
          provider_message_id: string | null
          sent_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          claimed_at?: string | null
          created_at?: string
          delivery_date: string
          error_code?: string | null
          id?: string
          locale: string
          provider_message_id?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          claimed_at?: string | null
          created_at?: string
          delivery_date?: string
          error_code?: string | null
          id?: string
          locale?: string
          provider_message_id?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plus_digest_deliveries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plus_digest_preferences: {
        Row: {
          enabled: boolean
          locale: string
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          enabled?: boolean
          locale?: string
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          enabled?: boolean
          locale?: string
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plus_digest_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plus_expiry_reminder_deliveries: {
        Row: {
          claimed_at: string | null
          created_at: string
          current_period_end: string
          error_code: string | null
          id: string
          locale: string
          provider_message_id: string | null
          reminder_days: number
          sent_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          claimed_at?: string | null
          created_at?: string
          current_period_end: string
          error_code?: string | null
          id?: string
          locale?: string
          provider_message_id?: string | null
          reminder_days: number
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          claimed_at?: string | null
          created_at?: string
          current_period_end?: string
          error_code?: string | null
          id?: string
          locale?: string
          provider_message_id?: string | null
          reminder_days?: number
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plus_expiry_reminder_deliveries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plus_global_daily_challenge_completions: {
        Row: {
          challenge_date: string
          completed_at: string
          locale: string
          user_id: string
        }
        Insert: {
          challenge_date: string
          completed_at?: string
          locale: string
          user_id: string
        }
        Update: {
          challenge_date?: string
          completed_at?: string
          locale?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plus_global_daily_challenge_completions_challenge_date_fkey"
            columns: ["challenge_date"]
            isOneToOne: false
            referencedRelation: "plus_global_daily_challenges"
            referencedColumns: ["challenge_date"]
          },
          {
            foreignKeyName: "plus_global_daily_challenge_completions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plus_global_daily_challenges: {
        Row: {
          candidate_meme_ids: string[]
          challenge_date: string
          created_at: string
        }
        Insert: {
          candidate_meme_ids: string[]
          challenge_date: string
          created_at?: string
        }
        Update: {
          candidate_meme_ids?: string[]
          challenge_date?: string
          created_at?: string
        }
        Relationships: []
      }
      plus_meme_use_completions: {
        Row: {
          completed_at: string
          completion_date: string
          meme_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          completion_date: string
          meme_id: string
          user_id: string
        }
        Update: {
          completed_at?: string
          completion_date?: string
          meme_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plus_meme_use_completions_meme_id_fkey"
            columns: ["meme_id"]
            isOneToOne: false
            referencedRelation: "memes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plus_meme_use_completions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plus_meme_use_receipts: {
        Row: {
          artifact_kind: string
          channel: string
          completion_date: string
          created_at: string
          id: string
          locale: string
          meme_id: string
          mode: string
          performance_note: string | null
          performance_rating: string | null
          private_note: string | null
          result_url: string | null
          source_updated_at: string
          title_snapshot: string
          user_id: string
        }
        Insert: {
          artifact_kind: string
          channel: string
          completion_date: string
          created_at?: string
          id?: string
          locale: string
          meme_id: string
          mode?: string
          performance_note?: string | null
          performance_rating?: string | null
          private_note?: string | null
          result_url?: string | null
          source_updated_at: string
          title_snapshot: string
          user_id: string
        }
        Update: {
          artifact_kind?: string
          channel?: string
          completion_date?: string
          created_at?: string
          id?: string
          locale?: string
          meme_id?: string
          mode?: string
          performance_note?: string | null
          performance_rating?: string | null
          private_note?: string | null
          result_url?: string | null
          source_updated_at?: string
          title_snapshot?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plus_meme_use_receipts_completion_fkey"
            columns: ["user_id", "meme_id", "completion_date"]
            isOneToOne: true
            referencedRelation: "plus_meme_use_completions"
            referencedColumns: ["user_id", "meme_id", "completion_date"]
          },
          {
            foreignKeyName: "plus_meme_use_receipts_meme_id_fkey"
            columns: ["meme_id"]
            isOneToOne: false
            referencedRelation: "memes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plus_meme_use_receipts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plus_saved_context_alerts: {
        Row: {
          created_at: string
          event_id: number
          id: number
          read_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: number
          id?: never
          read_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: number
          id?: never
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plus_saved_context_alerts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "meme_public_change_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plus_saved_context_alerts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plus_translation_requests: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          locale: string
          meme_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          locale: string
          meme_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          locale?: string
          meme_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plus_translation_requests_meme_id_fkey"
            columns: ["meme_id"]
            isOneToOne: false
            referencedRelation: "memes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plus_translation_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_customizations: {
        Row: {
          accent_color: string | null
          flair: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          accent_color?: string | null
          flair?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          accent_color?: string | null
          flair?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_customizations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          age_group: string | null
          created_at: string
          id: string
          interests: string[]
          nickname: string
          preferred_platforms: string[]
          role: Database["public"]["Enums"]["user_role"]
          trust_score: number
          use_purpose: string | null
        }
        Insert: {
          age_group?: string | null
          created_at?: string
          id: string
          interests?: string[]
          nickname: string
          preferred_platforms?: string[]
          role?: Database["public"]["Enums"]["user_role"]
          trust_score?: number
          use_purpose?: string | null
        }
        Update: {
          age_group?: string | null
          created_at?: string
          id?: string
          interests?: string[]
          nickname?: string
          preferred_platforms?: string[]
          role?: Database["public"]["Enums"]["user_role"]
          trust_score?: number
          use_purpose?: string | null
        }
        Relationships: []
      }
      radar_meme_state: {
        Row: {
          candidate_observations: number
          candidate_state: string | null
          confidence: number
          current_state: string
          heat_score: number
          last_observation_id: string
          meme_id: string
          observed_at: string
          required_observations: number
          state_changed_at: string
          updated_at: string
        }
        Insert: {
          candidate_observations?: number
          candidate_state?: string | null
          confidence: number
          current_state: string
          heat_score: number
          last_observation_id: string
          meme_id: string
          observed_at: string
          required_observations?: number
          state_changed_at?: string
          updated_at?: string
        }
        Update: {
          candidate_observations?: number
          candidate_state?: string | null
          confidence?: number
          current_state?: string
          heat_score?: number
          last_observation_id?: string
          meme_id?: string
          observed_at?: string
          required_observations?: number
          state_changed_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "radar_meme_state_last_observation_id_fkey"
            columns: ["last_observation_id"]
            isOneToOne: false
            referencedRelation: "radar_trend_observations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "radar_meme_state_meme_id_fkey"
            columns: ["meme_id"]
            isOneToOne: true
            referencedRelation: "memes"
            referencedColumns: ["id"]
          },
        ]
      }
      radar_trend_observations: {
        Row: {
          confidence: number
          created_at: string
          factors: Json
          heat_score: number
          id: string
          meme_id: string
          model_version: string
          observed_at: string
          recommended_state: string
          retention_until: string
          signal_id: string | null
        }
        Insert: {
          confidence: number
          created_at?: string
          factors?: Json
          heat_score: number
          id?: string
          meme_id: string
          model_version: string
          observed_at: string
          recommended_state: string
          retention_until?: string
          signal_id?: string | null
        }
        Update: {
          confidence?: number
          created_at?: string
          factors?: Json
          heat_score?: number
          id?: string
          meme_id?: string
          model_version?: string
          observed_at?: string
          recommended_state?: string
          retention_until?: string
          signal_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "radar_trend_observations_meme_id_fkey"
            columns: ["meme_id"]
            isOneToOne: false
            referencedRelation: "memes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "radar_trend_observations_signal_id_fkey"
            columns: ["signal_id"]
            isOneToOne: false
            referencedRelation: "external_signals"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          handled_by: string | null
          id: string
          reason: string
          reporter_id: string
          status: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_type: Database["public"]["Enums"]["report_target"]
        }
        Insert: {
          created_at?: string
          handled_by?: string | null
          id?: string
          reason: string
          reporter_id: string
          status?: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_type: Database["public"]["Enums"]["report_target"]
        }
        Update: {
          created_at?: string
          handled_by?: string | null
          id?: string
          reason?: string
          reporter_id?: string
          status?: Database["public"]["Enums"]["report_status"]
          target_id?: string
          target_type?: Database["public"]["Enums"]["report_target"]
        }
        Relationships: [
          {
            foreignKeyName: "reports_handled_by_fkey"
            columns: ["handled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_history: {
        Row: {
          changed_at: string
          changed_by: string
          evidence: Json
          id: number
          meme_id: string
          new_level: Database["public"]["Enums"]["safety_level"]
          old_level: Database["public"]["Enums"]["safety_level"]
          reason: string
          review_id: string
        }
        Insert: {
          changed_at?: string
          changed_by: string
          evidence?: Json
          id?: never
          meme_id: string
          new_level: Database["public"]["Enums"]["safety_level"]
          old_level: Database["public"]["Enums"]["safety_level"]
          reason: string
          review_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string
          evidence?: Json
          id?: never
          meme_id?: string
          new_level?: Database["public"]["Enums"]["safety_level"]
          old_level?: Database["public"]["Enums"]["safety_level"]
          reason?: string
          review_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "safety_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_history_meme_id_fkey"
            columns: ["meme_id"]
            isOneToOne: false
            referencedRelation: "memes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_history_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: true
            referencedRelation: "safety_review_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_review_queue: {
        Row: {
          evidence: Json
          id: string
          meme_id: string
          proposed_level: Database["public"]["Enums"]["safety_level"]
          reason: string
          requested_at: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_signal_id: string | null
          status: string
        }
        Insert: {
          evidence?: Json
          id?: string
          meme_id: string
          proposed_level: Database["public"]["Enums"]["safety_level"]
          reason: string
          requested_at?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_signal_id?: string | null
          status?: string
        }
        Update: {
          evidence?: Json
          id?: string
          meme_id?: string
          proposed_level?: Database["public"]["Enums"]["safety_level"]
          reason?: string
          requested_at?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_signal_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "safety_review_queue_meme_id_fkey"
            columns: ["meme_id"]
            isOneToOne: false
            referencedRelation: "memes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_review_queue_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_review_queue_source_signal_id_fkey"
            columns: ["source_signal_id"]
            isOneToOne: false
            referencedRelation: "external_signals"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_memes: {
        Row: {
          collection: string | null
          created_at: string
          meme_id: string
          note: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          collection?: string | null
          created_at?: string
          meme_id: string
          note?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          collection?: string | null
          created_at?: string
          meme_id?: string
          note?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_memes_meme_id_fkey"
            columns: ["meme_id"]
            isOneToOne: false
            referencedRelation: "memes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_memes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_campaign_items: {
        Row: {
          baseline_28d: Json
          baseline_90d: Json
          batch: number
          bucket: string
          campaign_id: string
          canonical: string
          checklist: Json
          claimed_at: string | null
          claimed_by: string | null
          completed_request_id: string | null
          content_version_at_selection: string
          created_at: string
          edited_at: string | null
          id: string
          lock_version: number
          meme_id: string
          post_28d: Json | null
          post_56d: Json | null
          prior_28d: Json
          reviewer: string | null
          safe_primary_query: string | null
          selection_reason: string
          short_id: string
          state: string
          updated_at: string
        }
        Insert: {
          baseline_28d: Json
          baseline_90d: Json
          batch: number
          bucket: string
          campaign_id: string
          canonical: string
          checklist?: Json
          claimed_at?: string | null
          claimed_by?: string | null
          completed_request_id?: string | null
          content_version_at_selection: string
          created_at?: string
          edited_at?: string | null
          id?: string
          lock_version?: number
          meme_id: string
          post_28d?: Json | null
          post_56d?: Json | null
          prior_28d: Json
          reviewer?: string | null
          safe_primary_query?: string | null
          selection_reason: string
          short_id: string
          state: string
          updated_at?: string
        }
        Update: {
          baseline_28d?: Json
          baseline_90d?: Json
          batch?: number
          bucket?: string
          campaign_id?: string
          canonical?: string
          checklist?: Json
          claimed_at?: string | null
          claimed_by?: string | null
          completed_request_id?: string | null
          content_version_at_selection?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          lock_version?: number
          meme_id?: string
          post_28d?: Json | null
          post_56d?: Json | null
          prior_28d?: Json
          reviewer?: string | null
          safe_primary_query?: string | null
          selection_reason?: string
          short_id?: string
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seo_campaign_items_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "seo_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_campaign_items_claimed_by_fkey"
            columns: ["claimed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_campaign_items_meme_id_fkey"
            columns: ["meme_id"]
            isOneToOne: false
            referencedRelation: "memes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_campaign_items_reviewer_fkey"
            columns: ["reviewer"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_campaigns: {
        Row: {
          created_at: string
          created_by: string | null
          generator_commit: string
          holdout_count: number
          id: string
          input_hash: string
          manifest_hash: string
          measure_28d_at: string | null
          measure_56d_at: string | null
          name: string
          schema_version: string
          scoring_version: string
          seed: string
          started_at: string | null
          state: string
          target_count: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          generator_commit: string
          holdout_count: number
          id: string
          input_hash: string
          manifest_hash: string
          measure_28d_at?: string | null
          measure_56d_at?: string | null
          name: string
          schema_version: string
          scoring_version: string
          seed: string
          started_at?: string | null
          state?: string
          target_count: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          generator_commit?: string
          holdout_count?: number
          id?: string
          input_hash?: string
          manifest_hash?: string
          measure_28d_at?: string | null
          measure_56d_at?: string | null
          name?: string
          schema_version?: string
          scoring_version?: string
          seed?: string
          started_at?: string | null
          state?: string
          target_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seo_campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_inquiries: {
        Row: {
          admin_reply: string | null
          body: string
          category: string
          created_at: string
          id: string
          replied_at: string | null
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_reply?: string | null
          body: string
          category: string
          created_at?: string
          id?: string
          replied_at?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_reply?: string | null
          body?: string
          category?: string
          created_at?: string
          id?: string
          replied_at?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_inquiries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          id: string
          name: string
          type: string
        }
        Insert: {
          id?: string
          name: string
          type?: string
        }
        Update: {
          id?: string
          name?: string
          type?: string
        }
        Relationships: []
      }
      trend_alerts: {
        Row: {
          created_at: string
          id: number
          kind: string
          meme_id: string
          read_at: string | null
          trend_score: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          kind?: string
          meme_id: string
          read_at?: string | null
          trend_score?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: never
          kind?: string
          meme_id?: string
          read_at?: string | null
          trend_score?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trend_alerts_meme_id_fkey"
            columns: ["meme_id"]
            isOneToOne: false
            referencedRelation: "memes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trend_alerts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      view_events: {
        Row: {
          created_at: string
          id: number
          meme_id: string
          session_hash: string
          viewed_on: string
        }
        Insert: {
          created_at?: string
          id?: never
          meme_id: string
          session_hash: string
          viewed_on?: string
        }
        Update: {
          created_at?: string
          id?: never
          meme_id?: string
          session_hash?: string
          viewed_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "view_events_meme_id_fkey"
            columns: ["meme_id"]
            isOneToOne: false
            referencedRelation: "memes"
            referencedColumns: ["id"]
          },
        ]
      }
      web_push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "web_push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_matches: {
        Row: {
          audio_score: number | null
          candidate_id: string
          classification: string
          created_at: string
          evidence_json: Json
          id: string
          meme_id: string
          overall_score: number
          rank: number
          text_score: number | null
          visual_score: number | null
        }
        Insert: {
          audio_score?: number | null
          candidate_id: string
          classification: string
          created_at?: string
          evidence_json?: Json
          id?: string
          meme_id: string
          overall_score: number
          rank: number
          text_score?: number | null
          visual_score?: number | null
        }
        Update: {
          audio_score?: number | null
          candidate_id?: string
          classification?: string
          created_at?: string
          evidence_json?: Json
          id?: string
          meme_id?: string
          overall_score?: number
          rank?: number
          text_score?: number | null
          visual_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_matches_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "meme_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_matches_meme_id_fkey"
            columns: ["meme_id"]
            isOneToOne: false
            referencedRelation: "memes"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_revisions: {
        Row: {
          candidate_id: string
          created_at: string
          created_by: string | null
          draft_json: Json
          id: string
          model_version: string
          prompt_version: string
          revision_number: number
        }
        Insert: {
          candidate_id: string
          created_at?: string
          created_by?: string | null
          draft_json: Json
          id?: string
          model_version: string
          prompt_version: string
          revision_number: number
        }
        Update: {
          candidate_id?: string
          created_at?: string
          created_by?: string | null
          draft_json?: Json
          id?: string
          model_version?: string
          prompt_version?: string
          revision_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "candidate_revisions_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "meme_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_revisions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_evidence: {
        Row: {
          candidate_id: string
          claim_field: string
          claim_text: string
          confidence: number | null
          created_at: string
          id: string
          ingestion_id: string | null
          review_status: string
          source_id: string | null
          text_segment_id: string | null
        }
        Insert: {
          candidate_id: string
          claim_field: string
          claim_text: string
          confidence?: number | null
          created_at?: string
          id?: string
          ingestion_id?: string | null
          review_status?: string
          source_id?: string | null
          text_segment_id?: string | null
        }
        Update: {
          candidate_id?: string
          claim_field?: string
          claim_text?: string
          confidence?: number | null
          created_at?: string
          id?: string
          ingestion_id?: string | null
          review_status?: string
          source_id?: string | null
          text_segment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claim_evidence_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "meme_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_evidence_ingestion_id_fkey"
            columns: ["ingestion_id"]
            isOneToOne: false
            referencedRelation: "media_ingestions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_evidence_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "media_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_evidence_text_segment_id_fkey"
            columns: ["text_segment_id"]
            isOneToOne: false
            referencedRelation: "text_segments"
            referencedColumns: ["id"]
          },
        ]
      }
      media_fingerprints: {
        Row: {
          created_at: string
          embedding: number[] | null
          fingerprint_type: string
          frame_ms: number | null
          hash_value: string
          id: string
          ingestion_id: string
          processor_version: string
        }
        Insert: {
          created_at?: string
          embedding?: number[] | null
          fingerprint_type: string
          frame_ms?: number | null
          hash_value: string
          id?: string
          ingestion_id: string
          processor_version: string
        }
        Update: {
          created_at?: string
          embedding?: number[] | null
          fingerprint_type?: string
          frame_ms?: number | null
          hash_value?: string
          id?: string
          ingestion_id?: string
          processor_version?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_fingerprints_ingestion_id_fkey"
            columns: ["ingestion_id"]
            isOneToOne: false
            referencedRelation: "media_ingestions"
            referencedColumns: ["id"]
          },
        ]
      }
      media_ingestions: {
        Row: {
          byte_size: number
          created_at: string
          deleted_at: string | null
          duration_ms: number | null
          expires_at: string
          height: number | null
          id: string
          ingest_mode: string
          media_kind: string
          mime_type: string
          rights_basis: string | null
          rights_attested_at: string
          sha256: string
          source_id: string | null
          source_role: string | null
          temporary_storage_key: string
          user_id: string
          width: number | null
        }
        Insert: {
          byte_size: number
          created_at?: string
          deleted_at?: string | null
          duration_ms?: number | null
          expires_at: string
          height?: number | null
          id?: string
          ingest_mode: string
          media_kind: string
          mime_type: string
          rights_basis?: string | null
          rights_attested_at: string
          sha256: string
          source_id?: string | null
          source_role?: string | null
          temporary_storage_key: string
          user_id: string
          width?: number | null
        }
        Update: {
          byte_size?: number
          created_at?: string
          deleted_at?: string | null
          duration_ms?: number | null
          expires_at?: string
          height?: number | null
          id?: string
          ingest_mode?: string
          media_kind?: string
          mime_type?: string
          rights_basis?: string | null
          rights_attested_at?: string
          sha256?: string
          source_id?: string | null
          source_role?: string | null
          temporary_storage_key?: string
          user_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_ingestions_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "media_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_ingestions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meme_candidates: {
        Row: {
          created_at: string
          created_by: string | null
          draft_json: Json
          id: string
          ingestion_id: string
          meme_type: string
          model_version: string
          overall_confidence: number | null
          prompt_version: string
          review_status: string
          target_meme_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          draft_json?: Json
          id?: string
          ingestion_id: string
          meme_type: string
          model_version: string
          overall_confidence?: number | null
          prompt_version: string
          review_status?: string
          target_meme_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          draft_json?: Json
          id?: string
          ingestion_id?: string
          meme_type?: string
          model_version?: string
          overall_confidence?: number | null
          prompt_version?: string
          review_status?: string
          target_meme_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meme_candidates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meme_candidates_ingestion_id_fkey"
            columns: ["ingestion_id"]
            isOneToOne: false
            referencedRelation: "media_ingestions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meme_candidates_target_meme_id_fkey"
            columns: ["target_meme_id"]
            isOneToOne: false
            referencedRelation: "memes"
            referencedColumns: ["id"]
          },
        ]
      }
      processing_jobs: {
        Row: {
          attempts: number
          completed_at: string | null
          cost_units: number
          created_at: string
          error_code: string | null
          id: string
          ingestion_id: string
          input_hash: string
          job_type: string
          lease_token: string | null
          output_json: Json
          processor_name: string
          processor_version: string
          started_at: string | null
          status: string
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          cost_units?: number
          created_at?: string
          error_code?: string | null
          id?: string
          ingestion_id: string
          input_hash: string
          job_type: string
          lease_token?: string | null
          output_json?: Json
          processor_name: string
          processor_version: string
          started_at?: string | null
          status?: string
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          cost_units?: number
          created_at?: string
          error_code?: string | null
          id?: string
          ingestion_id?: string
          input_hash?: string
          job_type?: string
          lease_token?: string | null
          output_json?: Json
          processor_name?: string
          processor_version?: string
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "processing_jobs_ingestion_id_fkey"
            columns: ["ingestion_id"]
            isOneToOne: false
            referencedRelation: "media_ingestions"
            referencedColumns: ["id"]
          },
        ]
      }
      review_decisions: {
        Row: {
          candidate_id: string
          created_at: string
          decision: string
          id: string
          reason: string | null
          review_stage: string
          reviewer_id: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          decision: string
          id?: string
          reason?: string | null
          review_stage: string
          reviewer_id: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          decision?: string
          id?: string
          reason?: string | null
          review_stage?: string
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_decisions_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "meme_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_decisions_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      text_segments: {
        Row: {
          bounding_box_json: Json | null
          confidence: number | null
          created_at: string
          end_ms: number | null
          id: string
          ingestion_id: string
          language: string | null
          normalized_text: string | null
          origin: string
          raw_text: string
          start_ms: number | null
        }
        Insert: {
          bounding_box_json?: Json | null
          confidence?: number | null
          created_at?: string
          end_ms?: number | null
          id?: string
          ingestion_id: string
          language?: string | null
          normalized_text?: string | null
          origin: string
          raw_text: string
          start_ms?: number | null
        }
        Update: {
          bounding_box_json?: Json | null
          confidence?: number | null
          created_at?: string
          end_ms?: number | null
          id?: string
          ingestion_id?: string
          language?: string | null
          normalized_text?: string | null
          origin?: string
          raw_text?: string
          start_ms?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "text_segments_ingestion_id_fkey"
            columns: ["ingestion_id"]
            isOneToOne: false
            referencedRelation: "media_ingestions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      generation_vote_stats: {
        Row: {
          age_group: string | null
          cnt: number | null
          meme_id: string | null
          vote: string | null
        }
        Relationships: [
          {
            foreignKeyName: "generation_votes_meme_id_fkey"
            columns: ["meme_id"]
            isOneToOne: false
            referencedRelation: "memes"
            referencedColumns: ["id"]
          },
        ]
      }
      meme_reaction_counts: {
        Row: {
          cnt: number | null
          meme_id: string | null
          reaction: Database["public"]["Enums"]["reaction_type"] | null
        }
        Relationships: [
          {
            foreignKeyName: "meme_reactions_meme_id_fkey"
            columns: ["meme_id"]
            isOneToOne: false
            referencedRelation: "memes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_get_plus_status: { Args: { p_email: string }; Returns: Json }
      create_fairy_billing_intent: {
        Args: { p_min_amount: number; p_project_slug: string; p_user_id: string }
        Returns: string
      }
      process_fairy_payment: {
        Args: {
          p_amount: number
          p_intent_id: string
          p_occurred_at: string
          p_project_slug: string
          p_payment_id: string
        }
        Returns: Json
      }
      revoke_fairy_payment: { Args: { p_payment_id: string; p_reason: string }; Returns: Json }
      admin_set_plus_entitlement: {
        Args: { p_active: boolean; p_email: string; p_months?: number }
        Returns: Json
      }
      apply_affiliate_sync: {
        Args: { products: Json; run_id: string; synced_at: string }
        Returns: undefined
      }
      apply_safety_review: {
        Args: {
          p_decision: string
          p_review_id: string
          p_review_note?: string
        }
        Returns: boolean
      }
      attach_unifi_payment_link: {
        Args: { p_provider_link_id: string; p_request_id: string }
        Returns: Json
      }
      server_attach_unifi_payment_link: {
        Args: { p_provider_link_id: string; p_request_id: string; p_user_id: string }
        Returns: Json
      }
      server_create_billing_order: {
        Args: { p_growth_session_id?: string | null; p_request_id: string; p_user_id: string }
        Returns: Json
      }
      server_fail_billing_order: {
        Args: { p_request_id: string; p_user_id: string }
        Returns: Json
      }
      capture_growth_funnel_baseline: {
        Args: { p_period_end?: string }
        Returns: string
      }
      cast_generation_vote: {
        Args: { p_age_group: string; p_meme_id: string; p_vote: string }
        Returns: undefined
      }
      check_rate_limit: {
        Args: { p_limit: number; p_minutes: number; p_table: string }
        Returns: undefined
      }
      claim_affiliate_sync: {
        Args: {
          provider: string
          scheduled_date: string
          source_type: string
          started_at: string
        }
        Returns: {
          claimed: boolean
          result: string
          run_id: string
        }[]
      }
      claim_notification_outbox: {
        Args: { p_limit?: number }
        Returns: {
          attempt_count: number
          channel: string
          claim_token: string
          meme_id: string
          outbox_id: string
          payload: Json
          topic: string
          user_id: string
        }[]
      }
      claim_plus_daily_signal_deliveries: {
        Args: { p_delivery_date: string; p_limit?: number }
        Returns: {
          delivery_date: string
          delivery_id: string
          locale: string
          status: string
          user_id: string
        }[]
      }
      claim_plus_expiry_reminders: {
        Args: { p_delivery_date: string; p_limit?: number }
        Returns: {
          current_period_end: string
          delivery_id: string
          locale: string
          reminder_days: number
          status: string
          user_id: string
        }[]
      }
      claim_saved_state_email_outbox: {
        Args: { p_limit?: number }
        Returns: {
          attempt_count: number
          channel: string
          claim_token: string
          meme_id: string
          outbox_id: string
          payload: Json
          topic: string
          user_id: string
        }[]
      }
      claim_seo_campaign_item: {
        Args: { p_batch?: number; p_campaign_id: string }
        Returns: {
          item_id: string
          lock_version: number
          meme_id: string
        }[]
      }
      claim_translation_priority_request: {
        Args: { p_locale: string; p_meme_id: string }
        Returns: Json
      }
      claim_web_push_outbox: {
        Args: { p_limit?: number }
        Returns: {
          attempt_count: number
          claim_token: string
          meme_id: string
          outbox_id: string
          payload: Json
          user_id: string
        }[]
      }
      complete_plus_global_daily_challenge: {
        Args: { p_locale: string }
        Returns: Json
      }
      complete_plus_meme_use: { Args: { p_meme_id: string }; Returns: Json }
      complete_seo_campaign_item: {
        Args: {
          p_checklist: Json
          p_content: Json
          p_expected_content_version: string
          p_expected_lock_version: number
          p_item_id: string
          p_request_id: string
        }
        Returns: string
      }
      compute_trend_scores: { Args: never; Returns: undefined }
      create_billing_order: {
        Args: { p_growth_session_id?: string | null; p_request_id: string }
        Returns: Json
      }
      create_community_comment: {
        Args: { p_body: string; p_post_id: string }
        Returns: string
      }
      create_community_post: {
        Args: { p_body: string; p_meme_id?: string; p_title: string }
        Returns: string
      }
      create_unifi_payment_intent: {
        Args: {
          p_amount: number
          p_currency: string
          p_item_identifier: string
          p_payment_id: string
          p_test_mode: boolean
        }
        Returns: Json
      }
      enqueue_safety_review: {
        Args: {
          p_evidence?: Json
          p_meme_id: string
          p_proposed_level: Database["public"]["Enums"]["safety_level"]
          p_reason: string
          p_source_signal_id?: string
        }
        Returns: string
      }
      enqueue_web_push_trend_alerts: { Args: never; Returns: number }
      extract_chosung: { Args: { input: string }; Returns: string }
      fail_affiliate_sync: {
        Args: { error_code: string; run_id: string }
        Returns: undefined
      }
      fail_billing_order: { Args: { p_request_id: string }; Returns: Json }
      fan_out_saved_context_alerts: { Args: never; Returns: number }
      fan_out_trend_alerts: { Args: never; Returns: number }
      file_report: {
        Args: {
          p_reason: string
          p_target: Database["public"]["Enums"]["report_target"]
          p_target_id: string
        }
        Returns: string
      }
      finish_notification_outbox: {
        Args: {
          p_claim_token: string
          p_error?: string
          p_outbox_id: string
          p_retry_at?: string
          p_succeeded: boolean
        }
        Returns: boolean
      }
      finish_plus_daily_signal_delivery: {
        Args: {
          p_delivery_id: string
          p_error_code?: string | null
          p_provider_message_id?: string | null
          p_status: string
        }
        Returns: boolean
      }
      finish_plus_expiry_reminder: {
        Args: {
          p_delivery_id: string
          p_error_code?: string
          p_provider_message_id?: string
          p_status: string
        }
        Returns: boolean
      }
      gen_short_id: { Args: never; Returns: string }
      get_brand_workspace_bundle: { Args: never; Returns: Json }
      get_daily_top_memes: {
        Args: { p_limit?: number }
        Returns: {
          aliases: string[]
          category: Database["public"]["Enums"]["meme_category"]
          caution: string | null
          created_at: string
          description: string
          difficulty: Database["public"]["Enums"]["meme_difficulty"]
          doc_class: string
          era_type: string | null
          house_rights_attested_at: string | null
          id: string
          korea_viral_year: number | null
          lifecycle_status: Database["public"]["Enums"]["lifecycle_status"]
          media_type: Database["public"]["Enums"]["media_type"]
          meme_first_seen_year: number | null
          moderation_status: Database["public"]["Enums"]["moderation_status"]
          origin: string
          origin_kind: string
          origin_year: number | null
          published_at: string | null
          revival_years: number[]
          safety_level: Database["public"]["Enums"]["safety_level"]
          safety_reviewed_at: string | null
          sentiment: Database["public"]["Enums"]["meme_sentiment"]
          short_id: string
          slug: string
          source_work_year: number | null
          submitted_by: string | null
          summary: string
          title: string
          title_chosung: string | null
          trend_score: number
          updated_at: string
          usage_context: Json
          usage_examples: Json | null
          usage_note: string | null
          year_precision: string
        }[]
        SetofOptions: {
          from: "*"
          to: "memes"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_admin_activity_dashboard: {
        Args: {
          p_from: string
          p_to: string
          p_hour_date: string
          p_user_id?: string
          p_subscribers_only?: boolean
          p_users_page?: number
          p_views_page?: number
        }
        Returns: Json
      }
      get_growth_kpi_dashboard: { Args: never; Returns: Json }
      get_growth_pilot_dashboard: { Args: never; Returns: Json }
      get_growth_seo_related_counts: {
        Args: { p_meme_ids: string[] }
        Returns: {
          meme_id: string
          related_count: number
        }[]
      }
      get_plus_global_daily_challenge: {
        Args: { p_challenge_date: string }
        Returns: {
          candidate_meme_ids: string[]
          challenge_date: string
          completed_at: string
          completion_locale: string
          current_streak: number
        }[]
      }
      get_plus_meme_use_outcome_summary: { Args: never; Returns: Json }
      get_plus_meme_use_summary: { Args: never; Returns: Json }
      growth_kpi_average: {
        Args: {
          p_coverage_complete: boolean
          p_denominator: number
          p_incomplete_reason: string
          p_numerator: number
        }
        Returns: Json
      }
      growth_kpi_ratio: {
        Args: {
          p_coverage_complete: boolean
          p_denominator: number
          p_incomplete_reason: string
          p_numerator: number
        }
        Returns: Json
      }
      growth_kpi_unavailable: { Args: { p_reason: string }; Returns: Json }
      has_active_plus: { Args: { p_user_id: string }; Returns: boolean }
      get_my_profile: {
        Args: never
        Returns: {
          age_group: string | null
          interests: string[]
          nickname: string
          preferred_platforms: string[]
          use_purpose: string | null
        }[]
      }
      has_web_push_subscription: { Args: never; Returns: boolean }
      increment_view: {
        Args: { p_meme_id: string; p_session_hash: string }
        Returns: undefined
      }
      is_growth_english_pilot_eligible: {
        Args: { p_meme_id: string }
        Returns: boolean
      }
      is_meme_rank_eligible: { Args: { p_meme_id: string }; Returns: boolean }
      is_operator: { Args: never; Returns: boolean }
      is_trusted_one_cut_meme: {
        Args: { p_meme_id: string }
        Returns: boolean
      }
      list_translation_priority_queue:
        | {
            Args: { p_limit?: number }
            Returns: {
              latest_requested_at: string
              locale: string
              meme_id: string
              meme_short_id: string
              meme_slug: string
              meme_summary: string
              meme_title: string
              meme_updated_at: string
              request_count: number
              source_updated_at: string
              status: string
              translation_status: string
              translation_summary: string
              translation_title: string
              translation_updated_at: string
            }[]
          }
        | {
            Args: { p_limit: number; p_locale: string }
            Returns: {
              latest_requested_at: string
              locale: string
              meme_id: string
              meme_short_id: string
              meme_slug: string
              meme_summary: string
              meme_title: string
              meme_updated_at: string
              request_count: number
              source_updated_at: string
              status: string
              translation_status: string
              translation_summary: string
              translation_title: string
              translation_updated_at: string
            }[]
          }
      mark_saved_context_alerts_read: { Args: never; Returns: number }
      mark_trend_alerts_read: { Args: never; Returns: number }
      meme_ranking_completeness: {
        Args: { p_meme_id: string }
        Returns: number
      }
      post_comment: {
        Args: { p_body: string; p_meme_id: string; p_parent_id: string }
        Returns: string
      }
      process_latpeed_membership_event: {
        Args: {
          p_amount: number | null
          p_email: string
          p_event_key: string
          p_event_type: string
          p_occurred_at: string
          p_order_id: string
          p_payload: Json
          p_product_id: string | null
          p_status: string
        }
        Returns: Json
      }
      process_unifi_order_event: {
        Args: {
          p_occurred_at: string
          p_payload: Json
          p_provider_link_id: string
          p_status: string
          p_transaction_id: string
        }
        Returns: Json
      }
      process_unifi_payment_event: {
        Args: {
          p_amount: number
          p_event_key: string
          p_occurred_at: string
          p_payload: Json
          p_payment_id: string
          p_status: string
        }
        Returns: Json
      }
      publish_house_original: {
        Args: {
          p_attested: boolean
          p_meme_id: string
          p_to: Database["public"]["Enums"]["moderation_status"]
        }
        Returns: boolean
      }
      set_meme_origin_country: {
        Args: {
          p_local_title: string
          p_market_code: string
          p_meme_id: string
        }
        Returns: Json
      }
      set_meme_origin_country_with_evidence: {
        Args: {
          p_evidence_source_id: string
          p_local_title: string
          p_market_code: string
          p_meme_id: string
        }
        Returns: Json
      }
      publish_seo_campaign: { Args: { p_manifest: Json }; Returns: string }
      publish_seo_measurements: {
        Args: { p_campaign_id: string; p_items: Json; p_window: string }
        Returns: undefined
      }
      queue_plus_daily_signal_deliveries: {
        Args: { p_delivery_date: string }
        Returns: number
      }
      queue_plus_expiry_reminders: {
        Args: { p_delivery_date: string }
        Returns: number
      }
      reconcile_latpeed_order: {
        Args: { p_order_id: string; p_user_id: string }
        Returns: Json
      }
      reconcile_unifi_payment: {
        Args: { p_payment_id: string; p_user_id: string }
        Returns: Json
      }
      reconcile_unifi_refund: {
        Args: {
          p_occurred_at: string
          p_original_transaction_id: string
          p_payload: Json
          p_refund_transaction_id: string
        }
        Returns: Json
      }
      record_affiliate_product_click: {
        Args: { metric_date: string; product_id: string }
        Returns: undefined
      }
      record_brand_approval: {
        Args: { p_decision: string; p_evaluation_id: string; p_note?: string }
        Returns: string
      }
      record_growth_checkout_events: {
        Args: { p_request_id: string; p_session_id?: string }
        Returns: undefined
      }
      record_growth_event: {
        Args: {
          p_dedupe_key: string | null
          p_event_name: string
          p_format: string | null
          p_locale: string | null
          p_meme_id: string | null
          p_metadata?: Json | null
          p_occurred_at?: string
          p_order_id: string | null
          p_path: string | null
          p_session_id: string | null
          p_source: string
          p_surface: string | null
          p_user_id: string | null
        }
        Returns: string
      }
      record_growth_payment_event: {
        Args: { p_transaction_id: string }
        Returns: undefined
      }
      record_growth_pilot_interview: {
        Args: {
          p_evidence_url?: string
          p_interviewed_at: string
          p_market: string
          p_participant_reference: string
          p_segment: string
          p_summary: string
        }
        Returns: string
      }
      record_plus_meme_use_performance: {
        Args: { p_performance_note: string; p_receipt_id: string }
        Returns: Json
      }
      record_plus_meme_use_rating: {
        Args: { p_performance_rating: string; p_receipt_id: string }
        Returns: Json
      }
      record_plus_meme_use_receipt: {
        Args: {
          p_artifact_kind: string
          p_channel: string
          p_locale: string
          p_meme_id: string
          p_mode?: string
          p_performance_note?: string | null
          p_private_note?: string | null
          p_result_url?: string | null
        }
        Returns: Json
      }
      resolve_trusted_one_cut_meme: {
        Args: {
          p_disposition: Database["public"]["Enums"]["moderation_status"]
          p_meaning_claim_text: string
          p_meme_id: string
          p_origin_claim_text: string
          p_reviewer_note: string
          p_rights_basis: string
          p_source_id: string
          p_source_role: string
        }
        Returns: Json
      }
      record_radar_trend_observation: {
        Args: {
          p_confidence: number
          p_factors?: Json
          p_heat_score: number
          p_meme_id: string
          p_model_version: string
          p_observed_at: string
          p_recommended_state: string
          p_required_observations?: number
          p_signal_id: string | null
        }
        Returns: string
      }
      record_source_ingestion: {
        Args: {
          p_canonical_url: string
          p_channel_name: string | null
          p_external_id: string | null
          p_metadata_expires_at: string
          p_metadata_refreshed_at: string
          p_platform: string
          p_processing_rights_mode: string
          p_submitted_by: string | null
          p_target_meme_id: string | null
          p_title: string | null
        }
        Returns: {
          duplicate: boolean
          ingestion_id: string
          source_id: string
          status: string
        }[]
      }
      register_billing_identity: { Args: never; Returns: Json }
      remove_web_push_subscription: {
        Args: { p_endpoint: string }
        Returns: boolean
      }
      reproject_unifi_entitlements: {
        Args: { p_event_at: string; p_user_id: string }
        Returns: string
      }
      request_plus_translation: {
        Args: { p_locale: string; p_meme_id: string }
        Returns: Json
      }
      save_brand_fit_evaluation:
        | {
            Args: {
              p_fit_score: number
              p_meme_name: string
              p_proposed_copy: string
              p_rationale: string
              p_risk_level: string
            }
            Returns: string
          }
        | {
            Args: {
              p_fit_score: number
              p_meme_name: string
              p_meme_path: string
              p_proposed_copy: string
              p_rationale: string
              p_risk_level: string
            }
            Returns: string
          }
      save_brand_workspace: {
        Args: {
          p_brand_context: string
          p_brand_name: string
          p_brand_tone: string
          p_forbidden_expressions: string[]
        }
        Returns: string
      }
      save_meme: { Args: { p_meme_id: string }; Returns: boolean }
      search_ai_memes: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          aliases: string[]
          category: Database["public"]["Enums"]["meme_category"]
          caution: string | null
          created_at: string
          description: string
          difficulty: Database["public"]["Enums"]["meme_difficulty"]
          doc_class: string
          era_type: string | null
          house_rights_attested_at: string | null
          id: string
          korea_viral_year: number | null
          lifecycle_status: Database["public"]["Enums"]["lifecycle_status"]
          media_type: Database["public"]["Enums"]["media_type"]
          meme_first_seen_year: number | null
          moderation_status: Database["public"]["Enums"]["moderation_status"]
          origin: string
          origin_kind: string
          origin_year: number | null
          published_at: string | null
          revival_years: number[]
          safety_level: Database["public"]["Enums"]["safety_level"]
          safety_reviewed_at: string | null
          sentiment: Database["public"]["Enums"]["meme_sentiment"]
          short_id: string
          slug: string
          source_work_year: number | null
          submitted_by: string | null
          summary: string
          title: string
          title_chosung: string | null
          trend_score: number
          updated_at: string
          usage_context: Json
          usage_examples: Json | null
          usage_note: string | null
          year_precision: string
        }[]
        SetofOptions: {
          from: "*"
          to: "memes"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      search_memes: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          aliases: string[]
          category: Database["public"]["Enums"]["meme_category"]
          caution: string | null
          created_at: string
          description: string
          difficulty: Database["public"]["Enums"]["meme_difficulty"]
          doc_class: string
          era_type: string | null
          house_rights_attested_at: string | null
          id: string
          korea_viral_year: number | null
          lifecycle_status: Database["public"]["Enums"]["lifecycle_status"]
          media_type: Database["public"]["Enums"]["media_type"]
          meme_first_seen_year: number | null
          moderation_status: Database["public"]["Enums"]["moderation_status"]
          origin: string
          origin_kind: string
          origin_year: number | null
          published_at: string | null
          revival_years: number[]
          safety_level: Database["public"]["Enums"]["safety_level"]
          safety_reviewed_at: string | null
          sentiment: Database["public"]["Enums"]["meme_sentiment"]
          short_id: string
          slug: string
          source_work_year: number | null
          submitted_by: string | null
          summary: string
          title: string
          title_chosung: string | null
          trend_score: number
          updated_at: string
          usage_context: Json
          usage_examples: Json | null
          usage_note: string | null
          year_precision: string
        }[]
        SetofOptions: {
          from: "*"
          to: "memes"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      set_growth_english_pilot_slot: {
        Args: {
          p_meme_id: string
          p_operator_note?: string
          p_slot: number
          p_status: string
        }
        Returns: undefined
      }
      set_plus_digest_preferences: {
        Args: { p_enabled: boolean; p_locale: string }
        Returns: Json
      }
      set_web_push_subscription: {
        Args: {
          p_auth: string
          p_endpoint: string
          p_p256dh: string
          p_user_agent?: string
        }
        Returns: boolean
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      submit_meme: {
        Args: {
          p_description: string
          p_guess: string
          p_name: string
          p_seen_at: string
          p_tags: string[]
          p_url: string
        }
        Returns: string
      }
      submit_meme_v2: {
        Args: {
          p_attachment_path?: string
          p_description: string
          p_guess: string
          p_name: string
          p_seen_at: string
          p_tags: string[]
          p_url: string
        }
        Returns: string
      }
      toggle_post_like: { Args: { p_post_id: string }; Returns: boolean }
      toggle_reaction: {
        Args: {
          p_meme_id: string
          p_reaction: Database["public"]["Enums"]["reaction_type"]
        }
        Returns: boolean
      }
      toggle_save: { Args: { p_meme_id: string }; Returns: boolean }
      update_meme_with_safety_review: {
        Args: {
          p_content: Json
          p_meme_id: string
          p_proposed_level: Database["public"]["Enums"]["safety_level"]
        }
        Returns: boolean
      }
      update_profile_customization: {
        Args: { p_accent: string | null; p_flair: string | null }
        Returns: Json
      }
      update_saved_meme: {
        Args: {
          p_collection: string | null
          p_meme_id: string
          p_note: string | null
        }
        Returns: Json
      }
      claim_processing_job: {
        Args: {
          p_job_types?: string[]
          p_processor_name: string
          p_processor_version: string
        }
        Returns: Database["public"]["Tables"]["processing_jobs"]["Row"][]
        SetofOptions: {
          from: "*"
          to: "processing_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      complete_processing_job: {
        Args: {
          p_cost_units?: number
          p_error_code?: string
          p_job_id: string
          p_lease_token: string
          p_output_json?: Json
          p_status: string
        }
        Returns: Database["public"]["Tables"]["processing_jobs"]["Row"]
        SetofOptions: {
          from: "*"
          to: "processing_jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_media_ingestion: {
        Args: {
          p_byte_size: number
          p_duration_ms?: number
          p_expires_at: string
          p_height?: number
          p_ingest_mode: string
          p_media_kind: string
          p_mime_type: string
          p_rights_accepted: boolean
          p_sha256: string
          p_source_id: string | null
          p_temporary_storage_key: string
          p_width?: number
        }
        Returns: {
          ingestion_id: string
          job_ids: string[]
        }[]
      }
      review_mpe_candidate: {
        Args: {
          p_candidate_id: string
          p_decision: string
          p_reason?: string | null
          p_stage: string
        }
        Returns: Database["public"]["Tables"]["meme_candidates"]["Row"]
        SetofOptions: {
          from: "*"
          to: "meme_candidates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      queue_mpe_render_job: {
        Args: {
          p_attribution: string
          p_ingestion_id: string
          p_preset: string
          p_segments: Json
        }
        Returns: Database["public"]["Tables"]["processing_jobs"]["Row"]
        SetofOptions: {
          from: "*"
          to: "processing_jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      replace_mpe_candidate_evidence: {
        Args: {
          p_candidate_id: string
          p_draft_json: Json
          p_evidence: Json
        }
        Returns: Database["public"]["Tables"]["meme_candidates"]["Row"]
        SetofOptions: {
          from: "*"
          to: "meme_candidates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      replace_mpe_candidate_matches: {
        Args: { p_candidate_id: string; p_matches: Json }
        Returns: Database["public"]["Tables"]["candidate_matches"]["Row"][]
        SetofOptions: {
          from: "*"
          to: "candidate_matches"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      review_mpe_claim: {
        Args: {
          p_candidate_id: string
          p_claim_id: string
          p_decision: string
        }
        Returns: Database["public"]["Tables"]["claim_evidence"]["Row"]
        SetofOptions: {
          from: "*"
          to: "claim_evidence"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reprocess_mpe_job: {
        Args: { p_job_id: string }
        Returns: Database["public"]["Tables"]["processing_jobs"]["Row"]
        SetofOptions: {
          from: "*"
          to: "processing_jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      save_mpe_candidate_revision: {
        Args: { p_candidate_id: string; p_draft_json: Json }
        Returns: Database["public"]["Tables"]["meme_candidates"]["Row"]
        SetofOptions: {
          from: "*"
          to: "meme_candidates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_mpe_ingestion_source_rights: {
        Args: {
          p_ingestion_id: string
          p_rights_basis: string
          p_source_role: string
        }
        Returns: Database["public"]["Tables"]["media_ingestions"]["Row"]
        SetofOptions: {
          from: "*"
          to: "media_ingestions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      availability_status: "live" | "dead" | "region_blocked" | "unchecked"
      copyright_status:
        | "unknown"
        | "embeddable"
        | "permission_needed"
        | "internal_only"
      discussion_status: "visible" | "hidden" | "deleted"
      lifecycle_status: "rising" | "active" | "cooling" | "archived"
      media_type: "image" | "video" | "audio" | "text" | "embed"
      meme_category:
        | "phrase"
        | "dance"
        | "song"
        | "image"
        | "comment"
        | "challenge"
      meme_difficulty: "beginner" | "normal" | "deep"
      meme_sentiment:
        | "funny"
        | "ironic"
        | "controversial"
        | "negative"
        | "wholesome"
      moderation_status:
        | "pending"
        | "fact_checking"
        | "rights_checking"
        | "approved"
        | "limited"
        | "rejected"
      reaction_type:
        | "understood"
        | "funny"
        | "just_learned"
        | "too_late"
        | "still_alive"
        | "risky"
      report_status: "open" | "resolved" | "dismissed"
      report_target: "meme" | "discussion" | "submission"
      revision_status: "proposed" | "approved" | "rejected"
      safety_level: "green" | "yellow" | "gray" | "red"
      submission_status: "pending" | "reviewing" | "approved" | "rejected"
      user_role: "user" | "operator"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      availability_status: ["live", "dead", "region_blocked", "unchecked"],
      copyright_status: [
        "unknown",
        "embeddable",
        "permission_needed",
        "internal_only",
      ],
      discussion_status: ["visible", "hidden", "deleted"],
      lifecycle_status: ["rising", "active", "cooling", "archived"],
      media_type: ["image", "video", "audio", "text", "embed"],
      meme_category: [
        "phrase",
        "dance",
        "song",
        "image",
        "comment",
        "challenge",
      ],
      meme_difficulty: ["beginner", "normal", "deep"],
      meme_sentiment: [
        "funny",
        "ironic",
        "controversial",
        "negative",
        "wholesome",
      ],
      moderation_status: [
        "pending",
        "fact_checking",
        "rights_checking",
        "approved",
        "limited",
        "rejected",
      ],
      reaction_type: [
        "understood",
        "funny",
        "just_learned",
        "too_late",
        "still_alive",
        "risky",
      ],
      report_status: ["open", "resolved", "dismissed"],
      report_target: ["meme", "discussion", "submission"],
      revision_status: ["proposed", "approved", "rejected"],
      safety_level: ["green", "yellow", "gray", "red"],
      submission_status: ["pending", "reviewing", "approved", "rejected"],
      user_role: ["user", "operator"],
    },
  },
} as const
