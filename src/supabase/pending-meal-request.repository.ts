import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { PendingMealRequest } from '../models/pending-meal-request.model';
import { isSupabaseConfigured } from './supabase';

@Injectable({
  providedIn: 'root'
})
export class PendingMealRequestRepository {
  private supabaseService = inject(SupabaseService);

  /**
   * Retrieves all pending meal requests from Supabase
   */
  async getAll(): Promise<PendingMealRequest[]> {
    if (!isSupabaseConfigured()) {
      return [];
    }
    try {
      const rows = await this.supabaseService.select('pending_meal_requests');
      return rows.map((r) => this.mapToPendingMealRequest(r));
    } catch (err) {
      console.error('Supabase get all pending meal requests failed:', err);
      throw err;
    }
  }

  /**
   * Upsert a single pending meal request in Supabase
   */
  async upsert(req: PendingMealRequest): Promise<void> {
    if (!isSupabaseConfigured()) {
      return;
    }
    try {
      const row = this.mapToRow(req);
      const { error } = await this.supabaseService.client
        .from('pending_meal_requests' as any)
        .upsert(row as any);
      if (error) throw error;
    } catch (err) {
      console.error(`Supabase upsert pending meal request with ID ${req.requestId} failed:`, err);
      throw err;
    }
  }

  /**
   * Bulk upsert pending meal requests in Supabase
   */
  async upsertMany(requests: PendingMealRequest[]): Promise<void> {
    if (!isSupabaseConfigured()) {
      return;
    }
    try {
      if (requests.length === 0) return;
      const rows = requests.map((r) => this.mapToRow(r));
      const { error } = await this.supabaseService.client
        .from('pending_meal_requests' as any)
        .upsert(rows as any);
      if (error) throw error;
    } catch (err) {
      console.error('Supabase bulk upsert pending meal requests failed:', err);
      throw err;
    }
  }

  /**
   * Delete a single pending meal request from Supabase
   */
  async delete(id: string): Promise<void> {
    if (!isSupabaseConfigured()) {
      return;
    }
    try {
      const { error } = await this.supabaseService.client
        .from('pending_meal_requests' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    } catch (err) {
      console.error(`Supabase delete pending meal request with ID ${id} failed:`, err);
      throw err;
    }
  }

  /**
   * Delete any pending meal requests not present in the provided list of active IDs
   */
  async deleteManyNotIn(activeIds: string[]): Promise<void> {
    if (!isSupabaseConfigured()) {
      return;
    }
    try {
      if (activeIds.length === 0) {
        const { error } = await this.supabaseService.client
          .from('pending_meal_requests' as any)
          .delete()
          .neq('id', '');
        if (error) throw error;
        return;
      }
      const { error } = await this.supabaseService.client
        .from('pending_meal_requests' as any)
        .delete()
        .not('id', 'in', `(${activeIds.join(',')})`);
      if (error) throw error;
    } catch (err) {
      console.error('Supabase delete pending meal requests not in active list failed:', err);
      throw err;
    }
  }

  /**
   * Helper to map a database row structure (snake_case) to the PendingMealRequest interface
   */
  mapToPendingMealRequest(row: any): PendingMealRequest {
    return {
      requestId: row.id,
      employeeId: Number(row.employee_id),
      employeeName: row.employee_name,
      mealType: row.meal_type,
      mealDate: row.meal_date,
      status: row.status,
      isCouponAdjusted: !!row.is_coupon_adjusted,
      adjustedCouponId: row.adjusted_coupon_id || undefined,
      adjustmentDate: row.adjustment_date || undefined
    };
  }

  /**
   * Helper to map a PendingMealRequest interface to the database row structure (snake_case)
   */
  private mapToRow(req: PendingMealRequest): any {
    return {
      id: req.requestId,
      employee_id: req.employeeId,
      employee_name: req.employeeName,
      meal_type: req.mealType,
      meal_date: req.mealDate,
      status: req.status,
      is_coupon_adjusted: !!req.isCouponAdjusted,
      adjusted_coupon_id: req.adjustedCouponId || null,
      adjustment_date: req.adjustmentDate || null
    };
  }
}
