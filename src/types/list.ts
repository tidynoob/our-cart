/**
 * List interface matching the Supabase `lists` table schema.
 * All field names use snake_case to match database column names.
 */
export interface List {
  id: string
  name: string
  share_code: string
  owner_id: string
  created_at: string
}
