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
      profiles: {
        Row: {
          id: string
          username: string | null
          full_name: string | null
          bio: string | null
          avatar_url: string | null
          date_of_birth: string | null
          gender: 'male' | 'female' | 'other' | null
          location_text: string | null
          church_name: string | null
          interests: string[]
          is_complete: boolean
          is_active: boolean
          is_banned: boolean
          role: 'user' | 'admin'
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          username?: string | null
          full_name?: string | null
          bio?: string | null
          avatar_url?: string | null
          date_of_birth?: string | null
          gender?: 'male' | 'female' | 'other' | null
          location_text?: string | null
          church_name?: string | null
          interests?: string[]
          is_complete?: boolean
          is_active?: boolean
          is_banned?: boolean
          role?: 'user' | 'admin'
          created_at?: string
          updated_at?: string
        }
        Update: {
          username?: string | null
          full_name?: string | null
          bio?: string | null
          avatar_url?: string | null
          date_of_birth?: string | null
          gender?: 'male' | 'female' | 'other' | null
          location_text?: string | null
          church_name?: string | null
          interests?: string[]
          is_complete?: boolean
          is_active?: boolean
          is_banned?: boolean
          updated_at?: string
        }
      }
      daily_verses: {
        Row: {
          id: string
          verse_text: string
          verse_reference: string
          meditation_text: string | null
          background_image_url: string | null
          audio_url: string | null
          date: string
          created_at: string
        }
        Insert: {
          id?: string
          verse_text: string
          verse_reference: string
          meditation_text?: string | null
          background_image_url?: string | null
          audio_url?: string | null
          date: string
          created_at?: string
        }
        Update: {
          verse_text?: string
          verse_reference?: string
          meditation_text?: string | null
          background_image_url?: string | null
          audio_url?: string | null
        }
      }
      reading_streaks: {
        Row: {
          id: string
          user_id: string
          date: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          created_at?: string
        }
        Update: never
      }
      moments: {
        Row: {
          id: string
          user_id: string
          media_url: string
          media_type: 'image' | 'video'
          thumbnail_url: string | null
          caption: string | null
          is_deleted: boolean
          deleted_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          media_url: string
          media_type: 'image' | 'video'
          thumbnail_url?: string | null
          caption?: string | null
          is_deleted?: boolean
          deleted_at?: string | null
          created_at?: string
        }
        Update: {
          caption?: string | null
          is_deleted?: boolean
          deleted_at?: string | null
        }
      }
      moment_comments: {
        Row: {
          id: string
          moment_id: string
          user_id: string
          content: string
          is_deleted: boolean
          created_at: string
        }
        Insert: {
          id?: string
          moment_id: string
          user_id: string
          content: string
          is_deleted?: boolean
          created_at?: string
        }
        Update: {
          content?: string
          is_deleted?: boolean
        }
      }
      swipes: {
        Row: {
          id: string
          swiper_id: string
          swiped_id: string
          action: 'like' | 'pass'
          context: string
          created_at: string
        }
        Insert: {
          id?: string
          swiper_id: string
          swiped_id: string
          action: 'like' | 'pass'
          context?: string
          created_at?: string
        }
        Update: never
      }
      matches: {
        Row: {
          id: string
          user1_id: string
          user2_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user1_id: string
          user2_id: string
          created_at?: string
        }
        Update: never
      }
      friend_requests: {
        Row: {
          id: string
          sender_id: string
          receiver_id: string
          status: 'pending' | 'accepted' | 'rejected' | 'cancelled'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          sender_id: string
          receiver_id: string
          status?: 'pending' | 'accepted' | 'rejected' | 'cancelled'
          created_at?: string
          updated_at?: string
        }
        Update: {
          status?: 'pending' | 'accepted' | 'rejected' | 'cancelled'
          updated_at?: string
        }
      }
      friendships: {
        Row: {
          id: string
          user1_id: string
          user2_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user1_id: string
          user2_id: string
          created_at?: string
        }
        Update: never
      }
      conversations: {
        Row: {
          id: string
          type: 'match' | 'friend' | 'group'
          match_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          type: 'match' | 'friend' | 'group'
          match_id?: string | null
          created_at?: string
        }
        Update: never
      }
      conversation_members: {
        Row: {
          id: string
          conversation_id: string
          user_id: string
          joined_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          user_id: string
          joined_at?: string
        }
        Update: never
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          sender_id: string
          content: string
          is_deleted: boolean
          created_at: string
          idempotency_key: string | null
        }
        Insert: {
          id?: string
          conversation_id: string
          sender_id: string
          content: string
          is_deleted?: boolean
          created_at?: string
          idempotency_key?: string | null
        }
        Update: {
          is_deleted?: boolean
        }
      }
      blocks: {
        Row: {
          id: string
          blocker_id: string
          blocked_id: string
          created_at: string
        }
        Insert: {
          id?: string
          blocker_id: string
          blocked_id: string
          created_at?: string
        }
        Update: never
      }
      reports: {
        Row: {
          id: string
          reporter_id: string
          reported_user_id: string | null
          reported_moment_id: string | null
          reason: string
          status: 'pending' | 'reviewed' | 'resolved' | 'dismissed'
          admin_note: string | null
          reviewed_by: string | null
          reviewed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          reporter_id: string
          reported_user_id?: string | null
          reported_moment_id?: string | null
          reason: string
          status?: 'pending' | 'reviewed' | 'resolved' | 'dismissed'
          admin_note?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
        }
        Update: {
          status?: 'pending' | 'reviewed' | 'resolved' | 'dismissed'
          admin_note?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
        }
      }
      audit_logs: {
        Row: {
          id: string
          admin_id: string
          action: string
          target_type: string | null
          target_id: string | null
          details: Json
          created_at: string
        }
        Insert: {
          id?: string
          admin_id: string
          action: string
          target_type?: string | null
          target_id?: string | null
          details?: Json
          created_at?: string
        }
        Update: never
      }
    }
    Views: Record<string, never>
    Functions: {
      check_admin: {
        Args: { user_id: string }
        Returns: boolean
      }
      is_conversation_member: {
        Args: { conv_id: string; check_user_id?: string }
        Returns: boolean
      }
    }
    Enums: Record<string, never>
  }
}

// Helper types
export type Profile = Database['public']['Tables']['profiles']['Row']
export type DailyVerse = Database['public']['Tables']['daily_verses']['Row']
export type ReadingStreak = Database['public']['Tables']['reading_streaks']['Row']
export type Moment = Database['public']['Tables']['moments']['Row']
export type MomentComment = Database['public']['Tables']['moment_comments']['Row']
export type Swipe = Database['public']['Tables']['swipes']['Row']
export type Match = Database['public']['Tables']['matches']['Row']
export type FriendRequest = Database['public']['Tables']['friend_requests']['Row']
export type Friendship = Database['public']['Tables']['friendships']['Row']
export type Conversation = Database['public']['Tables']['conversations']['Row']
export type ConversationMember = Database['public']['Tables']['conversation_members']['Row']
export type Message = Database['public']['Tables']['messages']['Row']
export type Block = Database['public']['Tables']['blocks']['Row']
export type Report = Database['public']['Tables']['reports']['Row']
export type AuditLog = Database['public']['Tables']['audit_logs']['Row']
