import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { DataService } from '../../services/data.service';
import { Coupon } from '../../models/coupon.model';
import { RouterLink } from '@angular/router';

type AlertType = 'none' | 'redeemed' | 'not_available' | 'already_redeemed';

@Component({
  selector: 'app-canteen-manager-dashboard',
  templateUrl: './canteen-manager-dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
})
export class CanteenManagerDashboardComponent {
  private dataService = inject(DataService);

  // ========= Existing state =========
  selectedDate = signal(new Date().toISOString().split('T')[0]);
  showGuestPassForm = signal(false);

  // ========= View All Modal state =========
  viewAllModalOpen = signal(false);
  viewAllMealType = signal<string | null>(null);

  contractorsObjMap = computed(() => {
    const map = new Map<number, any>();
    for (const c of this.dataService.contractors()) {
      map.set(c.id, c);
    }
    return map;
  });

  employeesObjMap = computed(() => {
    const map = new Map<number, any>();
    for (const emp of this.dataService.employees()) {
      map.set(emp.id, emp);
    }
    return map;
  });

  viewAllList = computed(() => {
    const type = this.viewAllMealType();
    if (!type) return [];

    if (type === 'Guest Pass') {
      return this.guestPassesForDay().map(guest => ({
        id: guest.id,
        isGuest: true,
        guestName: guest.guestName,
        guestCompany: guest.guestCompany,
        requestedBy: guest.employeeName,
        servedTime: this.formatTime(guest.servedDate || null),
      }));
    } else {
      const coupons = this.redeemedCouponsForDay().filter(c => c.couponType === type);
      const empMap = this.employeesObjMap();
      const conMap = this.contractorsObjMap();

      return coupons.map(c => {
        if (c.employeeId) {
          const emp = empMap.get(c.employeeId);
          return {
            id: c.couponId,
            isGuest: false,
            name: emp?.name || 'Unknown',
            badgeId: emp?.employeeId || `ID: ${c.employeeId}`,
            redeemTime: this.formatTime(c.redeemDate),
          };
        } else if (c.contractorId) {
          const con = conMap.get(c.contractorId);
          return {
            id: c.couponId,
            isGuest: false,
            name: con?.name || con?.businessName || 'Unknown Contractor',
            badgeId: con?.contractorId || `Con #${c.contractorId}`,
            redeemTime: this.formatTime(c.redeemDate),
          };
        }
        return {
          id: c.couponId,
          isGuest: false,
          name: 'Unknown',
          badgeId: 'N/A',
          redeemTime: this.formatTime(c.redeemDate),
        };
      });
    }
  });

  openViewAllModal(type: string) {
    this.viewAllMealType.set(type);
    this.viewAllModalOpen.set(true);
  }

  closeViewAllModal() {
    this.viewAllModalOpen.set(false);
    this.viewAllMealType.set(null);
  }

  selectedEmployeeId = signal<number | null>(null);

   guestName = signal('');

  guestCompany = signal('');
  
guestMealType =
  signal<Coupon['couponType']>('Lunch/Dinner');
  couponTypes: Coupon['couponType'][] = [
    'Breakfast',
    'Lunch/Dinner',
    'Snacks',
    'Beverage',
  ];

  employeesMap = computed(() => {
    const map = new Map<number, string>();
    for (const emp of this.dataService.employees()) {
      map.set(emp.id, emp.name);
    }
    return map;
  });

  searchText = signal('');

employees = computed(() =>
  this.dataService
    .employees()
    .filter(
      e =>
        e.status === 'active' &&
        e.role !== 'admin' &&
        e.role !== 'canteen manager'
    )
    .filter(e => {

      const search =
        this.searchText()
          .trim()
          .toLowerCase();

      if (!search) {
        return true;
      }

      return (
        e.employeeId
          .toLowerCase()
          .includes(search) ||

        e.name
          .toLowerCase()
          .includes(search)
      );
    })
);

  // 🔁 live punch history (जर UI मध्ये वापरायचा असेल तर)
  punchHistory = computed(() => this.dataService.punchEventsHistory());

  parsePunchMessage(msg: string) {
    if (msg.startsWith('GUEST_PASS_REDEEMED|')) {
      const parts = msg.split('|');
      return {
        isGuest: true,
        title: 'Guest Pass Redeemed',
        guestName: parts[1] || 'Unknown',
        guestCompany: parts[2] || 'N/A',
        hostEmployee: parts[3] || 'Unknown',
        couponType: parts[4] || 'Unknown'
      };
    }
    // Handle old format for backward compatibility
    if (msg.includes('Guest Pass Redeemed')) {
      return {
        isGuest: true,
        title: 'Guest Pass Redeemed',
        originalMessage: msg
      };
    }
    return {
      isGuest: false,
      originalMessage: msg
    };
  }

  private allRedeemedCoupons = computed(() => {
    return this.dataService
      .coupons()
      .filter((c) => c.status === 'redeemed' && c.redeemDate && !c.isGuestCoupon);
  });

