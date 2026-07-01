export interface Database {
  public: {
    Tables: {
      contractors: {
        Row: {
          id: number;
          name: string;
          business_name: string;
          contractor_id: string;
          password: string;
          created_at: string;
        };
        Insert: {
          id?: number;
          name: string;
          business_name: string;
          contractor_id: string;
          password: string;
          created_at?: string;
        };
        Update: {
          id?: number;
          name?: string;
          business_name?: string;
          contractor_id?: string;
          password?: string;
          created_at?: string;
        };
      };
      employees: {
        Row: {
          id: number;
          name: string;
          email: string | null;
          employee_id: string;
          password: string;
          role: 'admin' | 'contractual employee' | 'employee' | 'canteen manager';
          department: string | null;
          employee_category: 'Staff' | 'Technician' | null;
          status: 'active' | 'deactivated';
          contractor: string | null;
          permanent_qr_code: string | null;
          assigned_qr_card: string | null;
          last_redeemed_date: string | null;
          last_morning_breakfast_date: string | null;
          last_lunch_date: string | null;
          last_evening_breakfast_date: string | null;
          last_dinner_date: string | null;
          created_at: string;
        };
        Insert: {
          id: number;
          name: string;
          email?: string | null;
          employee_id: string;
          password: string;
          role: 'admin' | 'contractual employee' | 'employee' | 'canteen manager';
          department?: string | null;
          employee_category?: 'Staff' | 'Technician' | null;
          status?: 'active' | 'deactivated';
          contractor?: string | null;
          permanent_qr_code?: string | null;
          assigned_qr_card?: string | null;
          last_redeemed_date?: string | null;
          last_morning_breakfast_date?: string | null;
          last_lunch_date?: string | null;
          last_evening_breakfast_date?: string | null;
          last_dinner_date?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          name?: string;
          email?: string | null;
          employee_id?: string;
          password?: string;
          role?: 'admin' | 'contractual employee' | 'employee' | 'canteen manager';
          department?: string | null;
          employee_category?: 'Staff' | 'Technician' | null;
          status?: 'active' | 'deactivated';
          contractor?: string | null;
          permanent_qr_code?: string | null;
          assigned_qr_card?: string | null;
          last_redeemed_date?: string | null;
          last_morning_breakfast_date?: string | null;
          last_lunch_date?: string | null;
          last_evening_breakfast_date?: string | null;
          last_dinner_date?: string | null;
          created_at?: string;
        };
      };
      coupons: {
        Row: {
          coupon_id: string;
          employee_id: number | null;
          contractor_id: number | null;
          date_issued: string;
          status: 'issued' | 'redeemed' | 'expired';
          redeem_date: string | null;
          redemption_code: string;
          coupon_type: 'Breakfast' | 'Lunch/Dinner' | 'Snacks' | 'Beverage';
          slot: number | null;
          is_guest_coupon: boolean;
          shared_by_employee_id: number | null;
          guest_name: string | null;
          guest_company: string | null;
          batch_id: string | null;
          created_at: string;
        };
        Insert: {
          coupon_id: string;
          employee_id?: number | null;
          contractor_id?: number | null;
          date_issued: string;
          status?: 'issued' | 'redeemed' | 'expired';
          redeem_date?: string | null;
          redemption_code: string;
          coupon_type: 'Breakfast' | 'Lunch/Dinner' | 'Snacks' | 'Beverage';
          slot?: number | null;
          is_guest_coupon?: boolean;
          shared_by_employee_id?: number | null;
          guest_name?: string | null;
          guest_company?: string | null;
          batch_id?: string | null;
          created_at?: string;
        };
        Update: {
          coupon_id?: string;
          employee_id?: number | null;
          contractor_id?: number | null;
          date_issued?: string;
          status?: 'issued' | 'redeemed' | 'expired';
          redeem_date?: string | null;
          redemption_code?: string;
          coupon_type?: 'Breakfast' | 'Lunch/Dinner' | 'Snacks' | 'Beverage';
          slot?: number | null;
          is_guest_coupon?: boolean;
          shared_by_employee_id?: number | null;
          guest_name?: string | null;
          guest_company?: string | null;
          batch_id?: string | null;
          created_at?: string;
        };
      };
      qr_cards: {
        Row: {
          card_code: string;
          assigned: boolean;
          employee_id: number | null;
          employee_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          card_code: string;
          assigned?: boolean;
          employee_id?: number | null;
          employee_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          card_code?: string;
          assigned?: boolean;
          employee_id?: number | null;
          employee_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      guest_coupon_requests: {
        Row: {
          id: string;
          employee_id: number;
          employee_name: string;
          guest_name: string;
          guest_company: string;
          coupon_type: 'Breakfast' | 'Lunch/Dinner' | 'Snacks' | 'Beverage';
          status: 'pending_employee' | 'pending_admin' | 'approved' | 'rejected' | 'redeemed';
          request_date: string;
          decision_date: string | null;
          admin_id: number | null;
          rejection_reason: string | null;
          generated_coupon_id: string | null;
          requested_by: 'employee' | 'canteen_manager' | null;
          employee_decision_date: string | null;
          employee_approved_by: number | null;
          employee_rejected_reason: string | null;
          served_date: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          employee_id: number;
          employee_name: string;
          guest_name: string;
          guest_company: string;
          coupon_type: 'Breakfast' | 'Lunch/Dinner' | 'Snacks' | 'Beverage';
          status?: 'pending_employee' | 'pending_admin' | 'approved' | 'rejected' | 'redeemed';
          request_date: string;
          decision_date?: string | null;
          admin_id?: number | null;
          rejection_reason?: string | null;
          generated_coupon_id?: string | null;
          requested_by?: 'employee' | 'canteen_manager' | null;
          employee_decision_date?: string | null;
          employee_approved_by?: number | null;
          employee_rejected_reason?: string | null;
          served_date?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          employee_id?: number;
          employee_name?: string;
          guest_name?: string;
          guest_company?: string;
          coupon_type?: 'Breakfast' | 'Lunch/Dinner' | 'Snacks' | 'Beverage';
          status?: 'pending_employee' | 'pending_admin' | 'approved' | 'rejected' | 'redeemed';
          request_date?: string;
          decision_date?: string | null;
          admin_id?: number | null;
          rejection_reason?: string | null;
          generated_coupon_id?: string | null;
          requested_by?: 'employee' | 'canteen_manager' | null;
          employee_decision_date?: string | null;
          employee_approved_by?: number | null;
          employee_rejected_reason?: string | null;
          served_date?: string | null;
          created_at?: string;
        };
      };
      pending_meal_requests: {
        Row: {
          id: string;
          employee_id: number;
          employee_name: string;
          meal_type: 'morning' | 'lunch' | 'evening' | 'dinner';
          meal_date: string;
          status: 'pending' | 'completed';
          is_coupon_adjusted: boolean;
          adjusted_coupon_id: string | null;
          adjustment_date: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          employee_id: number;
          employee_name: string;
          meal_type: 'morning' | 'lunch' | 'evening' | 'dinner';
          meal_date: string;
          status: 'pending' | 'completed';
          is_coupon_adjusted?: boolean;
          adjusted_coupon_id?: string | null;
          adjustment_date?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          employee_id?: number;
          employee_name?: string;
          meal_type?: 'morning' | 'lunch' | 'evening' | 'dinner';
          meal_date?: string;
          status?: 'pending' | 'completed';
          is_coupon_adjusted?: boolean;
          adjusted_coupon_id?: string | null;
          adjustment_date?: string | null;
          created_at?: string;
        };
      };
      menus: {
        Row: {
          id: string;
          date: string;
          breakfast_menu: string;
          lunch_dinner_menu: string;
          created_at: string;
        };
        Insert: {
          id: string;
          date: string;
          breakfast_menu: string;
          lunch_dinner_menu: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          date?: string;
          breakfast_menu?: string;
          lunch_dinner_menu?: string;
          created_at?: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          employee_id: number;
          message: string;
          type: 'new_coupon' | 'system' | 'guest_pass_request';
          is_read: boolean;
          created_at: string;
          related_request_id: string | null;
          requester_employee_id: number | null;
          related_coupon_id: string | null;
        };
        Insert: {
          id: string;
          employee_id: number;
          message: string;
          type: 'new_coupon' | 'system' | 'guest_pass_request';
          is_read?: boolean;
          created_at: string;
          related_request_id?: string | null;
          requester_employee_id?: number | null;
          related_coupon_id?: string | null;
        };
        Update: {
          id?: string;
          employee_id?: number;
          message?: string;
          type?: 'new_coupon' | 'system' | 'guest_pass_request';
          is_read?: boolean;
          created_at?: string;
          related_request_id?: string | null;
          requester_employee_id?: number | null;
          related_coupon_id?: string | null;
        };
      };
      punch_events: {
        Row: {
          id: string;
          employee_id: number;
          result_type: 'redeemed' | 'already_redeemed' | 'not_available' | 'error';
          message: string;
          created_at: string;
        };
        Insert: {
          id: string;
          employee_id: number;
          result_type: 'redeemed' | 'already_redeemed' | 'not_available' | 'error';
          message: string;
          created_at: string;
        };
        Update: {
          id?: string;
          employee_id?: number;
          result_type?: 'redeemed' | 'already_redeemed' | 'not_available' | 'error';
          message?: string;
          created_at?: string;
        };
      };
    };
  };
}
