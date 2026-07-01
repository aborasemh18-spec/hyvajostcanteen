import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Contractor } from '../models/contractor.model';
import { isSupabaseConfigured } from './supabase';

@Injectable({
  providedIn: 'root'
})
export class ContractorRepository {
  private supabaseService = inject(SupabaseService);

  /**
   * Retrieves all contractors from Supabase
   */
  async getAll(): Promise<Contractor[]> {
    if (!isSupabaseConfigured()) {
      return [];
    }
    try {
      const rows = await this.supabaseService.select('contractors');
      return rows.map((r) => this.mapToContractor(r));
    } catch (err) {
      console.error('Supabase get all contractors failed:', err);
      throw err;
    }
  }

  /**
   * Upsert a single contractor in Supabase
   */
  async upsert(contractor: Contractor): Promise<void> {
    if (!isSupabaseConfigured()) {
      return;
    }
    try {
      const row = this.mapToRow(contractor);
      const { error } = await this.supabaseService.client
        .from('contractors')
        .upsert(row);
      if (error) throw error;
    } catch (err) {
      console.error(`Supabase upsert contractor with ID ${contractor.id} failed:`, err);
      throw err;
    }
  }

  /**
   * Bulk upserts contractors in Supabase
   */
  async upsertMany(contractors: Contractor[]): Promise<void> {
    if (!isSupabaseConfigured()) {
      return;
    }
    try {
      if (contractors.length === 0) return;
      const rows = contractors.map((c) => this.mapToRow(c));
      const { error } = await this.supabaseService.client
        .from('contractors')
        .upsert(rows as any);
      if (error) throw error;
    } catch (err) {
      console.error('Supabase bulk upsert contractors failed:', err);
      throw err;
    }
  }

  /**
   * Deletes a single contractor from Supabase
   */
  async delete(id: number): Promise<void> {
    if (!isSupabaseConfigured()) {
      return;
    }
    try {
      const { error } = await this.supabaseService.client
        .from('contractors')
        .delete()
        .eq('id', id);
      if (error) throw error;
    } catch (err) {
      console.error(`Supabase delete contractor with ID ${id} failed:`, err);
      throw err;
    }
  }

  /**
   * Deletes any contractors not present in the provided list of active IDs
   */
  async deleteManyNotIn(activeIds: number[]): Promise<void> {
    if (!isSupabaseConfigured()) {
      return;
    }
    try {
      if (activeIds.length === 0) {
        const { error } = await this.supabaseService.client
          .from('contractors')
          .delete()
          .neq('id', 0);
        if (error) throw error;
        return;
      }
      const { error } = await this.supabaseService.client
        .from('contractors')
        .delete()
        .not('id', 'in', `(${activeIds.join(',')})`);
      if (error) throw error;
    } catch (err) {
      console.error('Supabase delete contractors not in active list failed:', err);
      throw err;
    }
  }

  /**
   * Helper to map a Contractor interface to the database row structure (snake_case)
   */
  private mapToRow(contractor: Contractor): any {
    return {
      id: contractor.id,
      name: contractor.name,
      business_name: contractor.businessName,
      contractor_id: contractor.contractorId,
      password: contractor.password
    };
  }

  /**
   * Helper to map a database row structure (snake_case) to the Contractor interface
   */
  private mapToContractor(row: any): Contractor {
    return {
      id: Number(row.id),
      name: row.name,
      businessName: row.business_name,
      contractorId: row.contractor_id,
      password: row.password
    };
  }
}
