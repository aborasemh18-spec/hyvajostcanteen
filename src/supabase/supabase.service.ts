import { Injectable } from '@angular/core';
import { supabase } from './supabase';
import { Database } from './database.types';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type TableName = keyof Database['public']['Tables'];

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  public readonly client = supabase;

  /**
   * Generic select query from a table
   * @param table Database table name
   * @param query Select columns string (default '*')
   * @param filters Optional callback function to chain additional modifiers (eq, order, limit, etc.)
   */
  async select<T extends TableName>(
    table: T,
    query: string = '*',
    filters?: (queryBuilder: any) => any
  ): Promise<Database['public']['Tables'][T]['Row'][]> {
    const allRows: Database['public']['Tables'][T]['Row'][] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const from = page * pageSize;
      const to = from + pageSize - 1;

      let q = this.client.from(table).select(query).range(from, to);
      if (filters) {
        q = filters(q);
      }

      const { data, error } = await q;
      if (error) {
        throw error;
      }

      if (!data || data.length === 0) {
        hasMore = false;
      } else {
        allRows.push(...(data as any as Database['public']['Tables'][T]['Row'][]));
        if (data.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      }
    }

    return allRows;
  }

  /**
   * Generic insert into a table
   * @param table Database table name
   * @param rows Row or array of rows to insert
   */
  async insert<T extends TableName>(
    table: T,
    rows: Database['public']['Tables'][T]['Insert'] | Database['public']['Tables'][T]['Insert'][]
  ): Promise<Database['public']['Tables'][T]['Row'][]> {
    const { data, error } = await this.client
      .from(table)
      .insert(rows as any)
      .select();
    if (error) {
      throw error;
    }
    return data as any as Database['public']['Tables'][T]['Row'][];
  }

  /**
   * Generic update into a table matched on criteria
   * @param table Database table name
   * @param values Values object to update
   * @param match Criteria to match
   */
  async update<T extends TableName>(
    table: T,
    values: Database['public']['Tables'][T]['Update'],
    match: Partial<Database['public']['Tables'][T]['Row']>
  ): Promise<Database['public']['Tables'][T]['Row'][]> {
    const { data, error } = await this.client
      .from(table)
      .update(values as any)
      .match(match as any)
      .select();
    if (error) {
      throw error;
    }
    return data as any as Database['public']['Tables'][T]['Row'][];
  }

  /**
   * Generic delete from a table matched on criteria
   * @param table Database table name
   * @param match Criteria to match
   */
  async delete<T extends TableName>(
    table: T,
    match: Partial<Database['public']['Tables'][T]['Row']>
  ): Promise<Database['public']['Tables'][T]['Row'][]> {
    const { data, error } = await this.client
      .from(table)
      .delete()
      .match(match as any)
      .select();
    if (error) {
      throw error;
    }
    return data as any as Database['public']['Tables'][T]['Row'][];
  }

  /**
   * Remote Procedure Call wrapper
   * @param functionName Name of SQL function in database
   * @param args Function arguments object
   */
  async rpc(
    functionName: string,
    args?: any
  ): Promise<any> {
    const { data, error } = await (this.client as any).rpc(functionName, args);
    if (error) {
      throw error;
    }
    return data;
  }

  /**
   * Generic Realtime subscriber for Postgres Changes
   * @param table Database table name
   * @param event Realtime event filter ('INSERT', 'UPDATE', 'DELETE', or '*')
   * @param callback Callback fired when change event occurs
   * @returns RealtimeChannel subscription reference
   */
  realtime<T extends TableName>(
    table: T,
    event: 'INSERT' | 'UPDATE' | 'DELETE' | '*',
    callback: (payload: RealtimePostgresChangesPayload<Database['public']['Tables'][T]['Row']>) => void,
    filter?: string
  ): RealtimeChannel {
    const channelName = `${table}-changes-${Math.random().toString(36).substring(2, 9)}`;
    const channel = this.client
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: event,
          schema: 'public',
          table: table,
          filter: filter
        },
        (payload) => {
          callback(payload as any);
        }
      )
      .subscribe();

    return channel;
  }
}
