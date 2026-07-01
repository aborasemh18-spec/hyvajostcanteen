import { Injectable, signal, computed, inject, OnDestroy } from '@angular/core';
import { Employee } from '../models/user.model';
import { Coupon } from '../models/coupon.model';
import { AppNotification } from '../models/notification.model';
import { EmailService } from './email.service';
import { Contractor } from '../models/contractor.model';
import { DailyMenu } from '../models/menu.model';
import { GuestCouponRequest } from '../models/guest-coupon-request.model';
import { QrCard } from '../models/qr-card.model';
import { PendingMealRequest } from '../models/pending-meal-request.model';
import { PushNotificationService } from './push-notification.service';
import { EmployeeRepository } from '../supabase/employee.repository';
import { QrCardRepository } from '../supabase/qr-card.repository';
import { ContractorRepository } from '../supabase/contractor.repository';
import { CouponRepository } from '../supabase/coupon.repository';
import { GuestCouponRequestRepository } from '../supabase/guest-coupon-request.repository';
import { NotificationRepository } from '../supabase/notification.repository';
import { PendingMealRequestRepository } from '../supabase/pending-meal-request.repository';
import { MenuRepository } from '../supabase/menu.repository';
import { PunchEventRepository } from '../supabase/punch-event.repository';
import { SupabaseService } from '../supabase/supabase.service';
import { isSupabaseConfigured } from '../supabase/supabase';

// 🔁 Device bridge → punchEvents साठी type
export interface PunchEvent {
  id: string;
  employeeId: number;
  resultType: 'redeemed' | 'already_redeemed' | 'not_available' | 'error';
  message: string;
  createdAt: string; // ISO string
}

@Injectable({
  providedIn: 'root',
})
export class DataService implements OnDestroy {
  private pushNotificationService = inject(PushNotificationService);
  private couponsChannel?: any;
  private guestCouponRequestsChannel?: any;
  private notificationsChannel?: any;
  private pendingMealRequestsChannel?: any;
  private menusChannel?: any;
  private punchEventsChannel?: any;

  // Local state (signals)
  private _employees = signal<Employee[]>([]);
  private _qrCards = signal<QrCard[]>([]);
  qrCards = this._qrCards.asReadonly();
  private _coupons = signal<Coupon[]>([]);
  private _notifications = signal<AppNotification[]>([]);
  private _contractors = signal<Contractor[]>([]);
  private _menus = signal<DailyMenu[]>([]);
  private _guestCouponRequests = signal<GuestCouponRequest[]>([]);
  private _pendingMealRequests = signal<PendingMealRequest[]>([]);
  
  // 🔁 Device punchEvents साठी latest event
  private _lastPunchEvent = signal<PunchEvent | null>(null);
  // 🔁 Punch history (recent events list)
  private _punchEventsHistory = signal<PunchEvent[]>([]);

  // Dependencies
  private emailService = inject(EmailService);
  private employeeRepository = inject(EmployeeRepository);
  private qrCardRepository = inject(QrCardRepository);
  private contractorRepository = inject(ContractorRepository);
  private couponRepository = inject(CouponRepository);
  private guestCouponRequestRepository = inject(GuestCouponRequestRepository);
  private notificationRepository = inject(NotificationRepository);
  private pendingMealRequestRepository = inject(PendingMealRequestRepository);
  private menuRepository = inject(MenuRepository);
  private punchEventRepository = inject(PunchEventRepository);
  private supabaseService = inject(SupabaseService);

  // Public readonly signals
  employees = this._employees.asReadonly();
  coupons = this._coupons.asReadonly();
  notifications = this._notifications.asReadonly();
  contractors = this._contractors.asReadonly();
  menus = this._menus.asReadonly();
  guestCouponRequests = this._guestCouponRequests.asReadonly();
  pendingMealRequests =
  this._pendingMealRequests.asReadonly();

  // 🔁 Latest device punch event (Canteen Manager dashboard वापरेल)
  lastPunchEvent = this._lastPunchEvent.asReadonly();
   // 🔁 Full recent punch history
   punchEventsHistory = this._punchEventsHistory.asReadonly();

  contractorBusinessNames = computed(() =>
    this._contractors()
      .map((c) => c.businessName)
      .sort()
  );

  // Computed totals
  totalIssuedCoupons = computed(() => this._coupons().length);
  totalRedeemedCoupons = computed(() => {

    const couponRedeemed =
      this._coupons()
        .filter(c => c.status === 'redeemed')
        .length;
  
    const directRedeemedGuests =
      this._guestCouponRequests()
        .filter(
          r =>
            r.requestedBy === 'canteen_manager' &&
            r.status === 'redeemed'
        )
        .length;
  
    return couponRedeemed + directRedeemedGuests;
  
  });