  private allRedeemedGuestCoupons = computed(() => {
    return this.dataService
      .coupons()
      .filter((c) => c.status === 'redeemed' && c.redeemDate && c.isGuestCoupon);
  });

  private redeemedGuestRequests = computed(() =>
    this.dataService
      .guestCouponRequests()
      .filter(
        r =>
          r.requestedBy === 'canteen_manager' &&
          r.status === 'redeemed' &&
          r.servedDate
      )
  );
  todaysMenu = computed(() => {
    const today = new Date();
    const todayId = `${today.getFullYear()}-${(today.getMonth() + 1)
      .toString()
      .padStart(2, '0')}-${today
      .getDate()
      .toString()
      .padStart(2, '0')}`;
    return this.dataService.getMenuForDate(todayId);
  });

  todayRedeemedBreakfast = computed(() => {

    const todayStr =
      new Date().toISOString().split('T')[0];
  
    const couponCount =
      this.allRedeemedCoupons().filter(
        c =>
          c.couponType === 'Breakfast' &&
          c.redeemDate!.startsWith(todayStr)
      ).length;
  
    return couponCount;
  
  });

  todayRedeemedLunchDinner = computed(() => {

    const todayStr =
      new Date().toISOString().split('T')[0];
  
    const couponCount =
      this.allRedeemedCoupons().filter(
        c =>
          c.couponType === 'Lunch/Dinner' &&
          c.redeemDate!.startsWith(todayStr)
      ).length;
  
    return couponCount;
  
  });

