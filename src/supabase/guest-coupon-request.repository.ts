import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { GuestCouponRequest } from '../models/guest-coupon-request.model';
import { isSupabaseConfigured } from './supabase';

@Injectable({
  providedIn: 'root'
})
export class GuestCouponRequestRepository {
  private supabaseService = inject(SupabaseService);

  /**
   * Retrieves all guest coupon requests from Supabase
   */
  async getAll(): Promise<GuestCouponRequest[]> {
    if (!isSupabaseConfigured()) {
      return [];
    }
    try {
      const rows = await this.supabaseService.select('guest_coupon_requests');
      return rows.map((r) => this.mapToGuestCouponRequest(r));
    } catch (err) {
      console.error('Supabase get all guest coupon requests failed:', err);
      throw err;
    }
  }

  /**
   * Upsert a single guest coupon request in Supabase
   */
  async upsert(req: GuestCouponRequest): Promise<void> {
    if (!isSupabaseConfigured()) {
      return;
    }
    try {
      const row = this.mapToRow(req);
      const { error } = await this.supabaseService.client
        .from('guest_coupon_requests' as any)
        .upsert(row as any, { onConflict: 'id' });
      if (error) throw error;
    } catch (err) {
      console.error(`Supabase upsert guest coupon request with ID ${req.id} failed:`, err);
      throw err;
    }
  }

  /**
   * Bulk upsert guest coupon requests in Supabase
   */
  async upsertMany(requests: GuestCouponRequest[]): Promise<void> {
    if (!isSupabaseConfigured()) {
      return;
    }
    try {
      if (requests.length === 0) return;
      const rows = requests.map((r) => this.mapToRow(r));
      const { error } = await this.supabaseService.client
        .from('guest_coupon_requests' as any)
        .upsert(rows as any, { onConflict: 'id' });
      if (error) throw error;
    } catch (err) {
      console.error('Supabase bulk upsert guest coupon requests failed:', err);
      throw err;
    }
  }

  /**
   * Delete a single guest coupon request from Supabase
   */
  async delete(id: string): Promise<void> {
    if (!isSupabaseConfigured()) {
      return;
    }
    try {
      const { error } = await this.supabaseService.client
        .from('guest_coupon_requests' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    } catch (err) {
      console.error(`Supabase delete guest coupon request with ID ${id} failed:`, err);
      throw err;
    }
  }

  /**
   * Delete any guest coupon requests not present in the provided list of active IDs
   */
  async deleteManyNotIn(activeIds: string[]): Promise<void> {
    if (!isSupabaseConfigured()) {
      return;
    }
    try {
      if (activeIds.length === 0) {
        const { error } = await this.supabaseService.client
          .from('guest_coupon_requests' as any)
          .delete()
          .neq('id', '');
        if (error) throw error;
        return;
      }
      const { error } = await this.supabaseService.client
        .from('guest_coupon_requests' as any)
        .delete()
        .not('id', 'in', `(${activeIds.join(',')})`);
      if (error) throw error;
    } catch (err) {
      console.error('Supabase delete guest coupon requests not in active list failed:', err);
      throw err;
    }
  }

  /**
   * Helper to map a database row structure (snake_case) to the GuestCouponRequest interface
   */
  mapToGuestCouponRequest(row: any): GuestCouponRequest {
    return {
      id: row.id,
      employeeId: Number(row.employee_id),
      employeeName: row.employee_name,
      guestName: row.guest_name,
      guestCompany: row.guest_company,
      couponType: row.coupon_type,
      status: row.status,
      requestDate: row.request_date,
      decisionDate: row.decision_date || undefined,
      adminId: row.admin_id !== null ? Number(row.admin_id) : undefined,
      rejectionReason: row.rejection_reason || undefined,
      generatedCouponId: row.generated_coupon_id || undefined,
      requestedBy: row.requested_by || undefined,
      employeeDecisionDate: row.employee_decision_date || undefined,
      employeeApprovedBy: row.employee_approved_by !== null ? Number(row.employee_approved_by) : undefined,
      employeeRejectedReason: row.employee_rejected_reason || undefined,
      servedDate: row.served_date || undefined
    };
  }

  /**
   * Helper to map a GuestCouponRequest interface to the database row structure (snake_case)
   */
  private mapToRow(req: GuestCouponRequest): any {
    return {
      id: req.id,
      employee_id: req.employeeId,
      employee_name: req.employeeName,
      guest_name: req.guestName,
      guest_company: req.guestCompany,
      coupon_type: req.couponType,
      status: req.status,
      request_date: req.requestDate,
      decision_date: req.decisionDate || null,
      admin_id: req.adminId || null,
      rejection_reason: req.rejectionReason || null,
      generated_coupon_id: req.generatedCouponId || null,
      requested_by: req.requestedBy || null,
      employee_decision_date: req.employeeDecisionDate || null,
      employee_approved_by: req.employeeApprovedBy || null,
      employee_rejected_reason: req.employeeRejectedReason || null,
      served_date: req.servedDate || null
    };
  }
}
