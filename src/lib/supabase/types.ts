// ============================================================================
// Hand-written types matching supabase/migrations/0001_init_schema.sql.
// In a later milestone these can be replaced by `supabase gen types
// typescript` output — kept hand-written for now since this sandbox has no
// network access to run the Supabase CLI against a live project.
// ============================================================================

export interface Database {
  public: {
    Tables: {
      states: {
        Row: {
          id: string;
          name: string;
          code: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["states"]["Row"]> & { name: string; code: string };
        Update: Partial<Database["public"]["Tables"]["states"]["Row"]>;
      };
      districts: {
        Row: {
          id: string;
          state_id: string;
          name: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["districts"]["Row"]> & {
          state_id: string;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["districts"]["Row"]>;
      };
      commodities: {
        Row: {
          id: string;
          name: string;
          category: string | null;
          unit: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["commodities"]["Row"]> & { name: string };
        Update: Partial<Database["public"]["Tables"]["commodities"]["Row"]>;
      };
      markets: {
        Row: {
          id: string;
          name: string;
          state_id: string;
          district_id: string;
          latitude: number | null;
          longitude: number | null;
          market_type: "APMC" | "eNAM" | "Local Market";
          status: "Open" | "Busy" | "Closed";
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["markets"]["Row"]> & {
          name: string;
          state_id: string;
          district_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["markets"]["Row"]>;
      };
      market_prices: {
        Row: {
          id: string;
          market_id: string;
          commodity_id: string;
          price_min: number;
          price_max: number;
          modal_price: number;
          arrival_quantity: number | null;
          price_date: string;
          source: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["market_prices"]["Row"]> & {
          market_id: string;
          commodity_id: string;
          price_min: number;
          price_max: number;
          modal_price: number;
          price_date: string;
        };
        Update: Partial<Database["public"]["Tables"]["market_prices"]["Row"]>;
      };
      procurement_centres: {
        Row: {
          id: string;
          name: string;
          state_id: string;
          district_id: string;
          latitude: number | null;
          longitude: number | null;
          status: "Open" | "Busy" | "Closed";
          daily_capacity: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["procurement_centres"]["Row"]> & {
          name: string;
          state_id: string;
          district_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["procurement_centres"]["Row"]>;
      };
      procurement_prices: {
        Row: {
          id: string;
          procurement_centre_id: string;
          commodity_id: string;
          procurement_price: number;
          effective_date: string;
          source: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["procurement_prices"]["Row"]> & {
          procurement_centre_id: string;
          commodity_id: string;
          procurement_price: number;
          effective_date: string;
        };
        Update: Partial<Database["public"]["Tables"]["procurement_prices"]["Row"]>;
      };
      queue_records: {
        Row: {
          id: string;
          procurement_centre_id: string;
          recorded_at: string;
          queue_size: number;
          arrivals_per_hour: number | null;
          processing_capacity: number | null;
          actual_wait_minutes: number | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["queue_records"]["Row"]> & {
          procurement_centre_id: string;
          queue_size: number;
        };
        Update: Partial<Database["public"]["Tables"]["queue_records"]["Row"]>;
      };
      farmers: {
        Row: {
          id: string;
          display_name: string;
          phone: string | null;
          location: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["farmers"]["Row"]> & {
          display_name: string;
        };
        Update: Partial<Database["public"]["Tables"]["farmers"]["Row"]>;
      };
      token_counters: {
        Row: {
          procurement_centre_id: string;
          day: string;
          last_value: number;
        };
        Insert: Database["public"]["Tables"]["token_counters"]["Row"];
        Update: Partial<Database["public"]["Tables"]["token_counters"]["Row"]>;
      };
      queue_entries: {
        Row: {
          id: string;
          token: string;
          procurement_centre_id: string;
          farmer_id: string;
          commodity_name: string;
          quantity_quintals: number;
          status:
            | "WAITING"
            | "ACCEPTED"
            | "HOLD"
            | "PROCESSING"
            | "DONE"
            | "CANCELLED"
            | "NO_SHOW";
          position: number;
          estimated_wait_minutes: number | null;
          joined_at: string;
          accepted_at: string | null;
          processing_started_at: string | null;
          completed_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["queue_entries"]["Row"]> & {
          token: string;
          procurement_centre_id: string;
          farmer_id: string;
          commodity_name: string;
          quantity_quintals: number;
          position: number;
        };
        Update: Partial<Database["public"]["Tables"]["queue_entries"]["Row"]>;
      };
      notifications: {
        Row: {
          id: string;
          queue_entry_id: string;
          message: string;
          kind: "info" | "success" | "warning" | "action";
          event_key: string | null;
          created_at: string;
          read_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["notifications"]["Row"]> & {
          queue_entry_id: string;
          message: string;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Row"]>;
      };
      processing_records: {
        Row: {
          id: string;
          procurement_centre_id: string;
          queue_entry_id: string | null;
          commodity_name: string | null;
          quantity_quintals: number | null;
          started_at: string;
          completed_at: string;
          duration_minutes: number;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["processing_records"]["Row"]> & {
          procurement_centre_id: string;
          started_at: string;
          completed_at: string;
          duration_minutes: number;
        };
        Update: Partial<Database["public"]["Tables"]["processing_records"]["Row"]>;
      };
    };
    Functions: {
      join_centre_queue: {
        Args: {
          p_centre_id: string;
          p_display_name: string;
          p_phone: string;
          p_location: string;
          p_commodity_name: string;
          p_quantity: number;
        };
        Returns: {
          entry_id: string;
          token: string;
          position: number;
          estimated_wait_minutes: number;
          status: string;
          centre_name: string;
        };
      };
      admin_queue_action: {
        Args: {
          p_entry_id: string;
          p_action: string;
        };
        Returns: {
          entry_id: string;
          token: string;
          status: string;
          position: number;
          estimated_wait_minutes: number | null;
        };
      };
      average_processing_minutes: {
        Args: { p_centre_id: string };
        Returns: number;
      };
      recalculate_centre_queue: {
        Args: { p_centre_id: string };
        Returns: undefined;
      };
      next_token: {
        Args: { p_centre_id: string };
        Returns: string;
      };
    };
  };
}