  todaysIssuedCoupons = computed(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return this._coupons().filter((c) => !c.isGuestCoupon && c.dateIssued.startsWith(todayStr))
      .length;
  });

  todaysRedeemedCoupons = computed(() => {

    const todayStr =
      new Date().toISOString().split('T')[0];
  
    const couponRedeemed =
      this._coupons().filter(
        c =>
          c.status === 'redeemed' &&
          c.redeemDate?.startsWith(todayStr)
      ).length;
  
    const directRedeemedGuests =
      this._guestCouponRequests()
        .filter(
          r =>
            r.requestedBy === 'canteen_manager' &&
            r.status === 'redeemed' &&
            r.servedDate?.startsWith(todayStr)
        )
        .length;
  
    return couponRedeemed + directRedeemedGuests;
  
  });

  constructor() {
    this.loadFromDatabase();

    // Setup realtime listeners
    this.setupRealtimeCouponsListener();
    this.setupRealtimeQrCardsListener();
    this.setupRealtimeGuestCouponRequestsListener();
    this.setupRealtimeNotificationsListener();
    this.setupRealtimePendingMealRequestsListener();
    this.setupRealtimeMenusListener();
    this.setupRealtimePunchEventsListener();
  }

  ngOnDestroy() {
    if (this.couponsChannel) {
      try {
        this.couponsChannel.unsubscribe();
      } catch (e) {
        console.warn('Error unsubscribing coupons channel on destroy:', e);
      }
    }
    if (this.guestCouponRequestsChannel) {
      try {
        this.guestCouponRequestsChannel.unsubscribe();
      } catch (e) {
        console.warn('Error unsubscribing guest coupon requests channel on destroy:', e);
      }
    }
    if (this.notificationsChannel) {
      try {
        this.notificationsChannel.unsubscribe();
      } catch (e) {
        console.warn('Error unsubscribing notifications channel on destroy:', e);
      }
    }
    if (this.pendingMealRequestsChannel) {
      try {
        this.pendingMealRequestsChannel.unsubscribe();
      } catch (e) {
        console.warn('Error unsubscribing pending meal requests channel on destroy:', e);
      }
    }
    if (this.menusChannel) {
      try {
        this.menusChannel.unsubscribe();
      } catch (e) {
        console.warn('Error unsubscribing menus channel on destroy:', e);
      }
    }
    if (this.punchEventsChannel) {
      try {
        this.punchEventsChannel.unsubscribe();
      } catch (e) {
        console.warn('Error unsubscribing punch events channel on destroy:', e);
      }
    }
  }

  // =========================
  // 🔧 Helper: remove undefined
  // =========================

  private removeUndefined(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map((item) => this.removeUndefined(item));
    }
    if (obj !== null && typeof obj === 'object') {
      const cleaned: any = {};
      for (const key of Object.keys(obj)) {
        const value = obj[key];
        if (value === undefined) continue;
        cleaned[key] = this.removeUndefined(value);
      }
      return cleaned;
    }
    return obj;
  }

  // =========================
  // 🔥 Database helpers
  // =========================

  private async loadFromDatabase() {
    try {
      const [
        employees,
        coupons,
        contractors,
        menus,
        notifications,
        guestRequests,
        pendingMealRequests,
      ] = await Promise.all([
        this.employeeRepository.getAll(),
        this.couponRepository.getAll(),
        this.contractorRepository.getAll(),
        this.menuRepository.getAll(),
        this.notificationRepository.getAll(),
        this.guestCouponRequestRepository.getAll(),
        this.pendingMealRequestRepository.getAll(),
      ]);

      const isFirstTime =
        employees.length === 0 &&
        coupons.length === 0 &&
        contractors.length === 0 &&
        menus.length === 0 &&
        notifications.length === 0 &&
        guestRequests.length === 0;

      if (isFirstTime) {
        // First time: local seed + Supabase sync
        this.seedData();
        await Promise.all([
          this.syncAllEmployeesToDatabase(),
          this.syncAllCouponsToDatabase(),
          this.syncAllContractorsToDatabase(),
          this.syncAllMenusToDatabase(),
          this.syncAllNotificationsToDatabase(),
          this.syncAllGuestCouponRequestsToDatabase(),
          this.syncAllPendingMealRequestsToDatabase(),
        ]);
      } else {
        this._employees.set(employees);
        this._coupons.set(coupons);
        this._contractors.set(contractors);
        this._menus.set(menus);
        this._notifications.set(notifications);
        this._guestCouponRequests.set(guestRequests);
        this._pendingMealRequests.set(pendingMealRequests);
      }
    } catch (err) {
      console.error('Error loading data from Supabase:', err);
      this.seedData();
    }
  }

  private async syncAllEmployeesToDatabase() {
    try {
      const employees = this._employees();
      const activeIds = employees.map(e => e.id);
      await this.employeeRepository.upsertMany(employees);
      await this.employeeRepository.deleteManyNotIn(activeIds);
    } catch (err) {
      console.error('Error syncing employees collection to Supabase:', err);
    }
  }

  private async syncAllCouponsToDatabase() {
    try {
      const coupons = this._coupons();
      const activeIds = coupons.map((c) => c.couponId);
      await this.couponRepository.upsertMany(coupons);
      await this.couponRepository.deleteManyNotIn(activeIds);
    } catch (err) {
      console.error('Error syncing coupons collection to Supabase:', err);
    }
  }
  private async updateCouponInDatabase(coupon: Coupon) {
    try {
      await this.couponRepository.upsert(coupon);
    } catch (err) {
      console.error(`Failed to update coupon ${coupon.couponId} in Supabase:`, err);
    }
  }

  private async addCouponToDatabase(coupon: Coupon) {
    try {
      await this.couponRepository.upsert(coupon);
    } catch (err) {
      console.error(`Failed to add coupon ${coupon.couponId} to Supabase:`, err);
    }
  }

  private async deleteCouponFromDatabase(couponId: string) {
    try {
      await this.couponRepository.delete(couponId);
    } catch (err) {
      console.error(`Failed to delete coupon ${couponId} from Supabase:`, err);
    }
  }
  private async setupRealtimeCouponsListener() {
    try {
      if (this.couponsChannel) {
        try {
          this.couponsChannel.unsubscribe();
        } catch (e) {
          console.warn('Error unsubscribing from existing coupons channel:', e);
        }
        this.couponsChannel = undefined;
      }

      this.couponsChannel = this.supabaseService.realtime('coupons', '*', (payload) => {
        console.log('Supabase Realtime Coupon Event received:', payload.eventType, payload);
        const eventType = payload.eventType;

        if (eventType === 'INSERT' || eventType === 'UPDATE') {
          const row = payload.new;
          if (row) {
            if (row.employee_id) {
              this.refreshEmployeeCoupons(Number(row.employee_id));
            }
          }
        } else if (eventType === 'DELETE') {
          const oldRow = payload.old;
          if (oldRow && oldRow.coupon_id) {
            this._coupons.update((coupons) =>
              coupons.filter((c) => c.couponId !== oldRow.coupon_id)
            );
          }
        }
      });

      console.log('Successfully configured Supabase Realtime listener for coupons.');
    } catch (err) {
      console.error('Failed to set up Supabase Realtime listener for coupons:', err);
    }
  }

  private async refreshEmployeeCoupons(employeeId: number) {
    try {
      const { data, error } = await this.supabaseService.client
        .from('coupons')
        .select('*')
        .eq('employee_id', employeeId);
      
      if (error) throw error;
      
      const mappedCoupons = data.map(r => this.couponRepository.mapToCoupon(r));
      this._coupons.update(coupons => {
        const otherCoupons = coupons.filter(c => c.employeeId !== employeeId);
        return [...otherCoupons, ...mappedCoupons];
      });
    } catch (err) {
      console.error('Failed to refresh employee coupons:', err);
    }
  }

  private setupRealtimeQrCardsListener() {
    try {
      this.supabaseService.realtime('qr_cards', '*', async (payload) => {
        console.log('Supabase Realtime QR Card Event received:', payload.eventType);
        try {
          const cards = await this.qrCardRepository.getAll();
          this._qrCards.set(cards);
        } catch (err) {
          console.error('Failed to reload QR cards in realtime listener:', err);
        }
      });
    } catch (err) {
      console.error('Failed to set up Supabase Realtime listener for qr_cards:', err);
    }
  }
  private setupRealtimeGuestCouponRequestsListener() {
    try {
      if (this.guestCouponRequestsChannel) {
        try {
          this.guestCouponRequestsChannel.unsubscribe();
        } catch (e) {
          console.warn('Error unsubscribing from existing guest coupon requests channel:', e);
        }
        this.guestCouponRequestsChannel = undefined;
      }

      this.guestCouponRequestsChannel = this.supabaseService.realtime('guest_coupon_requests', '*', (payload) => {
        console.log('Supabase Realtime Guest Coupon Request Event received:', payload.eventType, payload);
        const eventType = payload.eventType;

        if (eventType === 'INSERT' || eventType === 'UPDATE') {
          const row = payload.new;
          if (row) {
            const mapped = this.guestCouponRequestRepository.mapToGuestCouponRequest(row);
            this._guestCouponRequests.update((requests) => {
              const idx = requests.findIndex((r) => r.id === mapped.id);
              if (idx !== -1) {
                const existing = requests[idx];
                if (JSON.stringify(existing) === JSON.stringify(mapped)) {
                  return requests;
                }
                const copy = [...requests];
                copy[idx] = mapped;
                return copy;
              } else {
                return [mapped, ...requests];
              }
            });
          }
        } else if (eventType === 'DELETE') {
          const oldRow = payload.old;
          if (oldRow && oldRow.id) {
            this._guestCouponRequests.update((requests) =>
              requests.filter((r) => r.id !== oldRow.id)
            );
          }
        }
      });

      console.log('Successfully configured Supabase Realtime listener for guest coupon requests.');
    } catch (err) {
      console.error('Failed to set up Supabase Realtime listener for guest coupon requests:', err);
    }
  }
  private setupRealtimeNotificationsListener() {
    try {
      if (this.notificationsChannel) {
        try {
          this.notificationsChannel.unsubscribe();
        } catch (e) {
          console.warn('Error unsubscribing from existing notifications channel:', e);
        }
          this.notificationsChannel = undefined;
      }

      this.notificationsChannel = this.supabaseService.realtime('notifications', '*', (payload) => {
        console.log('Supabase Realtime Notification Event received:', payload.eventType, payload);
        const eventType = payload.eventType;

        if (eventType === 'INSERT' || eventType === 'UPDATE') {
          const row = payload.new;
          if (row) {
            const mapped = this.notificationRepository.mapToAppNotification(row);
            this._notifications.update((list) => {
              const idx = list.findIndex((n) => n.id === mapped.id);
              if (idx !== -1) {
                const existing = list[idx];
                if (JSON.stringify(existing) === JSON.stringify(mapped)) {
                  return list;
                }
                const copy = [...list];
                copy[idx] = mapped;
                return copy;
              } else {
                return [mapped, ...list];
              }
            });
          }
        } else if (eventType === 'DELETE') {
          const oldRow = payload.old;
          if (oldRow && oldRow.id) {
            this._notifications.update((list) =>
              list.filter((n) => n.id !== oldRow.id)
            );
          }
        }
      });

      console.log('Successfully configured Supabase Realtime listener for notifications.');
    } catch (err) {
      console.error('Failed to set up Supabase Realtime listener for notifications:', err);
    }
  }
  private setupRealtimePendingMealRequestsListener() {
    try {
      if (this.pendingMealRequestsChannel) {
        try {
          this.pendingMealRequestsChannel.unsubscribe();
        } catch (e) {
          console.warn('Error unsubscribing from existing pending meal requests channel:', e);
        }
        this.pendingMealRequestsChannel = undefined;
      }

      this.pendingMealRequestsChannel = this.supabaseService.realtime('pending_meal_requests', '*', (payload) => {
        console.log('Supabase Realtime Pending Meal Request Event received:', payload.eventType, payload);
        const eventType = payload.eventType;

        if (eventType === 'INSERT' || eventType === 'UPDATE') {
          const row = payload.new;
          if (row) {
            const mapped = this.pendingMealRequestRepository.mapToPendingMealRequest(row);
            this._pendingMealRequests.update((list) => {
              const idx = list.findIndex((r) => r.requestId === mapped.requestId);
              if (idx !== -1) {
                const existing = list[idx];
                if (JSON.stringify(existing) === JSON.stringify(mapped)) {
                  return list;
                }
                const copy = [...list];
                copy[idx] = mapped;
                return copy;
              } else {
                return [mapped, ...list];
              }
            });
          }
        } else if (eventType === 'DELETE') {
          const oldRow = payload.old;
          if (oldRow && oldRow.id) {
            this._pendingMealRequests.update((list) =>
              list.filter((r) => r.requestId !== oldRow.id)
            );
          }
        }
      });

      console.log('Successfully configured Supabase Realtime listener for pending meal requests.');
    } catch (err) {
      console.error('Failed to set up Supabase Realtime listener for pending meal requests:', err);
    }
  }

  private setupRealtimeMenusListener() {
    try {
      if (this.menusChannel) {
        try {
          this.menusChannel.unsubscribe();
        } catch (e) {
          console.warn('Error unsubscribing from existing menus channel:', e);
        }
        this.menusChannel = undefined;
      }

      this.menusChannel = this.supabaseService.realtime('menus', '*', (payload) => {
        console.log('Supabase Realtime Menu Event received:', payload.eventType, payload);
        const eventType = payload.eventType;

        if (eventType === 'INSERT' || eventType === 'UPDATE') {
          const row = payload.new;
          if (row) {
            const mapped = this.menuRepository.mapToDailyMenu(row);
            this._menus.update((list) => {
              const idx = list.findIndex((m) => m.id === mapped.id);
              if (idx !== -1) {
                const existing = list[idx];
                if (JSON.stringify(existing) === JSON.stringify(mapped)) {
                  return list;
                }
                const copy = [...list];
                copy[idx] = mapped;
                return copy;
              } else {
                return [...list, mapped];
              }
            });
          }
        } else if (eventType === 'DELETE') {
          const oldRow = payload.old;
          if (oldRow && oldRow.id) {
            this._menus.update((list) =>
              list.filter((m) => m.id !== oldRow.id)
            );
          }
        }
      });

      console.log('Successfully configured Supabase Realtime listener for menus.');
    } catch (err) {
      console.error('Failed to set up Supabase Realtime listener for menus:', err);
    }
  }

    // 🔁 NEW: punchEvents वर real-time listener – device bridge साठी
    private async setupRealtimePunchEventsListener() {
      try {
        if (this.punchEventsChannel) {
          try {
            this.punchEventsChannel.unsubscribe();
          } catch (e) {
            console.warn('Error unsubscribing from existing punch events channel:', e);
          }
          this.punchEventsChannel = undefined;
        }

        // Load initial 30 recent punch events
        const { data: rows, error: loadErr } = await this.supabaseService.client
          .from('punch_events' as any)
          .select('*')
          .order('created_at', { ascending: false })
          .limit(30);

        if (loadErr) throw loadErr;

        const initialEvents = (rows || []).map((r) =>
          this.punchEventRepository.mapToPunchEvent(r)
        );

        this._punchEventsHistory.set(initialEvents);
        this._lastPunchEvent.set(initialEvents[0] || null);

        this.punchEventsChannel = this.supabaseService.realtime('punch_events', '*', (payload) => {
          console.log('Supabase Realtime Punch Event received:', payload.eventType, payload);
          const eventType = payload.eventType;

          if (eventType === 'INSERT' || eventType === 'UPDATE') {
            const row = payload.new;
            if (row) {
              const mapped = this.punchEventRepository.mapToPunchEvent(row);
              this._punchEventsHistory.update((list) => {
                const idx = list.findIndex((p) => p.id === mapped.id);
                let updatedList = [...list];
                if (idx !== -1) {
                  const existing = list[idx];
                  if (JSON.stringify(existing) === JSON.stringify(mapped)) {
                    return list;
                  }
                  updatedList[idx] = mapped;
                } else {
                  updatedList.push(mapped);
                }

                // Sort by createdAt desc, and limit to 30
                updatedList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                if (updatedList.length > 30) {
                  updatedList = updatedList.slice(0, 30);
                }

                // Update last punch event banner
                this._lastPunchEvent.set(updatedList[0] || null);
                return updatedList;
              });
            }
          } else if (eventType === 'DELETE') {
            const oldRow = payload.old;
            if (oldRow && oldRow.id) {
              this._punchEventsHistory.update((list) => {
                const updatedList = list.filter((p) => p.id !== oldRow.id);
                this._lastPunchEvent.set(updatedList[0] || null);
                return updatedList;
              });
            }
          }
        });

        console.log('Successfully configured Supabase Realtime listener for punch events.');
      } catch (err) {
        console.error('Failed to set up Supabase Realtime listener for punch events:', err);
      }
    }
  
  // createdAt field मधून proper Date काढण्यासाठी helper
  private extractTimestamp(data: any): Date {
    if (data?.createdAt && typeof data.createdAt.toDate === 'function') {
      // Database Timestamp
      return data.createdAt.toDate();
    }
    if (typeof data?.createdAt === 'string') {
      const d = new Date(data.createdAt);
      if (!isNaN(d.getTime())) {
        return d;
      }
    }
    // काहीच नसेल तर फार जुनी date देतो
    return new Date(0);
  }

  // संपूर्ण contractors collection sync करणे
  private async syncAllContractorsToDatabase() {
    try {
      const contractors = this._contractors();
      const activeIds = contractors.map(c => c.id);
      await this.contractorRepository.upsertMany(contractors);
      await this.contractorRepository.deleteManyNotIn(activeIds);
    } catch (err) {
      console.error('Error syncing contractors collection to Supabase:', err);
    }
  }

  // संपूर्ण menus collection sync करणे
  private async syncAllMenusToDatabase() {
    try {
      const menus = this._menus();
      await this.menuRepository.upsertMany(menus);
      const activeIds = menus.map((m) => m.id);
      await this.menuRepository.deleteManyNotIn(activeIds);
    } catch (err) {
      console.error('Error syncing menus to Supabase:', err);
    }
  }

  // संपूर्ण notifications collection sync करणे
  private async syncAllNotificationsToDatabase() {
    try {
      const notifs = this._notifications();
      await this.notificationRepository.upsertMany(notifs);
      const activeIds = notifs.map((n) => n.id);
      await this.notificationRepository.deleteManyNotIn(activeIds);
    } catch (err) {
      console.error('Error syncing notifications to Supabase:', err);
    }
  }
  async generateQrPool(quantity: number) {
    let maxNo = 0;

    try {
      const cards = await this.qrCardRepository.getAll();
      cards.forEach(card => {
        const num = Number(
          String(card.cardCode)
            .replace('QR', '')
        );
        if (num > maxNo) {
          maxNo = num;
        }
      });
    } catch (err) {
      console.error('Failed to get QR cards from Supabase for pool generation:', err);
      return;
    }

    const newCards: QrCard[] = [];

    for (let i = 1; i <= quantity; i++) {
      const nextNo = maxNo + i;
      const code = `QR${String(nextNo).padStart(4, '0')}`;
      
      const newCard: QrCard = {
        cardCode: code,
        assigned: false,
        employeeId: undefined,
        employeeName: undefined,
      };
      
      newCards.push(newCard);
    }

    try {
      await this.qrCardRepository.upsertMany(newCards);
    } catch (err) {
      console.error('Failed to bulk upsert QR cards to Supabase:', err);
    }
  }
  async assignQrCard(
    cardCode: string,
    employeeId: number,
    employeeName: string
  ) {
    try {
      await this.qrCardRepository.upsert({
        cardCode,
        assigned: true,
        employeeId,
        employeeName,
      });
    } catch (err) {
      console.error(`Failed to assign QR card ${cardCode} in Supabase:`, err);
    }
  }
  // संपूर्ण guestCouponRequests collection sync करणे
  private async syncAllGuestCouponRequestsToDatabase() {
    try {
      const reqs = this._guestCouponRequests();
      await this.guestCouponRequestRepository.upsertMany(reqs);
      const activeIds = reqs.map((r) => r.id);
      await this.guestCouponRequestRepository.deleteManyNotIn(activeIds);
    } catch (err) {
      console.error('Error syncing guest coupon requests to Supabase:', err);
    }
  }
  private async syncAllPendingMealRequestsToDatabase() {
    try {
      const requests = this._pendingMealRequests();
      await this.pendingMealRequestRepository.upsertMany(requests);
      const activeIds = requests.map((r) => r.requestId);
      await this.pendingMealRequestRepository.deleteManyNotIn(activeIds);
    } catch (err) {
      console.error('Error syncing pending meal requests to Supabase:', err);
    }
  }

  // =========================
  // Initial seed data
  // =========================

  private seedData() {
    const initialEmployees: Employee[] = [
      {
        id: 1,
        name: 'Super Admin',
        employeeId: 'admin01',
        email: 'superadmin@canteen.com',
        password: 'superadmin',
        role: 'admin',
        department: 'System',
        status: 'active',
      },
    ];
    this._employees.set(initialEmployees);

    const initialContractors: Contractor[] = [];
    this._contractors.set(initialContractors);

    this._coupons.set([]); // Start with no coupons
    this._notifications.set([]); // Start with no notifications
    this._menus.set([]); // Start with no menus
    this._guestCouponRequests.set([]); // Start with no guest requests
    this._pendingMealRequests.set([]);
  }

  // =========================
  // Utility methods
  // =========================
  // couponType वरून time-slot number ठरवणे
  // 0 = Breakfast (8–10)
  // 1 = Lunch/Dinner (11:30–14)
  private getSlotFromCouponType(couponType: Coupon['couponType']): number {
    switch (couponType) {
      case 'Breakfast': // 8–10
        return 0;
      case 'Lunch/Dinner': // 11:30–14
        return 1;
      default:
        return 0; // default Breakfast ला
    }
  }

  private generateRedemptionCode(): string {
    // Generate a 4-digit numeric code as a string
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  private createCouponsForEmployee(
    employeeId: number,
    count: number,
    couponType: Coupon['couponType'],
    batchId: string
  ): Coupon[] {
    const coupons: Coupon[] = [];
    const existingCodes = new Set(
      this._coupons()
        .filter((c) => c.status === 'issued')
        .map((c) => c.redemptionCode)
    );
    const slot = this.getSlotFromCouponType(couponType);
    for (let i = 0; i < count; i++) {
      let newCode: string;
      do {
        newCode = this.generateRedemptionCode();
      } while (existingCodes.has(newCode)); // Ensure code is unique among active coupons
      existingCodes.add(newCode);

      coupons.push({
        couponId: this.generateCouponId(),
        employeeId: employeeId,
        dateIssued: new Date().toISOString(),
        status: 'issued',
        redeemDate: null,
        redemptionCode: newCode,
        couponType: couponType,
        slot,
        batchId,
      });
    }
    return coupons;
  }

  private generateCouponId(): string {
    return (
      'CPN-' +
      Date.now().toString(36).slice(-4).toUpperCase() +
      Math.random().toString(36).substring(2, 6).toUpperCase()
    );
  }

  private generateGuestRequestId(): string {
    return (
      'GREQ-' +
      Date.now().toString(36).slice(-4).toUpperCase() +
      Math.random().toString(36).substring(2, 6).toUpperCase()
    );
  }

  private generateNotificationId(): string {
    return `NTF-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  // =========================
  // Employee methods
  // =========================

  getEmployees(): Employee[] {
    return this._employees();
  }

  addEmployee(employeeData: Omit<Employee, 'id' | 'status'>): Employee {
    const existing = this._employees();
  
    // 1️⃣ default: जुना logic (max + 1)
    let newId =
      existing.reduce((maxId, employee) => Math.max(employee.id, maxId), 0) + 1;

      const isAdminUser =
      employeeData.role === 'admin' ||
      employeeData.role === 'canteen manager';
      if (isAdminUser) {

        const adminIds = existing
        .filter(e =>
         e.role === 'admin' ||
         e.role === 'canteen manager'
        )
        .map(e => e.id);
      
        newId =
          adminIds.length > 0
            ? Math.max(...adminIds) + 1
            : 2;
      }
      

    // 2️⃣ जर employeeId पूर्णपणे numeric असेल (उदा. "850010")
    const rawEmpCode = (employeeData.employeeId || '').toString().trim();
  
    if (
      !isAdminUser &&
      /^[0-9]+$/.test(rawEmpCode)
    ) {
      const numericFromCode = Number(rawEmpCode);
    
      const alreadyUsed =
        existing.some((e) => e.id === numericFromCode);
    
      if (!alreadyUsed) {
        newId = numericFromCode;
      }
    }
  
    const newEmployee: Employee = {
      ...employeeData,
      id: newId,
      status: 'active',
      permanentQrCode: `EMP:${newId}`,
    
      lastMorningBreakfastDate: '',
      lastLunchDate: '',
      lastEveningBreakfastDate: '',
      lastDinnerDate: '',
    };
  
    this._employees.update((employees) => [...employees, newEmployee]);

if (employeeData.assignedQrCard) {

  this.assignQrCard(
    employeeData.assignedQrCard,
    newEmployee.id,
    newEmployee.name
  );

}

this.syncAllEmployeesToDatabase();

return newEmployee;
  }
  
    // 🔹 Canteen Manager add helper method
    addCanteenManager(
      data: Omit<Employee, 'id' | 'status' | 'role'>
    ): Employee {
      const newId =
        this._employees().reduce(
          (maxId, e) => Math.max(e.id, maxId),
          0
        ) + 1;
    
      const newManager: Employee = {
        ...data,
        id: newId,
        status: 'active',
        role: 'canteen manager',
      };
    
      // local update
      this._employees.update(list => [...list, newManager]);
    
      // Sync to Supabase
      this.employeeRepository.upsert(newManager).catch((err) => {
        console.error('Failed to save Canteen Manager to Supabase:', err);
      });
    
      return newManager;
    }
 

  updateEmployee(updatedEmployeeData: Employee): void {
    this._employees.update((employees) =>
      employees.map((emp) =>
        emp.id === updatedEmployeeData.id ? updatedEmployeeData : emp
      )
    );
    this.syncAllEmployeesToDatabase();
  }

  changePassword(employeeId: number, newPassword: string): void {
    this._employees.update((employees) =>
      employees.map((emp) =>
        emp.id === employeeId ? { ...emp, password: newPassword } : emp
      )
    );
    this.syncAllEmployeesToDatabase();
  }

  deleteEmployee(employeeId: number): void {

    const employee =
      this._employees().find(
        e => e.id === employeeId
      );
  
    if (
      employee?.assignedQrCard
    ) {
      const cardCode = employee.assignedQrCard;

      this.qrCardRepository.upsert({
        cardCode,
        assigned: false,
        employeeId: undefined,
        employeeName: undefined,
      }).catch((err) => {
        console.error(`Failed to deassign QR card ${cardCode} in Supabase:`, err);
      });
    }
    // Remove employee
    this._employees.update((employees) =>
      employees.filter((emp) => emp.id !== employeeId)
    );
    // Remove associated coupons
    this._coupons.update((coupons) =>
      coupons.filter((c) => c.employeeId !== employeeId)
    );
    // Remove associated notifications
    this._notifications.update((notifications) =>
      notifications.filter((n) => n.employeeId !== employeeId)
    );

    this.syncAllEmployeesToDatabase();
    this.syncAllCouponsToDatabase();
    this.syncAllNotificationsToDatabase();
  }

  toggleEmployeeStatus(employeeId: number): void {
    this._employees.update((employees) =>
      employees.map((emp) => {
        if (emp.id === employeeId) {
          const newStatus = emp.status === 'active' ? 'deactivated' : 'active';
          return { ...emp, status: newStatus };
        }
        return emp;
      })
    );
    this.syncAllEmployeesToDatabase();
  }

  // =========================
  // Contractor methods
  // =========================

  getContractors(): Contractor[] {
    return this._contractors();
  }

  addContractor(contractorData: Omit<Contractor, 'id'>): Contractor {
    const newId =
      this._contractors().reduce(
        (maxId, contractor) => Math.max(contractor.id, maxId),
        0
      ) + 1;
    const newContractor: Contractor = {
      ...contractorData,
      id: newId,
    };
    this._contractors.update((contractors) => [...contractors, newContractor]);
    this.syncAllContractorsToDatabase();
    return newContractor;
  }

  updateContractor(updatedContractorData: Contractor): void {
    this._contractors.update((contractors) =>
      contractors.map((c) =>
        c.id === updatedContractorData.id ? updatedContractorData : c
      )
    );
    this.syncAllContractorsToDatabase();
  }

  changeContractorPassword(contractorId: number, newPassword: string): void {
    this._contractors.update((contractors) =>
      contractors.map((c) =>
        c.id === contractorId ? { ...c, password: newPassword } : c
      )
    );
    this.syncAllContractorsToDatabase();
  }

  deleteContractor(contractorId: number): void {
    const contractorToDelete = this._contractors().find(
      (c) => c.id === contractorId
    );
    if (!contractorToDelete) return;

    // Un-assign contractor from employees
    this._employees.update((employees) =>
      employees.map((emp) => {
        if (emp.contractor === contractorToDelete.businessName) {
          return { ...emp, contractor: undefined };
        }
        return emp;
      })
    );

    // Delete any coupons associated with this contractor (pool or assigned)
    this._coupons.update((coupons) =>
      coupons.filter((c) => c.contractorId !== contractorId)
    );

    // Delete contractor
    this._contractors.update((contractors) =>
      contractors.filter((c) => c.id !== contractorId)
    );

    this.syncAllEmployeesToDatabase();
    this.syncAllCouponsToDatabase();
    this.syncAllContractorsToDatabase();
  }

  // =========================
  // Coupon & Guest Pass methods
  // =========================

  getCouponsForEmployee(employeeId: number): Coupon[] {
    return this._coupons().filter((c) => c.employeeId === employeeId);
  }

  removeCoupon(couponId: string): { success: boolean; message: string } {
    const couponToRemove = this._coupons().find((c) => c.couponId === couponId);

    if (!couponToRemove) {
      return { success: false, message: 'Coupon not found.' };
    }
    if (couponToRemove.status === 'redeemed') {
      return { success: false, message: 'Cannot remove a redeemed coupon.' };
    }
    this._coupons.update((coupons) =>
      coupons.filter((c) => c.couponId !== couponId)
    );
    this.syncAllCouponsToDatabase();
    return {
      success: true,
      message: `Coupon ${couponId} removed successfully.`,
    };
  }

  generateCouponsForEmployee(
    employeeId: number,
    couponType: Coupon['couponType']
  ): { success: boolean; message: string } {
    const employee = this._employees().find((e) => e.id === employeeId);
    if (!employee) {
      return { success: false, message: 'Employee not found.' };
    }

    if (employee.role !== 'employee') {
      return {
        success: false,
        message:
          'This function is only for permanent employees. Use the Contractors tab for contractual staff.',
      };
    }

    // Determine the monthly limit based on role and coupon type
    // Determine the monthly limit based on role and coupon type
let limit = 0;

if (
  couponType === 'Lunch/Dinner' ||
  couponType === 'Breakfast'
) {

  // Technician = 26
  if (
    employee.employeeCategory === 'Technician'
  ) {
    limit = 26;
  }

  // Staff = 24
  else {
    limit = 24;
  }

}

    if (limit === 0) {
      return {
        success: false,
        message: `No monthly limit defined for ${couponType} coupons for this employee role.`,
      };
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const monthlyCoupons = this._coupons().filter((c) => {
      if (c.employeeId === employeeId && c.couponType === couponType) {
        const issueDate = new Date(c.dateIssued);
        return (
          issueDate.getFullYear() === currentYear &&
          issueDate.getMonth() === currentMonth
        );
      }
      return false;
    });

    const hasUnredeemedCoupons = monthlyCoupons.some(
      (c) => c.status === 'issued'
    );

    // If there are any unredeemed coupons for the current month, block generation.
    if (hasUnredeemedCoupons) {
      return {
        success: false,
        message: `Employee must redeem all existing ${couponType} coupons for this month before new ones can be generated.`,
      };
    }

    // If all coupons are redeemed (or none exist for the month), generate a new full batch.
const countToGenerate = limit;

const batchId = `BATCH-${Date.now()}`;

const newCoupons = this.createCouponsForEmployee(
  employeeId,
  countToGenerate,
  couponType,
  batchId
);
    console.log(
      'ALL PENDING REQUESTS',
      this._pendingMealRequests()
    );
    const pendingRequest =
  this._pendingMealRequests().find(r =>

    r.employeeId === employeeId &&

    r.status === 'pending' &&

    (
      (
        couponType === 'Breakfast' &&
        (
          r.mealType === 'morning' ||
          r.mealType === 'evening'
        )
      )

      ||

      (
        couponType === 'Lunch/Dinner' &&
        (
          r.mealType === 'lunch' ||
          r.mealType === 'dinner'
        )
      )

    )

  );
  console.log(
    'FOUND PENDING REQUEST',
    pendingRequest
  );
if (
  pendingRequest &&
  newCoupons.length > 0
) {
  console.log(
    'AUTO REDEEM BLOCK EXECUTED'
  );
  newCoupons[0].status =
    'redeemed';

    newCoupons[0].redeemDate =
    pendingRequest.mealDate +
    'T12:00:00';

  this._pendingMealRequests.update(
    list =>
      list.map(r =>
        r.requestId ===
        pendingRequest.requestId
          ? {
            ...r,
            status: 'completed',
            isCouponAdjusted: true,
            adjustedCouponId:
              newCoupons[0].couponId,
            adjustmentDate:
              new Date().toISOString()
          }
          : r
      )
  );

  this.syncAllPendingMealRequestsToDatabase();

}
    this._coupons.update((coupons) => [...coupons, ...newCoupons]);

    this.syncAllCouponsToDatabase();

    this.emailService.sendCouponNotification(
      employee,
      countToGenerate,
      couponType
    );

    const newNotification: AppNotification = {
      id: this.generateNotificationId(),
      employeeId: employeeId,
      message: `You have received ${countToGenerate} new ${couponType} coupon(s).`,
      type: 'new_coupon',
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    this._notifications.update((notifications) => [
      newNotification,
      ...notifications,
    ]);
    this.pushNotificationService.sendToEmployee(
      employeeId,
      "Meal Coupon Generated",
      newNotification.message,
      {
          notification_type: "new_coupon",
          couponType: couponType
      }
    );
    this.syncAllNotificationsToDatabase();

    return {
      success: true,
      message: `${countToGenerate} ${couponType} coupons generated successfully for ${employee.name}.`,
    };
  }

  generateCouponsForContractor(
    contractorId: number,
    couponType: Coupon['couponType'],
    quantity: number
  ): { success: boolean; message: string } {
    const contractor = this._contractors().find((c) => c.id === contractorId);
    if (!contractor) {
      return { success: false, message: 'Contractor not found.' };
    }

    const newCoupons: Coupon[] = [];
    const existingCodes = new Set(
      this._coupons()
        .filter((c) => c.status === 'issued')
        .map((c) => c.redemptionCode)
    );
    const slot = this.getSlotFromCouponType(couponType);
    for (let i = 0; i < quantity; i++) {
      let newCode: string;
      do {
        newCode = this.generateRedemptionCode();
      } while (existingCodes.has(newCode));
      existingCodes.add(newCode);

      newCoupons.push({
        couponId: this.generateCouponId(),
        contractorId: contractorId,
        dateIssued: new Date().toISOString(),
        status: 'issued',
        redeemDate: null,
        redemptionCode: newCode,
        couponType: couponType,
        slot,
      });
    }

    this._coupons.update((coupons) => [...coupons, ...newCoupons]);
    this.syncAllCouponsToDatabase();

    return {
      success: true,
      message: `${quantity} ${couponType} coupons generated for ${contractor.businessName}.`,
    };
  }

  assignCouponsToEmployee(
    contractorId: number,
    employeeId: number,
    couponType: Coupon['couponType'],
    quantity: number
  ): { success: boolean; message: string } {
    const availableCoupons = this._coupons().filter(
      (c) =>
        c.contractorId === contractorId &&
        c.couponType === couponType &&
        c.status === 'issued' &&
        !c.employeeId
    );

    if (availableCoupons.length < quantity) {
      return {
        success: false,
        message: `Not enough available ${couponType} coupons. You have ${availableCoupons.length}, but tried to assign ${quantity}.`,
      };
    }

    const employee = this._employees().find((e) => e.id === employeeId);
    if (!employee) {
      return { success: false, message: 'Employee not found.' };
    }

    const couponsToAssign = availableCoupons.slice(0, quantity);
    const couponIdsToAssign = new Set(
      couponsToAssign.map((c) => c.couponId)
    );

    this._coupons.update((coupons) =>
      coupons.map((c) => {
        if (couponIdsToAssign.has(c.couponId)) {
          return { ...c, employeeId: employeeId };
        }
        return c;
      })
    );

    const newNotification: AppNotification = {
      id: this.generateNotificationId(),
      employeeId: employeeId,
      message: `You have received ${quantity} new ${couponType} coupon(s) from your contractor.`,
      type: 'new_coupon',
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    this._notifications.update((notifications) => [
      newNotification,
      ...notifications,
    ]);

    this.syncAllCouponsToDatabase();
    this.syncAllNotificationsToDatabase();

    return {
      success: true,
      message: `${quantity} ${couponType} coupons assigned successfully to ${employee.name}.`,
    };
  }

  async redeemCoupon(couponId: string) {

    let updatedCoupon: Coupon | undefined;
  
    this._coupons.update((coupons) =>
      coupons.map((c) => {
  
        if (c.couponId === couponId && c.status === 'issued') {
  
          updatedCoupon = {
            ...c,
            status: 'redeemed',
            redeemDate: new Date().toISOString(),
          };
  
          return updatedCoupon;
        }
  
        return c;
      })
    );
  
    if (updatedCoupon) {
      await this.updateCouponInDatabase(updatedCoupon);
    }
  
  }

  // ⭐ UPDATED: existing logic
  async redeemCouponByCode(
    code: string
  ): Promise<{ success: boolean; message: string }> {
    if (isSupabaseConfigured()) {
      try {
        const sbCoupon = await this.couponRepository.getByRedemptionCode(code);
        if (sbCoupon) {
          if (sbCoupon.status === 'redeemed') {
            // local state update करा
            this._coupons.update((coupons) =>
              coupons.map((c) =>
                c.couponId === sbCoupon.couponId
                  ? {
                      ...c,
                      status: 'redeemed',
                      redeemDate: sbCoupon.redeemDate || c.redeemDate,
                    }
                  : c
              )
            );

            if (sbCoupon.redeemDate) {
              const when = new Date(sbCoupon.redeemDate);
              return {
                success: false,
                message: `This coupon has already been redeemed on ${when.toLocaleString()}.`,
              };
            }
            return {
              success: false,
              message: 'This coupon has already been redeemed.',
            };
          }

          if (sbCoupon.isGuestCoupon) {
            const sharingEmployee = this._employees().find(
              (u) => u.id === sbCoupon.sharedByEmployeeId
            );

            const hostName = sharingEmployee?.name || 'Unknown';
            const guestName = sbCoupon.guestName || 'Unknown';
            const guestCompany = sbCoupon.guestCompany || 'N/A';
            const couponType = sbCoupon.couponType || 'Unknown';
            
            const successMessage = `GUEST_PASS_REDEEMED|${guestName}|${guestCompany}|${hostName}|${couponType}`;
            
            // For UI display feedback
            const displayMessage = `Guest Pass Redeemed for ${guestName} (${guestCompany}) (requested by ${hostName}).`;

            const updatedCoupon: Coupon = {
              ...sbCoupon,
              status: 'redeemed',
              redeemDate: new Date().toISOString(),
            };

            await this.couponRepository.upsert(updatedCoupon);

            // Record punch event
            const punchEventId = `CODE-${Date.now()}`;
            const newPunchEvent: PunchEvent = {
              id: punchEventId,
              employeeId: sbCoupon.sharedByEmployeeId || 0,
              resultType: 'redeemed',
              message: successMessage,
              createdAt: updatedCoupon.redeemDate
            };
            await this.punchEventRepository.upsert(newPunchEvent);

            this._coupons.update((coupons) =>
              coupons.map((c) =>
                c.couponId === sbCoupon.couponId ? updatedCoupon : c
              )
            );

            // Fallback removed

            return { success: true, message: displayMessage };
          }

          if (!sbCoupon.employeeId) {
            return {
              success: false,
              message: 'This coupon has not been assigned to an employee yet.',
            };
          }

          const employee = this._employees().find(
            (u) => u.id === sbCoupon.employeeId
          );

          if (employee && employee.status === 'deactivated') {
            return {
              success: false,
              message: 'Cannot redeem coupon. Employee account is deactivated.',
            };
          }

          const updatedCoupon: Coupon = {
            ...sbCoupon,
            status: 'redeemed',
            redeemDate: new Date().toISOString(),
          };

          await this.couponRepository.upsert(updatedCoupon);

          const msg = `Coupon redeemed successfully for ${employee?.name}.`;

          // Record punch event
          const punchEventId = `CODE-${Date.now()}`;
          const newPunchEvent: PunchEvent = {
            id: punchEventId,
            employeeId: employee?.id || 0,
            resultType: 'redeemed',
            message: msg,
            createdAt: updatedCoupon.redeemDate
          };
          await this.punchEventRepository.upsert(newPunchEvent);

          this._coupons.update((coupons) =>
            coupons.map((c) =>
              c.couponId === sbCoupon.couponId ? updatedCoupon : c
            )
          );

          // Fallback removed

          return {
            success: true,
            message: msg,
          };
        }
      } catch (err) {
        console.error('Supabase coupon check/redemption by code failed, falling back to local:', err);
      }
    }

    // 2️⃣ Original local logic
    const couponToRedeem = this._coupons().find(
      (c) => c.redemptionCode === code && c.status === 'issued'
    );

    if (!couponToRedeem) {
      const alreadyRedeemed = this._coupons().find(
        (c) => c.redemptionCode === code && c.status === 'redeemed'
      );
      if (alreadyRedeemed) {
        return {
          success: false,
          message: 'This coupon has already been redeemed.',
        };
      }
      return { success: false, message: 'Invalid coupon code.' };
    }

    if (couponToRedeem.isGuestCoupon) {
      const sharingEmployee = this._employees().find(
        (u) => u.id === couponToRedeem.sharedByEmployeeId
      );

      const guestInfo = couponToRedeem.guestName
        ? ` for ${couponToRedeem.guestName}${
            couponToRedeem.guestCompany
              ? ` (${couponToRedeem.guestCompany})`
              : ''
          }`
        : '';

      const successMessage = `Guest coupon redeemed successfully${guestInfo} (requested by ${
        sharingEmployee?.name || 'Unknown'
      }).`;

      this._coupons.update((coupons) =>
        coupons.map((c) =>
          c.couponId === couponToRedeem.couponId
            ? {
                ...c,
                status: 'redeemed',
                redeemDate: new Date().toISOString(),
              }
            : c
        )
      );
      this.syncAllCouponsToDatabase();

      return { success: true, message: successMessage };
    }

    if (!couponToRedeem.employeeId) {
      return {
        success: false,
        message: 'This coupon has not been assigned to an employee yet.',
      };
    }

    const employee = this._employees().find(
      (u) => u.id === couponToRedeem.employeeId
    );

    if (employee && employee.status === 'deactivated') {
      return {
        success: false,
        message: 'Cannot redeem coupon. Employee account is deactivated.',
      };
    }

    // Redeem normal employee coupon
    this._coupons.update((coupons) =>
      coupons.map((c) =>
        c.couponId === couponToRedeem.couponId
          ? {
              ...c,
              status: 'redeemed',
              redeemDate: new Date().toISOString(),
            }
          : c
      )
    );
    this.syncAllCouponsToDatabase();

    return {
      success: true,
      message: `Coupon redeemed successfully for ${employee?.name}.`,
    };
  }
  async redeemPermanentQr(
    qrText: string
  ): Promise<{
    success: boolean;
    message: string;
    employeeId?: number;
    employeeName?: string;
    mealType?: string;
    canCreateRequest?: boolean;
  }> {
    try {
      let employee: Employee | undefined;

      if (qrText.startsWith('EMP:')) {
        const employeeId = Number(
          qrText.replace('EMP:', '').trim()
        );
        employee = this._employees().find(
          e => e.id === employeeId
        );
      } else {
        employee = this._employees().find(
          e => e.assignedQrCard === qrText
        );
      }

      if (!employee) {
        return {
          success: false,
          message: 'Employee not found',
        };
      }

      // inactive employee
      if (employee.status === 'deactivated') {
        return {
          success: false,
          message: 'Employee account deactivated',
        };
      }

      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      let requiredSlot = 0;
      let mealWindow = '';

      if (currentMinutes >= 480 && currentMinutes <= 600) {
        requiredSlot = 0;
        mealWindow = 'morning';
      } else if (currentMinutes >= 660 && currentMinutes <= 870) {
        requiredSlot = 1;
        mealWindow = 'lunch';
      } else if (currentMinutes >= 990 && currentMinutes <= 1140) {
        requiredSlot = 0;
        mealWindow = 'evening';
      } else if (currentMinutes >= 1170 && currentMinutes <= 1290) {
        requiredSlot = 1;
        mealWindow = 'dinner';
      } else {
        return {
          success: false,
          message: 'Meal timing not active',
        };
      }

      const availableCoupon = this._coupons()
        .filter(
          (c) =>
            c.employeeId === employee!.id &&
            c.status === 'issued' &&
            c.slot === requiredSlot
        )
        .sort(
          (a, b) =>
            new Date(a.dateIssued).getTime() -
            new Date(b.dateIssued).getTime()
        )[0];

      if (!availableCoupon) {
        return {
          success: false,
          message: `No available coupon for ${employee.name}`,
          employeeId: employee.id,
          employeeName: employee.name,
          mealType: mealWindow,
          canCreateRequest: true
        };
      }

      // today date
      const today = new Date().toISOString().split('T')[0];

      // already redeemed check
      if (mealWindow === 'morning' && employee.lastMorningBreakfastDate === today) {
        return {
          success: false,
          message: `${employee.name} already redeemed morning breakfast`,
        };
      }
      if (mealWindow === 'lunch' && employee.lastLunchDate === today) {
        return {
          success: false,
          message: `${employee.name} already redeemed lunch`,
        };
      }
      if (mealWindow === 'evening' && employee.lastEveningBreakfastDate === today) {
        return {
          success: false,
          message: `${employee.name} already redeemed evening breakfast`,
        };
      }
      if (mealWindow === 'dinner' && employee.lastDinnerDate === today) {
        return {
          success: false,
          message: `${employee.name} already redeemed dinner`,
        };
      }

      const punchEventId = `PERM-${Date.now()}`;
      const updatedCoupon: Coupon = {
        ...availableCoupon,
        status: 'redeemed',
        redeemDate: now.toISOString(),
      };

      const updatedEmployee: Employee = { ...employee };
      if (mealWindow === 'morning') {
        updatedEmployee.lastMorningBreakfastDate = today;
      } else if (mealWindow === 'lunch') {
        updatedEmployee.lastLunchDate = today;
      } else if (mealWindow === 'evening') {
        updatedEmployee.lastEveningBreakfastDate = today;
      } else if (mealWindow === 'dinner') {
        updatedEmployee.lastDinnerDate = today;
      }

      if (isSupabaseConfigured()) {
        const originalCoupon = { ...availableCoupon };
        const originalEmployee = { ...employee };

        // 1. Update coupon
        try {
          await this.couponRepository.upsert(updatedCoupon);
        } catch (err) {
          console.error('Failed to update coupon in Supabase:', err);
          return { success: false, message: 'Database error while redeeming coupon in Supabase.' };
        }

        // 2. Update employee
        try {
          await this.employeeRepository.upsert(updatedEmployee);
        } catch (err) {
          console.error('Failed to update employee last redeemed dates in Supabase. Rolling back coupon update...', err);
          try {
            await this.couponRepository.upsert(originalCoupon);
          } catch (rollbackErr) {
            console.error('CRITICAL: Failed to rollback coupon update in Supabase!', rollbackErr);
          }
          return { success: false, message: 'Database error while updating employee in Supabase.' };
        }

        // 3. Save punch event
        try {
          const newPunchEvent: PunchEvent = {
            id: punchEventId,
            employeeId: employee.id,
            resultType: 'redeemed',
            message: `${availableCoupon.couponType} coupon redeemed for ${employee.name}`,
            createdAt: now.toISOString()
          };
          await this.punchEventRepository.upsert(newPunchEvent);
        } catch (err) {
          console.error('Failed to save punch event in Supabase. Rolling back coupon and employee updates...', err);
          try {
            await this.employeeRepository.upsert(originalEmployee);
            await this.couponRepository.upsert(originalCoupon);
          } catch (rollbackErr) {
            console.error('CRITICAL: Failed to rollback updates in Supabase!', rollbackErr);
          }
          return { success: false, message: 'Database error while recording punch event in Supabase.' };
        }

        // All Supabase operations succeeded, update local state
        this._coupons.update((coupons) =>
          coupons.map((c) => (c.couponId === availableCoupon.couponId ? updatedCoupon : c))
        );
        this._employees.update((employees) =>
          employees.map((e) => (e.id === employee!.id ? updatedEmployee : e))
        );

        return {
          success: true,
          message: `${availableCoupon.couponType} coupon redeemed successfully for ${employee.name}`,
        };
      }

      // If Supabase isn't active, log error as it's required.
      console.error('Supabase is not configured, cannot redeem QR');
      return { success: false, message: 'Supabase is not configured.' };
    } catch (err) {
      console.error(err);
      return {
        success: false,
        message: 'Failed to redeem employee QR',
      };
    }
  }
  getEmployeeCouponSummary(
    qrText: string
  ) {
  
    let employee: Employee | undefined;
  
    if (qrText.startsWith('EMP:')) {
  
      const employeeId =
        Number(
          qrText.replace('EMP:', '').trim()
        );
  
      employee =
        this._employees().find(
          e => e.id === employeeId
        );
  
    } else {
  
      employee =
        this._employees().find(
          e => e.assignedQrCard === qrText
        );
  
    }
  
    if (!employee) {
      return null;
    }
  
    const available =
      this._coupons().filter(
        c =>
          c.employeeId === employee.id &&
          c.status === 'issued'
      );
  
    const redeemed =
      this._coupons().filter(
        c =>
          c.employeeId === employee.id &&
          c.status === 'redeemed'
      );
  
    return {
  
      employeeName:
        employee.name,
  
      employeeId:
        employee.employeeId,
  
      breakfast:
        available.filter(
          c =>
            c.couponType ===
            'Breakfast'
        ).length,
  
      lunchDinner:
        available.filter(
          c =>
            c.couponType ===
            'Lunch/Dinner'
        ).length,
  
      totalAvailable:
        available.length,
  
      totalRedeemed:
        redeemed.length
  
    };
  
  }
  removeLastCouponBatch(
    employeeId: number
  ): { success: boolean; message: string; removedCount: number } {
    const allCoupons = this._coupons();

    const employeeUnredeemedCoupons = allCoupons.filter(
      (c) => c.employeeId === employeeId && c.status === 'issued'
    );

    if (employeeUnredeemedCoupons.length === 0) {
      return {
        success: false,
        message: 'No unredeemed coupons found for this employee.',
        removedCount: 0,
      };
    }

    let mostRecentDate = '';
    employeeUnredeemedCoupons.forEach((coupon) => {
      if (coupon.dateIssued > mostRecentDate) {
        mostRecentDate = coupon.dateIssued;
      }
    });

    if (!mostRecentDate) {
      return {
        success: false,
        message: 'Could not determine the most recent coupon batch.',
        removedCount: 0,
      };
    }

    const couponsBeforeLength = allCoupons.length;

    const couponsAfter = allCoupons.filter((coupon) => {
      const isFromLastBatch =
        coupon.employeeId === employeeId &&
        coupon.status === 'issued' &&
        coupon.dateIssued === mostRecentDate;
      return !isFromLastBatch;
    });

    const removedCount = couponsBeforeLength - couponsAfter.length;

    if (removedCount > 0) {
      this._coupons.set(couponsAfter);
      this.syncAllCouponsToDatabase();
      return {
        success: true,
        message: `Successfully removed the last batch of ${removedCount} coupon(s).`,
        removedCount,
      };
    } else {
      return {
        success: false,
        message: 'No coupons were removed. An unexpected error occurred.',
        removedCount: 0,
      };
    }
  }
  removeLastContractorCouponBatch(
    contractorId: number
  ): { success: boolean; message: string; removedCount: number } {
  
    const allCoupons = this._coupons();
  
    const contractorUnredeemedCoupons =
      allCoupons.filter(
        (c) =>
          c.contractorId === contractorId &&
          c.status === 'issued'
      );
  
    if (contractorUnredeemedCoupons.length === 0) {
      return {
        success: false,
        message: 'No contractor coupons found.',
        removedCount: 0,
      };
    }
  
    let mostRecentDate = '';
  
    contractorUnredeemedCoupons.forEach((coupon) => {
      if (coupon.dateIssued > mostRecentDate) {
        mostRecentDate = coupon.dateIssued;
      }
    });
  
    const couponsBeforeLength =
      allCoupons.length;
  
    const couponsAfter =
      allCoupons.filter((coupon) => {
  
        const isFromLastBatch =
          coupon.contractorId === contractorId &&
          coupon.status === 'issued' &&
          coupon.dateIssued === mostRecentDate;
  
        return !isFromLastBatch;
  
      });
  
    const removedCount =
      couponsBeforeLength -
      couponsAfter.length;
  
    if (removedCount > 0) {
  
      this._coupons.set(couponsAfter);
  
      this.syncAllCouponsToDatabase();
  
      return {
        success: true,
        message: `Successfully removed the last batch of ${removedCount} contractor coupon(s).`,
        removedCount,
      };
  
    }
  
    return {
      success: false,
      message: 'No coupons were removed.',
      removedCount: 0,
    };
  
  }
  // ✅ NEW FLOW:
  // Employee → Guest Pass Request (with guestName & guestCompany)
  generateGuestPassFromEmployeeCoupon(
    employeeId: number,
    employeeName: string,
    guestName: string,
    guestCompany: string,
    couponType: Coupon['couponType']
  ): { success: boolean; message: string } {
    const trimmedGuestName = guestName.trim();
    const trimmedGuestCompany = guestCompany.trim();

    if (!trimmedGuestName || !trimmedGuestCompany) {
      return {
        success: false,
        message: 'Please enter guest full name and company.',
      };
    }

    const GUEST_PASS_DAILY_LIMIT = 5;
    const todayStr = new Date().toISOString().split('T')[0];

    const todaysRequests = this._guestCouponRequests().filter(
      (r) =>
        r.employeeId === employeeId &&
        r.couponType === couponType &&
        String(r.requestDate ?? "").startsWith(todayStr)
    ).length;

    if (todaysRequests >= GUEST_PASS_DAILY_LIMIT) {
      return {
        success: false,
        message: `You have reached your daily limit of ${GUEST_PASS_DAILY_LIMIT} ${couponType} guest pass requests.`,
      };
    }

    const requestId = this.generateGuestRequestId();
    const newRequest: GuestCouponRequest = {
      id: requestId,
      employeeId,
      employeeName,
      guestName: trimmedGuestName,
      guestCompany: trimmedGuestCompany,
      couponType,
      status: 'pending_admin',
      requestDate: new Date().toISOString(),
      requestedBy: 'employee',
    };

    // Add to local state
    this._guestCouponRequests.update((reqs) => [newRequest, ...reqs]);

    // Notify all admins
    const admins = this._employees().filter((e) => e.role === 'admin');
    const nowIso = new Date().toISOString();

    const newNotifications: AppNotification[] = admins.map((admin) => ({
      id: this.generateNotificationId(),
      employeeId: admin.id,
      message: `${employeeName} requested a ${couponType} guest pass for ${trimmedGuestName} (${trimmedGuestCompany}).`,
      type: 'guest_pass_request',
      isRead: false,
      createdAt: nowIso,
      relatedRequestId: requestId,
      requesterEmployeeId: employeeId,
    }));

    this._notifications.update((list) => [...newNotifications, ...list]);
          // Sync to Database
    this.syncAllGuestCouponRequestsToDatabase();
    this.syncAllNotificationsToDatabase();

    return {
      success: true,
      message:
        'Guest pass request has been sent to admin for approval. You will be notified once it is processed.',
    };
  }

  // Admin helper: get pending & processed guest requests
  getPendingGuestCouponRequests(): GuestCouponRequest[] {
    return this._guestCouponRequests().filter(
      (r) =>
        (
          r.requestedBy === 'employee' &&
          r.status === 'pending_employee'
        ) ||
        (
          r.requestedBy === 'canteen_manager' &&
          r.status === 'pending_admin'
        )
    );
  }
  createPendingMealRequest(
    employeeId: number,
    employeeName: string,
    mealType: 'morning' | 'lunch' | 'evening' | 'dinner'
  ): { success: boolean; message: string } {
  
    const todayStr =
      new Date().toISOString().split('T')[0];
  
    const alreadyExists =
      this._pendingMealRequests().some(
        r =>
          r.employeeId === employeeId &&
          r.mealType === mealType &&
          r.mealDate === todayStr &&
          r.status === 'pending'
      );
  
    if (alreadyExists) {
      return {
        success: false,
        message:
          'Pending meal request already exists.'
      };
    }
  
    const newRequest: PendingMealRequest = {
      requestId:
        'PMR-' + Date.now(),
      employeeId,
      employeeName,
      mealType,
      mealDate: todayStr,
      status: 'pending'
    };
  
    this._pendingMealRequests.update(
      list => [newRequest, ...list]
    );
    this.syncAllPendingMealRequestsToDatabase();
  
    return {
      success: true,
      message:
        'Meal request created successfully.'
    };
  }
  getProcessedGuestCouponRequests(): GuestCouponRequest[] {
    return this._guestCouponRequests().filter((r) => r.status !== 'pending_employee');
  }
  
  approveGuestCouponByEmployee(
    requestId: string,
    employeeId: number
  ): { success: boolean; message: string } {
  
    const request = this._guestCouponRequests().find(
      r => r.id === requestId
    );
  
    if (!request) {
      return {
        success: false,
        message: 'Guest pass request not found.'
      };
    }
  
    if (request.status !== 'pending_employee') {
      return {
        success: false,
        message: 'This request is already processed.'
      };
    }
  
    this._guestCouponRequests.update(reqs =>
      reqs.map(r =>
        r.id === requestId
          ? {
              ...r,
              status: 'pending_admin',
              employeeDecisionDate: new Date().toISOString(),
              employeeApprovedBy: employeeId
            }
          : r
      )
    );
  
    // Notify Admins
    const admins =
      this._employees().filter(
        e => e.role === 'admin'
      );
  
    const notifications =
      admins.map(admin => ({
        id: this.generateNotificationId(),
        employeeId: admin.id,
        message:
          `${request.employeeName} approved guest pass for ${request.guestName}. Please review.`,
        type: 'guest_pass_request' as const,
        isRead: false,
        createdAt: new Date().toISOString(),
        relatedRequestId: requestId
      }));
  
    this._notifications.update(
      list => [...notifications, ...list]
    );
  
    this.syncAllGuestCouponRequestsToDatabase();
    this.syncAllNotificationsToDatabase();
  
    return {
      success: true,
      message: 'Guest pass sent to Admin.'
    };
  
  }

  // Admin: Approve guest pass → generate actual guest coupon
  approveGuestCouponRequest(
    requestId: string,
    adminId: number
  ): { success: boolean; message: string } {
    const request = this._guestCouponRequests().find((r) => r.id === requestId);
    console.log('REQUEST DEBUG:', request);
    console.log('REQUESTED BY:', request?.requestedBy);
    if (!request) {
      return { success: false, message: 'Guest pass request not found.' };
    }
    if (request.status !== 'pending_admin') {
      return { success: false, message: 'This request is already processed.' };
    }
    if (request.requestedBy === 'canteen_manager') {

      this._guestCouponRequests.update((reqs) =>
        reqs.map((r) =>
          r.id === requestId
            ? {
              ...r,
              status: 'redeemed',
              servedDate: new Date().toISOString(),
              decisionDate: new Date().toISOString(),
              adminId
            }
            : r
        )
      );
    
      this.syncAllGuestCouponRequestsToDatabase();

      const hostEmployee = this._employees().find(e => e.id === request.employeeId);
      const hostName = hostEmployee?.name || 'Unknown';
      const guestName = request.guestName || 'Unknown';
      const guestCompany = request.guestCompany || 'N/A';
      const couponType = request.couponType || 'Unknown';
        
      const newPunchEvent: PunchEvent = {
        id: `GUEST-${Date.now()}`,
        employeeId: request.employeeId || 0,
        resultType: 'redeemed',
        message: `GUEST_PASS_REDEEMED|${guestName}|${guestCompany}|${hostName}|${couponType}`,
        createdAt: new Date().toISOString()
      };
      
      this.punchEventRepository.upsert(newPunchEvent).catch(err => {
        console.error('Failed to save guest punch event', err);
      });
    
      return {
        success: true,
        message: 'Guest meal approved and directly redeemed.'
      };
    }
    // Generate unique coupon code
    const existingCodes = new Set(
      this._coupons()
        .filter((c) => c.status === 'issued')
        .map((c) => c.redemptionCode)
    );
    let newCode: string;
    do {
      newCode = this.generateRedemptionCode();
    } while (existingCodes.has(newCode));
    const slot = this.getSlotFromCouponType(request.couponType);
    const guestCoupon: Coupon = {
      couponId: this.generateCouponId(),
      dateIssued: new Date().toISOString(),
      status: 'issued',
      redeemDate: null,
      redemptionCode: newCode,
      couponType: request.couponType,
      slot,
      isGuestCoupon: true,
      sharedByEmployeeId: request.employeeId,
      guestName: request.guestName,
      guestCompany: request.guestCompany,
    };

    // Update coupons list
    this._coupons.update((coupons) => [guestCoupon, ...coupons]);

    // Update request
    this._guestCouponRequests.update((reqs) =>
      reqs.map((r) =>
        r.id === requestId
          ? {
              ...r,
              status: 'approved',
              decisionDate: new Date().toISOString(),
              adminId,
              generatedCouponId: guestCoupon.couponId,
            }
          : r
      )
    );

    // Notify requesting employee
    const approvalNotif: AppNotification = {
      id: this.generateNotificationId(),
      employeeId: request.employeeId,
      message: `Your guest pass request for ${request.guestName} (${request.guestCompany}) for ${request.couponType} has been approved. Coupon code: ${guestCoupon.redemptionCode}.`,
      type: 'system',
      isRead: false,
      createdAt: new Date().toISOString(),
      relatedRequestId: requestId,
      relatedCouponId: guestCoupon.couponId,
      requesterEmployeeId: request.employeeId,
    };

    this._notifications.update((list) => [approvalNotif, ...list]);
    this.pushNotificationService.sendToEmployee(
      request.employeeId,
      "Guest Pass Approved",
      approvalNotif.message,
      {
          notification_type: "guest_pass_approved"
      }
    );

    this.syncAllCouponsToDatabase();
    this.syncAllGuestCouponRequestsToDatabase();
    this.syncAllNotificationsToDatabase();

    return {
      success: true,
      message: 'Guest pass request approved and guest coupon generated.',
    };
  }

  createGuestPassRequestFromCanteenManager(
    employeeId: number,
    employeeName: string,
    guestName: string,
    guestCompany: string,
    couponType: Coupon['couponType']
  ): { success: boolean; message: string } {
  
    const requestId =
      this.generateGuestRequestId();
  
    const newRequest: GuestCouponRequest = {
      id: requestId,
      employeeId,
      employeeName,
      guestName,
      guestCompany,
      couponType,
      status: 'pending_employee',
      requestDate: new Date().toISOString(),
      requestedBy: 'canteen_manager'
    };
  
    this._guestCouponRequests.update(
      reqs => [newRequest, ...reqs]
    );
    const admins =
  this._employees().filter(
    e => e.role === 'admin'
  );

const notifications =
  admins.map(admin => ({
    id: this.generateNotificationId(),
    employeeId: admin.id,
    message:
      `Canteen Manager requested guest pass for ${guestName} (${guestCompany}) under employee ${employeeName}.`,
      type: 'guest_pass_request' as const,
    isRead: false,
    createdAt: new Date().toISOString(),
    relatedRequestId: requestId
  }));

this._notifications.update(
  list => [...notifications, ...list]
);

this.syncAllNotificationsToDatabase();
    this.syncAllGuestCouponRequestsToDatabase();
  
    return {
      success: true,
      message: 'Guest pass request sent to admin.'
    };
  }

  rejectGuestCouponByEmployee(
    requestId: string,
    employeeId: number,
    reason?: string
  ): { success: boolean; message: string } {
  
    const request =
      this._guestCouponRequests().find(
        r => r.id === requestId
      );
  
    if (!request) {
      return {
        success: false,
        message: 'Guest pass request not found.'
      };
    }
  
    if (request.status !== 'pending_employee') {
      return {
        success: false,
        message: 'This request is already processed.'
      };
    }
  
    this._guestCouponRequests.update(reqs =>
      reqs.map(r =>
        r.id === requestId
          ? {
              ...r,
              status: 'rejected',
              employeeDecisionDate: new Date().toISOString(),
              employeeApprovedBy: employeeId,
              employeeRejectedReason: reason
            }
          : r
      )
    );
  
    this.syncAllGuestCouponRequestsToDatabase();
  
    return {
      success: true,
      message: 'Guest pass rejected.'
    };
  
  }
  
  // Admin: Reject guest pass request
  rejectGuestCouponRequest(
    requestId: string,
    adminId: number,
    reason?: string
  ): { success: boolean; message: string } {
    const request = this._guestCouponRequests().find((r) => r.id === requestId);
    if (!request) {
      return { success: false, message: 'Guest pass request not found.' };
    }
    if (request.status !== 'pending_admin') {
      return { success: false, message: 'This request is already processed.' };
    }

    this._guestCouponRequests.update((reqs) =>
      reqs.map((r) =>
        r.id === requestId
          ? {
              ...r,
              status: 'rejected',
              decisionDate: new Date().toISOString(),
              adminId,
              rejectionReason: reason,
            }
          : r
      )
    );

    const rejectionNotif: AppNotification = {
      id: this.generateNotificationId(),
      employeeId: request.employeeId,
      message:
        `Your guest pass request for ${request.guestName} (${request.guestCompany}) for ${request.couponType} was rejected by Admin.` +
         (reason ? ` Reason: ${reason}` : ''),
      type: 'system',
      isRead: false,
      createdAt: new Date().toISOString(),
      relatedRequestId: requestId,
      requesterEmployeeId: request.employeeId,
    };

    this._notifications.update((list) => [rejectionNotif, ...list]);
    this.pushNotificationService.sendToEmployee(
      request.employeeId,
      "Guest Pass Rejected",
      rejectionNotif.message,
      {
          notification_type: "guest_pass_rejected"
      }
     );

    this.syncAllGuestCouponRequestsToDatabase();
    this.syncAllNotificationsToDatabase();

    return {
      success: true,
      message: 'Guest pass request rejected.',
    };
  }

  // =========================
  // Notification methods
  // =========================

  markNotificationAsRead(notificationId: string) {
    this._notifications.update((notifications) =>
      notifications.map((n) =>
        n.id === notificationId ? { ...n, isRead: true } : n
      )
    );
    this.syncAllNotificationsToDatabase();
  }

  markAllNotificationsAsRead(employeeId: number) {
    this._notifications.update((notifications) =>
      notifications.map((n) =>
        n.employeeId === employeeId ? { ...n, isRead: true } : n
      )
    );
    this.syncAllNotificationsToDatabase();
  }

  // =========================
  // Menu methods
  // =========================

  getMenuForDate(dateId: string): DailyMenu | undefined {
    return this._menus().find((m) => m.id === dateId);
  }

  upsertMenu(menuData: Omit<DailyMenu, 'date'>) {
    const existingMenu = this._menus().find((m) => m.id === menuData.id);
    const date = new Date(`${menuData.id}T12:00:00Z`); // Use noon to avoid timezone issues
    if (existingMenu) {
      this._menus.update((menus) =>
        menus.map((m) =>
          m.id === menuData.id ? { ...menuData, date: date.toISOString() } : m
        )
      );
    } else {
      const newMenu: DailyMenu = {
        ...menuData,
        date: date.toISOString(),
      };
      this._menus.update((menus) => [...menus, newMenu]);
    }
    this.syncAllMenusToDatabase();
    this.pushNotificationService.sendToAllEmployees(
      "Today's Canteen Menu Updated",
      "Today's canteen menu has been updated. Please check the latest menu.",
      {
          notification_type: "menu_updated"
      }
  );
  }
}
