import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { QrCard } from '../models/qr-card.model';
import { isSupabaseConfigured } from './supabase';

@Injectable({
  providedIn: 'root'
})
export class QrCardRepository {
  private supabaseService = inject(SupabaseService);

  /**
   * Retrieves all QR cards from Supabase
   */
  async getAll(): Promise<QrCard[]> {
    if (!isSupabaseConfigured()) {
      return [];
    }
    try {
      const rows = await this.supabaseService.select('qr_cards');
      return rows.map((r) => this.mapToQrCard(r));
    } catch (err) {
      console.error('Supabase get all QR cards failed:', err);
      throw err;
    }
  }

  /**
   * Upsert a single QR card in Supabase
   */
  async upsert(card: QrCard): Promise<void> {
    if (!isSupabaseConfigured()) {
      return;
    }
    try {
      const row = this.mapToRow(card);
      const { error } = await this.supabaseService.client
        .from('qr_cards')
        .upsert(row);
      if (error) throw error;
    } catch (err) {
      console.error(`Supabase upsert QR card ${card.cardCode} failed:`, err);
      throw err;
    }
  }

  /**
   * Bulk upserts QR cards in Supabase
   */
  async upsertMany(cards: QrCard[]): Promise<void> {
    if (!isSupabaseConfigured()) {
      return;
    }
    try {
      if (cards.length === 0) return;
      const rows = cards.map((card) => this.mapToRow(card));
      const { error } = await this.supabaseService.client
        .from('qr_cards')
        .upsert(rows as any);
      if (error) throw error;
    } catch (err) {
      console.error('Supabase bulk upsert QR cards failed:', err);
      throw err;
    }
  }

  /**
   * Deletes a single QR card from Supabase
   */
  async delete(cardCode: string): Promise<void> {
    if (!isSupabaseConfigured()) {
      return;
    }
    try {
      const { error } = await this.supabaseService.client
        .from('qr_cards')
        .delete()
        .eq('card_code', cardCode);
      if (error) throw error;
    } catch (err) {
      console.error(`Supabase delete QR card ${cardCode} failed:`, err);
      throw err;
    }
  }

  /**
   * Deletes any QR cards not present in the provided list of active card codes
   */
  async deleteManyNotIn(activeCardCodes: string[]): Promise<void> {
    if (!isSupabaseConfigured()) {
      return;
    }
    try {
      if (activeCardCodes.length === 0) {
        const { error } = await this.supabaseService.client
          .from('qr_cards')
          .delete()
          .neq('card_code', '');
        if (error) throw error;
        return;
      }
      const { error } = await this.supabaseService.client
        .from('qr_cards')
        .delete()
        .not('card_code', 'in', `(${activeCardCodes.join(',')})`);
      if (error) throw error;
    } catch (err) {
      console.error('Supabase bulk delete QR cards failed:', err);
      throw err;
    }
  }

  private mapToQrCard(row: any): QrCard {
    return {
      cardCode: row.card_code,
      assigned: row.assigned,
      employeeId: row.employee_id !== null ? Number(row.employee_id) : undefined,
      employeeName: row.employee_name !== null ? row.employee_name : undefined,
    };
  }

  private mapToRow(card: QrCard): any {
    return {
      card_code: card.cardCode,
      assigned: card.assigned,
      employee_id: card.employeeId ?? null,
      employee_name: card.employeeName ?? null,
    };
  }
}
