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
      meme_sources: {
        Row: {
          captured_at: string
          copyright_status: Database["public"]["Enums"]["copyright_status"]
          creator_name: string | null
          id: string
          meme_id: string
          platform: string
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
      memes: {
        Row: {
          aliases: string[]
          category: Database["public"]["Enums"]["meme_category"]
          caution: string | null
          created_at: string
          description: string
          difficulty: Database["public"]["Enums"]["meme_difficulty"]
          id: string
          lifecycle_status: Database["public"]["Enums"]["lifecycle_status"]
          media_type: Database["public"]["Enums"]["media_type"]
          moderation_status: Database["public"]["Enums"]["moderation_status"]
          origin: string
          origin_year: number | null
          published_at: string | null
          safety_level: Database["public"]["Enums"]["safety_level"]
          sentiment: Database["public"]["Enums"]["meme_sentiment"]
          short_id: string
          slug: string
          submitted_by: string | null
          summary: string
          title: string
          title_chosung: string | null
          trend_score: number
          updated_at: string
          usage_context: Json
          usage_examples: Json | null
          usage_note: string | null
          source_work_year: number | null
          meme_first_seen_year: number | null
          korea_viral_year: number | null
          revival_years: number[]
          year_precision: string
          era_type: string | null
        }
        Insert: {
          aliases?: string[]
          category?: Database["public"]["Enums"]["meme_category"]
          caution?: string | null
          created_at?: string
          description?: string
          difficulty?: Database["public"]["Enums"]["meme_difficulty"]
          id?: string
          lifecycle_status?: Database["public"]["Enums"]["lifecycle_status"]
          media_type?: Database["public"]["Enums"]["media_type"]
          moderation_status?: Database["public"]["Enums"]["moderation_status"]
          origin?: string
          origin_year?: number | null
          published_at?: string | null
          safety_level?: Database["public"]["Enums"]["safety_level"]
          sentiment?: Database["public"]["Enums"]["meme_sentiment"]
          short_id?: string
          slug: string
          submitted_by?: string | null
          summary?: string
          title: string
          title_chosung?: string | null
          trend_score?: number
          updated_at?: string
          usage_context?: Json
          usage_examples?: Json | null
          usage_note?: string | null
          source_work_year?: number | null
          meme_first_seen_year?: number | null
          korea_viral_year?: number | null
          revival_years?: number[]
          year_precision?: string
          era_type?: string | null
        }
        Update: {
          aliases?: string[]
          category?: Database["public"]["Enums"]["meme_category"]
          caution?: string | null
          created_at?: string
          description?: string
          difficulty?: Database["public"]["Enums"]["meme_difficulty"]
          id?: string
          lifecycle_status?: Database["public"]["Enums"]["lifecycle_status"]
          media_type?: Database["public"]["Enums"]["media_type"]
          moderation_status?: Database["public"]["Enums"]["moderation_status"]
          origin?: string
          origin_year?: number | null
          published_at?: string | null
          safety_level?: Database["public"]["Enums"]["safety_level"]
          sentiment?: Database["public"]["Enums"]["meme_sentiment"]
          short_id?: string
          slug?: string
          submitted_by?: string | null
          summary?: string
          title?: string
          title_chosung?: string | null
          trend_score?: number
          updated_at?: string
          usage_context?: Json
          usage_examples?: Json | null
          usage_note?: string | null
          source_work_year?: number | null
          meme_first_seen_year?: number | null
          korea_viral_year?: number | null
          revival_years?: number[]
          year_precision?: string
          era_type?: string | null
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
      billing_subscriptions: {
        Row: {
          amount: number
          created_at: string
          currency: string
          current_period_end: string
          customer_email: string
          external_order_id: string
          provider: string
          provider_product_id: string | null
          status: string
          updated_at: string
          user_id: string
          last_event_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          current_period_end: string
          customer_email: string
          external_order_id: string
          provider?: string
          provider_product_id?: string | null
          status: string
          updated_at?: string
          user_id: string
          last_event_at: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          current_period_end?: string
          customer_email?: string
          external_order_id?: string
          provider?: string
          provider_product_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          last_event_at?: string
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
      profiles: {
        Row: {
          age_group: string | null
          created_at: string
          id: string
          interests: string[]
          nickname: string
          role: Database["public"]["Enums"]["user_role"]
          trust_score: number
        }
        Insert: {
          age_group?: string | null
          created_at?: string
          id: string
          interests?: string[]
          nickname: string
          role?: Database["public"]["Enums"]["user_role"]
          trust_score?: number
        }
        Update: {
          age_group?: string | null
          created_at?: string
          id?: string
          interests?: string[]
          nickname?: string
          role?: Database["public"]["Enums"]["user_role"]
          trust_score?: number
        }
        Relationships: []
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
          id?: number
          kind?: string
          meme_id: string
          read_at?: string | null
          trend_score?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: number
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
      view_events: {
        Row: {
          created_at: string
          id: number
          meme_id: string
          session_hash: string
        }
        Insert: {
          created_at?: string
          id?: never
          meme_id: string
          session_hash: string
        }
        Update: {
          created_at?: string
          id?: never
          meme_id?: string
          session_hash?: string
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
      admin_get_plus_status: {
        Args: { p_email: string }
        Returns: Json
      }
      admin_set_plus_entitlement: {
        Args: { p_active: boolean; p_email: string; p_months?: number }
        Returns: Json
      }
      apply_affiliate_sync: {
        Args: { products: Json; run_id: string; synced_at: string }
        Returns: undefined
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
      compute_trend_scores: { Args: never; Returns: undefined }
      create_community_comment: {
        Args: { p_body: string; p_post_id: string }
        Returns: string
      }
      create_community_post: {
        Args: { p_body: string; p_meme_id?: string; p_title: string }
        Returns: string
      }
      extract_chosung: { Args: { input: string }; Returns: string }
      fail_affiliate_sync: {
        Args: { error_code: string; run_id: string }
        Returns: undefined
      }
      file_report: {
        Args: {
          p_reason: string
          p_target: Database["public"]["Enums"]["report_target"]
          p_target_id: string
        }
        Returns: string
      }
      gen_short_id: { Args: never; Returns: string }
      get_daily_top_memes: {
        Args: { p_limit?: number }
        Returns: {
          aliases: string[]
          category: Database["public"]["Enums"]["meme_category"]
          caution: string | null
          created_at: string
          description: string
          difficulty: Database["public"]["Enums"]["meme_difficulty"]
          id: string
          lifecycle_status: Database["public"]["Enums"]["lifecycle_status"]
          media_type: Database["public"]["Enums"]["media_type"]
          moderation_status: Database["public"]["Enums"]["moderation_status"]
          origin: string
          origin_year: number | null
          published_at: string | null
          safety_level: Database["public"]["Enums"]["safety_level"]
          sentiment: Database["public"]["Enums"]["meme_sentiment"]
          short_id: string
          slug: string
          submitted_by: string | null
          summary: string
          title: string
          title_chosung: string | null
          trend_score: number
          updated_at: string
          usage_context: Json
          usage_note: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "memes"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      increment_view: {
        Args: { p_meme_id: string; p_session_hash: string }
        Returns: undefined
      }
      has_active_plus: { Args: { p_user_id: string }; Returns: boolean }
      is_operator: { Args: never; Returns: boolean }
      post_comment: {
        Args: { p_body: string; p_meme_id: string; p_parent_id: string }
        Returns: string
      }
      record_affiliate_product_click: {
        Args: { metric_date: string; product_id: string }
        Returns: undefined
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
      register_billing_identity: { Args: never; Returns: Json }
      search_memes: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          aliases: string[]
          category: Database["public"]["Enums"]["meme_category"]
          caution: string | null
          created_at: string
          description: string
          difficulty: Database["public"]["Enums"]["meme_difficulty"]
          id: string
          lifecycle_status: Database["public"]["Enums"]["lifecycle_status"]
          media_type: Database["public"]["Enums"]["media_type"]
          moderation_status: Database["public"]["Enums"]["moderation_status"]
          origin: string
          origin_year: number | null
          published_at: string | null
          safety_level: Database["public"]["Enums"]["safety_level"]
          sentiment: Database["public"]["Enums"]["meme_sentiment"]
          short_id: string
          slug: string
          submitted_by: string | null
          summary: string
          title: string
          title_chosung: string | null
          trend_score: number
          updated_at: string
          usage_context: Json
          usage_note: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "memes"
          isOneToOne: false
          isSetofReturn: true
        }
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
      update_saved_meme: {
        Args: { p_collection: string | null; p_meme_id: string; p_note: string | null }
        Returns: Json
      }
      update_profile_customization: {
        Args: { p_flair: string | null; p_accent: string | null }
        Returns: Json
      }
      fan_out_trend_alerts: { Args: Record<PropertyKey, never>; Returns: number }
      mark_trend_alerts_read: { Args: Record<PropertyKey, never>; Returns: number }
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
