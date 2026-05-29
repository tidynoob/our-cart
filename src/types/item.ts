/**
 * Item interface matching the Supabase `items` table schema.
 * All field names use snake_case to match database column names.
 */
export interface Item {
  id: string
  list_id: string
  name: string
  quantity: string | null
  category: string | null
  checked: boolean
  added_by: string | null
  user_id: string | null
  created_at: string
}
