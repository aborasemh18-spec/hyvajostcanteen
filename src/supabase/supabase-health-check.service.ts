import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { supabase, setSupabaseActive } from './supabase';

export interface SupabaseHealthStatus {
  connected: boolean;
  authenticated: boolean;
  database: boolean;
  latency: string;
}

@Injectable({
  providedIn: 'root'
})
export class SupabaseHealthCheckService {
  private lastStatus: SupabaseHealthStatus | null = null;

  /**
   * Run the Supabase health check
   */
  async runHealthCheck(): Promise<SupabaseHealthStatus> {
    const url = environment.supabase?.url || '';
    const key = environment.supabase?.anonKey || '';

    const hasCredentials = (
      url !== '' &&
      !url.includes('your-project-id') &&
      key !== '' &&
      !key.includes('your-anon-key-placeholder')
    );

    if (!hasCredentials) {
      const status: SupabaseHealthStatus = {
        connected: false,
        authenticated: false,
        database: false,
        latency: '0 ms'
      };
      this.lastStatus = status;
      setSupabaseActive(false);
      console.log('Database connection status: Supabase is not configured.');
      return status;
    }

    const start = Date.now();
    let connected = false;
    let authenticated = false;
    let database = false;
    let latencyMs = 0;

    try {
      const dbStart = Date.now();
      const { error } = await supabase
        .from('employees')
        .select('id')
        .limit(1);
      
      latencyMs = Date.now() - dbStart;

      if (!error) {
        connected = true;
        authenticated = true;
        database = true;
      } else {
        console.warn('Supabase query failed during health check:', error);
        connected = true;
        if (error.code === '42P01') {
          // relation does not exist
          database = false;
          // relation does not exist means table is missing, but auth is okay
          authenticated = true;
        } else if ((error as any).status === 401 || (error as any).status === 403) {
          authenticated = false;
          database = false;
        } else {
          database = false;
        }
      }
    } catch (err) {
      console.error('Supabase health check connection error:', err);
      connected = false;
      authenticated = false;
      database = false;
      latencyMs = Date.now() - start;
    }

    const status: SupabaseHealthStatus = {
      connected,
      authenticated,
      database,
      latency: `${latencyMs} ms`
    };

    this.lastStatus = status;

    const allPassed = connected && authenticated && database;
    setSupabaseActive(allPassed);

    if (allPassed) {
      console.log(`Database connection status: Supabase is currently active (Latency: ${latencyMs} ms).`);
    } else {
      console.log('Database connection status: Supabase connection or table check failed.');
    }

    return status;
  }

  /**
   * Get the last checked status
   */
  getStatus(): SupabaseHealthStatus | null {
    return this.lastStatus;
  }
}
