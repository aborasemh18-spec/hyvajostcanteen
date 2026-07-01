import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Employee } from '../models/user.model';
import { isSupabaseConfigured } from './supabase';

@Injectable({
  providedIn: 'root'
})
export class EmployeeRepository {
  private supabaseService = inject(SupabaseService);

  /**
   * Retrieves all employees from Supabase
   */
  async getAll(): Promise<Employee[]> {
    if (!isSupabaseConfigured()) {
      return [];
    }
    try {
      const rows = await this.supabaseService.select('employees');
      return rows.map((r) => this.mapToEmployee(r));
    } catch (err) {
      console.error('Supabase get all employees failed:', err);
      throw err;
    }
  }

  /**
   * Upsert a single employee in Supabase
   */
  async upsert(emp: Employee): Promise<void> {
    if (!isSupabaseConfigured()) {
      return;
    }
    try {
      const row = this.mapToRow(emp);
      const { error } = await this.supabaseService.client
        .from('employees')
        .upsert(row);
      if (error) throw error;
    } catch (err) {
      console.error(`Supabase upsert employee with ID ${emp.id} failed:`, err);
      throw err;
    }
  }

  /**
   * Bulk upserts employees in Supabase
   */
  async upsertMany(employees: Employee[]): Promise<void> {
    if (!isSupabaseConfigured()) {
      return;
    }
    try {
      if (employees.length === 0) return;
      const rows = employees.map((emp) => this.mapToRow(emp));
      const { error } = await this.supabaseService.client
        .from('employees')
        .upsert(rows as any);
      if (error) throw error;
    } catch (err) {
      console.error('Supabase bulk upsert employees failed:', err);
      throw err;
    }
  }

  /**
   * Deletes a single employee from Supabase
   */
  async delete(employeeId: number): Promise<void> {
    if (!isSupabaseConfigured()) {
      return;
    }
    try {
      await this.supabaseService.delete('employees', { id: employeeId });
    } catch (err) {
      console.error(`Supabase delete employee with ID ${employeeId} failed:`, err);
      throw err;
    }
  }

  /**
   * Deletes any employees not present in the provided list of active IDs
   */
  async deleteManyNotIn(activeIds: number[]): Promise<void> {
    if (!isSupabaseConfigured()) {
      return;
    }
    try {
      if (activeIds.length === 0) {
        const { error } = await this.supabaseService.client
          .from('employees')
          .delete()
          .neq('id', 0);
        if (error) throw error;
        return;
      }
      const { error } = await this.supabaseService.client
        .from('employees')
        .delete()
        .not('id', 'in', `(${activeIds.join(',')})`);
      if (error) throw error;
    } catch (err) {
      console.error('Supabase delete employees not in active list failed:', err);
      throw err;
    }
  }

  /**
   * Helper to map an Employee interface to the database row structure (snake_case)
   */
  private mapToRow(emp: Employee): any {
    return {
      id: emp.id,
      name: emp.name,
      email: emp.email || null,
      employee_id: emp.employeeId,
      password: emp.password,
      role: emp.role,
      department: emp.department || null,
      employee_category: emp.employeeCategory || null,
      status: emp.status,
      contractor: emp.contractor || null,
      permanent_qr_code: emp.permanentQrCode || null,
      assigned_qr_card: emp.assignedQrCard || null,
      last_redeemed_date: emp.lastRedeemedDate || null,
      last_morning_breakfast_date: emp.lastMorningBreakfastDate || null,
      last_lunch_date: emp.lastLunchDate || null,
      last_evening_breakfast_date: emp.lastEveningBreakfastDate || null,
      last_dinner_date: emp.lastDinnerDate || null
    };
  }

  /**
   * Helper to map a database row structure (snake_case) to the Employee interface
   */
  private mapToEmployee(row: any): Employee {
    return {
      id: Number(row.id),
      name: row.name,
      email: row.email || undefined,
      employeeId: row.employee_id,
      password: row.password,
      role: row.role,
      department: row.department || undefined,
      employeeCategory: row.employee_category || undefined,
      status: row.status,
      contractor: row.contractor || undefined,
      permanentQrCode: row.permanent_qr_code || undefined,
      assignedQrCard: row.assigned_qr_card || undefined,
      lastRedeemedDate: row.last_redeemed_date || undefined,
      lastMorningBreakfastDate: row.last_morning_breakfast_date || undefined,
      lastLunchDate: row.last_lunch_date || undefined,
      lastEveningBreakfastDate: row.last_evening_breakfast_date || undefined,
      lastDinnerDate: row.last_dinner_date || undefined
    };
  }
}
