import { createClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { Database } from './database.types';

const supabaseUrl = environment.supabase?.url || '';
const supabaseKey = environment.supabase?.anonKey || '';

export const supabase = createClient<Database>(supabaseUrl, supabaseKey);

let supabaseActive = false;

export function setSupabaseActive(active: boolean): void {
  supabaseActive = active;
}

export function isSupabaseConfigured(): boolean {
  const url = environment.supabase?.url || '';
  const key = environment.supabase?.anonKey || '';
  const hasCredentials = (
    url !== '' &&
    !url.includes('your-project-id') &&
    key !== '' &&
    !key.includes('your-anon-key-placeholder')
  );
  return hasCredentials && supabaseActive;
}
