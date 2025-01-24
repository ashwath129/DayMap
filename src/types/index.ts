// Add these new types
export interface LiveItinerarySession {
  id: number;
  group_id: number;
  owner_id: string;
  status: 'active' | 'ended';
  itinerary_data: ItineraryDay[];
  started_at: string;
  ended_at: string | null;
  created_at: string;
}

export interface ItineraryChange {
  id: number;
  session_id: number;
  user_id: string;
  change_type: 'add_day' | 'remove_day' | 'update_day' | 'reorder_days';
  change_data: any;
  created_at: string;
}

// Update existing types
export interface Group {
  id: number;
  name: string;
  created_by: string;
  join_code?: string;
  active_session?: LiveItinerarySession;
} 