  monthlyRedeemedBreakfast = computed(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    return this.allRedeemedCoupons().filter((c) => {
      if (c.couponType === 'Breakfast') {
        const redeemDate = new Date(c.redeemDate!);
        return (
          redeemDate.getFullYear() === currentYear &&
          redeemDate.getMonth() === currentMonth
        );
      }
      return false;
    }).length;
  });

  monthlyRedeemedLunchDinner = computed(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    return this.allRedeemedCoupons().filter((c) => {
      if (c.couponType === 'Lunch/Dinner') {
        const redeemDate = new Date(c.redeemDate!);
        return (
          redeemDate.getFullYear() === currentYear &&
          redeemDate.getMonth() === currentMonth
        );
      }
      return false;
    }).length;
  });

  todayGuestPassRedeemed = computed(() => {

    const todayStr =
      new Date().toISOString().split('T')[0];
  
    const directRequests = this.dataService
      .guestCouponRequests()
      .filter(
        r =>
          r.requestedBy === 'canteen_manager' &&
          r.status === 'redeemed' &&
          r.servedDate?.startsWith(todayStr)
      )
      .length;

    const guestCoupons = this.allRedeemedGuestCoupons()
      .filter(c => c.redeemDate?.startsWith(todayStr))
      .length;

    return directRequests + guestCoupons;
  
  });
  
  monthlyGuestPassRedeemed = computed(() => {
  
    const now = new Date();
  
    const directRequests = this.dataService
      .guestCouponRequests()
      .filter(r => {
  
        if (
          r.requestedBy !== 'canteen_manager' ||
          r.status !== 'redeemed' ||
          !r.servedDate
        ) {
          return false;
        }
  
        const d = new Date(r.servedDate);
  
        return (
          d.getMonth() === now.getMonth() &&
          d.getFullYear() === now.getFullYear()
        );
  
      }).length;

    const guestCoupons = this.allRedeemedGuestCoupons()
      .filter(c => {
        const d = new Date(c.redeemDate!);
        return (
          d.getMonth() === now.getMonth() &&
          d.getFullYear() === now.getFullYear()
        );
      }).length;

    return directRequests + guestCoupons;
  
  });

  redeemedCouponsForDay = computed(() => {
    const selected = this.selectedDate();
    return this.allRedeemedCoupons().filter((c) =>
      c.redeemDate?.startsWith(selected)
    );
  });

  guestPassesForDay = computed(() => {

    const selected =
      this.selectedDate();
  
    return this.dataService
      .guestCouponRequests()
      .filter(
        r =>
          r.status === 'redeemed' &&
          r.servedDate?.startsWith(selected)
      );
  
  });
  guestRequestStatusList = computed(() => {

    return this.dataService
      .guestCouponRequests()
      .filter(
        r => r.requestedBy === 'canteen_manager'
      )
      .sort(
        (a, b) =>
          new Date(b.requestDate as any).getTime() -
          new Date(a.requestDate as any).getTime()
      )
      .slice(0, 5);
  
  });

  groupedCoupons = computed(() => {
    const groups: { [key in Coupon['couponType']]?: Coupon[] } = {};
    for (const coupon of this.redeemedCouponsForDay()) {
      if (!groups[coupon.couponType]) {
        groups[coupon.couponType] = [];
      }
      groups[coupon.couponType]!.push(coupon);
    }
    return groups;
  });

  onDateChange(event: Event) {
    this.selectedDate.set((event.target as HTMLInputElement).value);
  }

  formatTime(isoString: string | null): string {
    if (!isoString) return '';
    const date = new Date(isoString);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  // ========= Alert + Sounds =========

  alertVisible = signal(false);
  alertType = signal<AlertType>('none');
  alertMessage = signal('');
  alertEmployeeName = signal('');

  // शेवटचा कोणता punchEvent highlight झालेला आहे
  private lastAlertedEventId = signal<string | null>(null);

  // sounds
    constructor() {
    // 🔹 1) component load होताना आधीच Database मध्ये असलेला शेवटचा event
    // baseline म्हणून फक्त store करायचा, highlight नाही
    const current = this.dataService.lastPunchEvent();
    if (current) {
      this.lastAlertedEventId.set(current.id);
    }

    // 🔹 2) आता पासून येणारे *नवीन* punchEvents साठीच effect चालेल
    effect(() => {
      const ev = this.dataService.lastPunchEvent();
      if (!ev) return;

      const lastId = this.lastAlertedEventId();

      // हा event आधीच highlight केलेला / baseline असेल तर काही करू नको
      if (lastId === ev.id) {
        return;
      }

      // हा खरा नवीन punch event आहे → आता mark + highlight
      this.lastAlertedEventId.set(ev.id);

      const name =
        this.employeesMap().get(ev.employeeId) ??
        (ev.employeeId ? `Emp #${ev.employeeId}` : 'this employee');

      if (ev.resultType === 'redeemed') {
        this.showRedeemedAlert(ev.employeeId);
      } else if (ev.resultType === 'already_redeemed') {
        this.showAlreadyRedeemedAlert(ev.employeeId);
      } else if (ev.resultType === 'not_available') {
        this.showNotAvailableAlert(ev.employeeId);
      } else {
        this.showNotAvailableAlert(
          ev.employeeId,
          `Error while redeeming coupon for ${name}.`
        );
      }
    });
  }

  // Helper: employeeId → name
  getEmployeeName(employeeId: number | null | undefined): string {
    if (!employeeId) return '';
    return this.employeesMap().get(employeeId) ?? `Emp #${employeeId}`;
  }

  /** Coupon successfully redeemed */
  showRedeemedAlert(employeeId: number | null | undefined, message?: string) {
    const name = this.getEmployeeName(employeeId);
    const finalMsg =
      message ?? (name ? `Coupon redeemed for ${name}.` : 'Coupon redeemed.');
    this.showAlert('redeemed', finalMsg, name);
  }

  /** Coupon नाही / No active coupon */
  showNotAvailableAlert(
    employeeId: number | null | undefined,
    message?: string
  ) {
    const name = this.getEmployeeName(employeeId);
    const finalMsg =
      message ??
      (name
        ? `Coupon not available for ${name}.`
        : 'Coupon not available for this employee.');

    this.showAlert('not_available', finalMsg, name);
  }

  /** Coupon already redeemed झालेला */
  showAlreadyRedeemedAlert(
    employeeId: number | null | undefined,
    message?: string
  ) {
    const name = this.getEmployeeName(employeeId);
    const finalMsg =
      message ??
      (name
        ? `Coupon already redeemed for ${name} today.`
        : 'Coupon already redeemed for this employee today.');

    this.showAlert('already_redeemed', finalMsg, name);
  }

  // Main internal alert handler
  private showAlert(type: AlertType, msg: string, empName?: string) {
    this.alertType.set(type);
    this.alertMessage.set(msg);
    this.alertEmployeeName.set(empName ?? '');
    this.alertVisible.set(true);

    this.stopAllSounds();

    try {
      if (type === 'redeemed') {
            }
    } catch {
      // ignore autoplay error
    }

    // ⏱ highlight किती वेळ दिसावा → इथे 3 सेकंद
    setTimeout(() => {
      this.alertVisible.set(false);
      this.alertType.set('none');
    }, 3000);
  }

  hideAlert() {
    this.alertVisible.set(false);
    this.alertType.set('none');
    this.stopAllSounds();
  }
  submitGuestPassRequest() {

    const employee =
      this.dataService
        .employees()
        .find(
          e =>
            e.id ===
            this.selectedEmployeeId()
        );
  
    if (!employee) {
  
      alert(
        'Please select employee.'
      );
  
      return;
    }
  
    const result =
      this.dataService
        .createGuestPassRequestFromCanteenManager(
          employee.id,
          employee.name,
          this.guestName(),
          this.guestCompany(),
          this.guestMealType()
        );
  
    alert(result.message);
  
    if (result.success) {
  
      this.guestName.set('');
      this.guestCompany.set('');
      this.searchText.set('');
  
      this.showGuestPassForm.set(false);
  
    }
  }
  private stopAllSounds() {
    }
}
