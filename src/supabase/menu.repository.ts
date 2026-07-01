import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { DailyMenu } from '../models/menu.model';
import { isSupabaseConfigured } from './supabase';

@Injectable({
  providedIn: 'root'
})
export class MenuRepository {
  private supabaseService = inject(SupabaseService);

  /**
   * Retrieves all menus from Supabase
   */
  async getAll(): Promise<DailyMenu[]> {
    if (!isSupabaseConfigured()) {
      return [];
    }
    try {
      const rows = await this.supabaseService.select('menus');
      return rows.map((r) => this.mapToDailyMenu(r));
    } catch (err) {
      console.error('Supabase get all menus failed:', err);
      throw err;
    }
  }

  /**
   * Upsert a single menu in Supabase
   */
  async upsert(menu: DailyMenu): Promise<void> {
    if (!isSupabaseConfigured()) {
      return;
    }
    try {
      const row = this.mapToRow(menu);
      const { error } = await this.supabaseService.client
        .from('menus' as any)
        .upsert(row as any);
      if (error) throw error;
    } catch (err) {
      console.error(`Supabase upsert menu with ID ${menu.id} failed:`, err);
      throw err;
    }
  }

  /**
   * Bulk upsert menus in Supabase
   */
  async upsertMany(menus: DailyMenu[]): Promise<void> {
    if (!isSupabaseConfigured()) {
      return;
    }
    try {
      if (menus.length === 0) return;
      const rows = menus.map((m) => this.mapToRow(m));
      const { error } = await this.supabaseService.client
        .from('menus' as any)
        .upsert(rows as any);
      if (error) throw error;
    } catch (err) {
      console.error('Supabase bulk upsert menus failed:', err);
      throw err;
    }
  }

  /**
   * Delete a single menu from Supabase
   */
  async delete(id: string): Promise<void> {
    if (!isSupabaseConfigured()) {
      return;
    }
    try {
      const { error } = await this.supabaseService.client
        .from('menus' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    } catch (err) {
      console.error(`Supabase delete menu with ID ${id} failed:`, err);
      throw err;
    }
  }

  /**
   * Delete any menus not present in the provided list of active IDs
   */
  async deleteManyNotIn(activeIds: string[]): Promise<void> {
    if (!isSupabaseConfigured()) {
      return;
    }
    try {
      if (activeIds.length === 0) {
        const { error } = await this.supabaseService.client
          .from('menus' as any)
          .delete()
          .neq('id', '');
        if (error) throw error;
        return;
      }
      const { error } = await this.supabaseService.client
        .from('menus' as any)
        .delete()
        .not('id', 'in', `(${activeIds.join(',')})`);
      if (error) throw error;
    } catch (err) {
      console.error('Supabase delete menus not in active list failed:', err);
      throw err;
    }
  }

  /**
   * Helper to map a database row structure (snake_case) to the DailyMenu interface
   */
  mapToDailyMenu(row: any): DailyMenu {
    return {
      id: row.id,
      date: row.date,
      breakfastMenu: row.breakfast_menu,
      lunchDinnerMenu: row.lunch_dinner_menu
    };
  }

  /**
   * Helper to map a DailyMenu interface to the database row structure (snake_case)
   */
  private mapToRow(menu: DailyMenu): any {
    return {
      id: menu.id,
      date: menu.date,
      breakfast_menu: menu.breakfastMenu,
      lunch_dinner_menu: menu.lunchDinnerMenu
    };
  }
}
