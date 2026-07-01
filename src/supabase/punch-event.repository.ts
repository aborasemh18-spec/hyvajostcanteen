import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { PunchEvent } from '../services/data.service';
import { isSupabaseConfigured } from './supabase';

@Injectable({
  providedIn: 'root'
})
export class PunchEventRepository {
  private supabaseService = inject(SupabaseService);

  /**
   * Retrieves all punch events from Supabase (or recent ones if requested)
   */
  async getAll(): Promise<PunchEvent[]> {
    if (!isSupabaseConfigured()) {
      return [];
    }
    try {
      const rows = await this.supabaseService.select('punch_events');
      return rows.map((r) => this.mapToPunchEvent(r));
    } catch (err) {
      console.error('Supabase get all punch events failed:', err);
      throw err;
    }
  }

  /**
   * Upsert a single punch event in Supabase
   */
  async upsert(event: PunchEvent): Promise<void> {
    if (!isSupabaseConfigured()) {
      return;
    }
    try {
      const row = this.mapToRow(event);
      const { error } = await this.supabaseService.client
        .from('punch_events' as any)
        .upsert(row as any);
      if (error) throw error;
    } catch (err) {
      console.error(`Supabase upsert punch event with ID ${event.id} failed:`, err);
      throw err;
    }
  }

  /**
   * Bulk upsert punch events in Supabase
   */
  async upsertMany(events: PunchEvent[]): Promise<void> {
    if (!isSupabaseConfigured()) {
      return;
    }
    try {
      if (events.length === 0) return;
      const rows = events.map((e) => this.mapToRow(e));
      const { error } = await this.supabaseService.client
        .from('punch_events' as any)
        .upsert(rows as any);
      if (error) throw error;
    } catch (err) {
      console.error('Supabase bulk upsert punch events failed:', err);
      throw err;
    }
  }

  /**
   * Delete a single punch event from Supabase
   */
  async delete(id: string): Promise<void> {
    if (!isSupabaseConfigured()) {
      return;
    }
    try {
      const { error } = await this.supabaseService.client
        .from('punch_events' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    } catch (err) {
      console.error(`Supabase delete punch event with ID ${id} failed:`, err);
      throw err;
    }
  }

  /**
   * Delete any punch events not present in the provided list of active IDs
   */
  async deleteManyNotIn(activeIds: string[]): Promise<void> {
    if (!isSupabaseConfigured()) {
      return;
    }
    try {
      if (activeIds.length === 0) {
        const { error } = await this.supabaseService.client
          .from('punch_events' as any)
          .delete()
          .neq('id', '');
        if (error) throw error;
        return;
      }
      const { error } = await this.supabaseService.client
        .from('punch_events' as any)
        .delete()
        .not('id', 'in', `(${activeIds.join(',')})`);
      if (error) throw error;
    } catch (err) {
      console.error('Supabase delete punch events not in active list failed:', err);
      throw err;
    }
  }

  /**
   * Helper to map a database row structure (snake_case) to the PunchEvent interface
   */
  mapToPunchEvent(row: any): PunchEvent {
    return {
      id: row.id,
      employeeId: Number(row.employee_id),
      resultType: row.result_type as PunchEvent['resultType'],
      message: row.message,
      createdAt: row.created_at
    };
  }

  /**
   * Helper to map a PunchEvent interface to the database row structure (snake_case)
   */
  private mapToRow(event: PunchEvent): any {
    return {
      id: event.id,
      employee_id: event.employeeId,
      result_type: event.resultType,
      message: event.message,
      created_at: event.createdAt
    };
  }
}
