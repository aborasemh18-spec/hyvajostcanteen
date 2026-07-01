import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AppNotification } from '../models/notification.model';
import { isSupabaseConfigured } from './supabase';

@Injectable({
  providedIn: 'root'
})
export class NotificationRepository {
  private supabaseService = inject(SupabaseService);

  /**
   * Retrieves all notifications from Supabase
   */
  async getAll(): Promise<AppNotification[]> {
    if (!isSupabaseConfigured()) {
      return [];
    }
    try {
      const rows = await this.supabaseService.select('notifications');
      return rows.map((r) => this.mapToAppNotification(r));
    } catch (err) {
      console.error('Supabase get all notifications failed:', err);
      throw err;
    }
  }

  /**
   * Upsert a single notification in Supabase
   */
  async upsert(notification: AppNotification): Promise<void> {
    if (!isSupabaseConfigured()) {
      return;
    }
    try {
      const row = this.mapToRow(notification);
      const { error } = await this.supabaseService.client
        .from('notifications' as any)
        .upsert(row as any);
      if (error) throw error;
    } catch (err) {
      console.error(`Supabase upsert notification with ID ${notification.id} failed:`, err);
      throw err;
    }
  }

  /**
   * Bulk upsert notifications in Supabase
   */
  async upsertMany(notifications: AppNotification[]): Promise<void> {
    if (!isSupabaseConfigured()) {
      return;
    }
    try {
      if (notifications.length === 0) return;
      const rows = notifications.map((n) => this.mapToRow(n));
      const { error } = await this.supabaseService.client
        .from('notifications' as any)
        .upsert(rows as any);
      if (error) throw error;
    } catch (err) {
      console.error('Supabase bulk upsert notifications failed:', err);
      throw err;
    }
  }

  /**
   * Delete a single notification from Supabase
   */
  async delete(id: string): Promise<void> {
    if (!isSupabaseConfigured()) {
      return;
    }
    try {
      const { error } = await this.supabaseService.client
        .from('notifications' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    } catch (err) {
      console.error(`Supabase delete notification with ID ${id} failed:`, err);
      throw err;
    }
  }

  /**
   * Delete any notifications not present in the provided list of active IDs
   */
  async deleteManyNotIn(activeIds: string[]): Promise<void> {
    if (!isSupabaseConfigured()) {
      return;
    }
    try {
      if (activeIds.length === 0) {
        const { error } = await this.supabaseService.client
          .from('notifications' as any)
          .delete()
          .neq('id', '');
        if (error) throw error;
        return;
      }
      const { error } = await this.supabaseService.client
        .from('notifications' as any)
        .delete()
        .not('id', 'in', `(${activeIds.join(',')})`);
      if (error) throw error;
    } catch (err) {
      console.error('Supabase delete notifications not in active list failed:', err);
      throw err;
    }
  }

  /**
   * Helper to map a database row structure (snake_case) to the AppNotification interface
   */
  mapToAppNotification(row: any): AppNotification {
    return {
      id: row.id,
      employeeId: Number(row.employee_id),
      message: row.message,
      type: row.type,
      isRead: !!row.is_read,
      createdAt: row.created_at,
      relatedRequestId: row.related_request_id || undefined,
      requesterEmployeeId: row.requester_employee_id !== null ? Number(row.requester_employee_id) : undefined,
      relatedCouponId: row.related_coupon_id || undefined
    };
  }

  /**
   * Helper to map an AppNotification interface to the database row structure (snake_case)
   */
  private mapToRow(notification: AppNotification): any {
    return {
      id: notification.id,
      employee_id: notification.employeeId,
      message: notification.message,
      type: notification.type,
      is_read: notification.isRead,
      created_at: notification.createdAt,
      related_request_id: notification.relatedRequestId || null,
      requester_employee_id: notification.requesterEmployeeId || null,
      related_coupon_id: notification.relatedCouponId || null
    };
  }
}
