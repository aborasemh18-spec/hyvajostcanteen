import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable({
  providedIn: 'root'
})
export class PushNotificationService {
  private supabaseService = inject(SupabaseService);

  constructor() {}

  async sendToEmployee(
    employeeId: number | string,
    title: string,
    body: string,
    data?: Record<string, string>
  ): Promise<void> {
    console.log(`PushNotificationService: sendToEmployee called for employeeId: ${employeeId}, title: ${title}, body: ${body}`);
  }

  async sendToAllEmployees(
    title: string,
    body: string,
    data?: Record<string, string>
  ): Promise<void> {
    console.log(`PushNotificationService: sendToAllEmployees called, title: ${title}, body: ${body}`);
    try {
      const { data, error } = await this.supabaseService.client
        .from('employees')
        .select('fcm_token')
        .not('fcm_token', 'is', null);

      if (error) {
        console.error('Error fetching employees with fcm_token:', error);
        return;
      }

      const employees = data as any[];

      if (!employees || employees.length === 0) {
        console.log('No employees found with an FCM token.');
        return;
      }

      const tokens = employees
        .map(e => (e as any).fcm_token)
        .filter((t): t is string => typeof t === 'string' && t.trim().length > 0);

      if (tokens.length === 0) {
        console.log('No non-empty FCM tokens found.');
        return;
      }

      console.log(`Sending push notifications to ${tokens.length} employees...`);

      const promises = tokens.map(async (token) => {
        try {
          const payload = {
            token,
            title,
            body,
            data: data || {}
          };

          const response = await fetch('/api/sendNotification', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          });

          if (!response.ok) {
            console.error(`sendToAllEmployees: Failed to send to token ${token}, status: ${response.status}`);
          }
        } catch (err) {
          console.error(`sendToAllEmployees: Error sending to token ${token}:`, err);
        }
      });

      await Promise.all(promises);
      console.log('Finished sending all push notifications.');
    } catch (err) {
      console.error('sendToAllEmployees: unexpected error:', err);
    }
  }
}
