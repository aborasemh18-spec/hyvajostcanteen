import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class PushNotificationService {
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
  }
}
