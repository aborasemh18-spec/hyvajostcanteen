import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Coupon } from '../models/coupon.model';
import { isSupabaseConfigured } from './supabase';

@Injectable({
  providedIn: 'root'
})
export class CouponRepository {
  private supabaseService = inject(SupabaseService);

  /**
   * Retrieves all coupons from Supabase
   */
  async getAll(): Promise<Coupon[]> {
    if (!isSupabaseConfigured()) {
      return [];
    }
    try {
      const rows = await this.supabaseService.select('coupons');
      return rows.map((r) => this.mapToCoupon(r));
    } catch (err) {
      console.error('Supabase get all coupons failed:', err);
      throw err;
    }
  }

  /**
   * Retrieve a single coupon by redemption code from Supabase
   */
  async getByRedemptionCode(code: string): Promise<Coupon | null> {
    if (!isSupabaseConfigured()) {
      return null;
    }
    try {
      const { data, error } = await this.supabaseService.client
        .from('coupons')
        .select('*')
        .eq('redemption_code', code)
        .maybeSingle();

      if (error) throw error;
      return data ? this.mapToCoupon(data) : null;
    } catch (err) {
      console.error(`Supabase get coupon by redemption code ${code} failed:`, err);
      throw err;
    }
  }

  /**
   * Upsert a single coupon in Supabase
   */
  async upsert(coupon: Coupon): Promise<void> {
    if (!isSupabaseConfigured()) {
      return;
    }
    try {
      const row = this.mapToRow(coupon);
      const { error } = await this.supabaseService.client
        .from('coupons')
        .upsert(row);
      if (error) throw error;
    } catch (err) {
      console.error(`Supabase upsert coupon with ID ${coupon.couponId} failed:`, err);
      throw err;
    }
  }

  /**
   * Bulk upserts coupons in Supabase
   */
  async upsertMany(coupons: Coupon[]): Promise<void> {
    if (!isSupabaseConfigured()) {
      return;
    }
    try {
      if (coupons.length === 0) return;
      const rows = coupons.map((c) => this.mapToRow(c));
      const { error } = await this.supabaseService.client
        .from('coupons')
        .upsert(rows as any);
      if (error) throw error;
    } catch (err) {
      console.error('Supabase bulk upsert coupons failed:', err);
      throw err;
    }
  }

  /**
   * Deletes a single coupon from Supabase
   */
  async delete(couponId: string): Promise<void> {
    if (!isSupabaseConfigured()) {
      return;
    }
    try {
      const { error } = await this.supabaseService.client
        .from('coupons')
        .delete()
        .eq('coupon_id', couponId);
      if (error) throw error;
    } catch (err) {
      console.error(`Supabase delete coupon with ID ${couponId} failed:`, err);
      throw err;
    }
  }

  /**
   * Bulk deletes coupons from Supabase by their IDs
   */
  async deleteMany(couponIds: string[]): Promise<void> {
    if (!isSupabaseConfigured()) {
      return;
    }
    try {
      if (couponIds.length === 0) return;
      const { error } = await this.supabaseService.client
        .from('coupons')
        .delete()
        .in('coupon_id', couponIds);
      if (error) throw error;
    } catch (err) {
      console.error('Supabase bulk delete coupons failed:', err);
      throw err;
    }
  }

  /**
   * Deletes any coupons not present in the provided list of active IDs
   */
  async deleteManyNotIn(activeIds: string[]): Promise<void> {
    if (!isSupabaseConfigured()) {
      return;
    }
    try {
      if (activeIds.length === 0) {
        const { error } = await this.supabaseService.client
          .from('coupons')
          .delete()
          .neq('coupon_id', '');
        if (error) throw error;
        return;
      }
      const { error } = await this.supabaseService.client
        .from('coupons')
        .delete()
        .not('coupon_id', 'in', `(${activeIds.join(',')})`);
      if (error) throw error;
    } catch (err) {
      console.error('Supabase delete coupons not in active list failed:', err);
      throw err;
    }
  }

  /**
   * Helper to map a Coupon interface to the database row structure (snake_case)
   */
  private mapToRow(coupon: Coupon): any {
    return {
      coupon_id: coupon.couponId,
      employee_id: coupon.employeeId ?? null,
      contractor_id: coupon.contractorId ?? null,
      date_issued: coupon.dateIssued,
      status: coupon.status,
      redeem_date: coupon.redeemDate,
      redemption_code: coupon.redemptionCode,
      coupon_type: coupon.couponType,
      slot: coupon.slot ?? null,
      is_guest_coupon: coupon.isGuestCoupon ?? false,
      shared_by_employee_id: coupon.sharedByEmployeeId ?? null,
      guest_name: coupon.guestName ?? null,
      guest_company: coupon.guestCompany ?? null,
      batch_id: coupon.batchId ?? null
    };
  }

  /**
   * Helper to map a database row structure (snake_case) to the Coupon interface
   */
  mapToCoupon(row: any): Coupon {
    return {
      couponId: row.coupon_id,
      employeeId: row.employee_id !== null ? Number(row.employee_id) : undefined,
      contractorId: row.contractor_id !== null ? Number(row.contractor_id) : undefined,
      dateIssued: row.date_issued,
      status: row.status as 'issued' | 'redeemed',
      redeemDate: row.redeem_date,
      redemptionCode: row.redemption_code,
      couponType: row.coupon_type as 'Breakfast' | 'Lunch/Dinner' | 'Snacks' | 'Beverage',
      slot: row.slot !== null ? Number(row.slot) : undefined,
      isGuestCoupon: row.is_guest_coupon,
      sharedByEmployeeId: row.shared_by_employee_id !== null ? Number(row.shared_by_employee_id) : undefined,
      guestName: row.guest_name !== null ? row.guest_name : undefined,
      guestCompany: row.guest_company !== null ? row.guest_company : undefined,
      batchId: row.batch_id !== null ? row.batch_id : undefined
    };
  }
}
