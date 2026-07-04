import { Component, ChangeDetectionStrategy, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { DataService } from '../../services/data.service';
import { Coupon } from '../../models/coupon.model';
import * as QRCode from 'qrcode';
import { GuestCouponRequest } from '../../models/guest-coupon-request.model';
import { toPng } from 'html-to-image';

@Component({
  selector: 'app-employee-dashboard',
  templateUrl: './user-dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
})
export class EmployeeDashboardComponent {
  constructor() {

    setTimeout(() => {
      this.generatePermanentEmployeeQr();
    }, 500);
  
  }
  private authService = inject(AuthService);
  private dataService = inject(DataService);
  
  currentEmployee = this.authService.currentUser;

  // Modals
  isRedeemModalOpen = signal(false);
  isHistoryModalOpen = signal(false);
  isGenerateGuestPassModalOpen = signal(false);
  isGuestHistoryModalOpen = signal(false);
  isGuestQrModalOpen = signal(false);

  // Redeem coupon modal state
  selectedCouponForRedemption = signal<Coupon | null>(null);
  qrCodeDataUrl = signal<string | null>(null);

  employeeQrCodeDataUrl = signal<string | null>(null);

  // Guest QR modal state
  selectedGuestCouponForQr = signal<Coupon | null>(null);
  guestPassQrCodeDataUrl = signal<string | null>(null);

  // Guest Pass Request form state
  guestName = signal('');
  guestCompany = signal('');
  guestPassTypes: Coupon['couponType'][] = ['Breakfast', 'Lunch/Dinner'];
  selectedGuestCouponType = signal<Coupon['couponType'] | null>(null);
  requestError = signal<string | null>(null);
  requestSuccess = signal<string | null>(null);
  requestSubmitting = signal(false);
  isApproveGuestPopupOpen = signal(false);

  selectedGuestRequest =
  signal<GuestCouponRequest | null>(null);

  // Sharing helpers
  whatsAppShareMessage = signal('');
  copySuccess = signal(false);

  private getTodayId(): string {
    const today = new Date();
    return `${today.getFullYear()}-${(today.getMonth() + 1)
      .toString()
      .padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
  }

  private allEmployeeCoupons = computed(() => {
    const employee = this.currentEmployee();
    if (!employee) return [];
    return this.dataService.getCouponsForEmployee(employee.id);
  });
  
  todaysMenu = computed(() => {
    return this.dataService.getMenuForDate(this.getTodayId());
  });

  nextAvailableCoupons = computed(() => {
    const issuedCoupons = this.allEmployeeCoupons().filter((c) => c.status === 'issued');
    issuedCoupons.sort(
      (a, b) => new Date(a.dateIssued).getTime() - new Date(b.dateIssued).getTime()
    );
    
    const nextCouponsMap = new Map<Coupon['couponType'], Coupon>();
    for (const coupon of issuedCoupons) {
      if (!nextCouponsMap.has(coupon.couponType)) {
        nextCouponsMap.set(coupon.couponType, coupon);
      }
    }
    
    const mealTypeOrder: Coupon['couponType'][] = [
      'Lunch/Dinner',
      'Breakfast',
      'Snacks',
      'Beverage',
    ];
    const result: Coupon[] = [];
    for (const mealType of mealTypeOrder) {
      if (nextCouponsMap.has(mealType)) {
        result.push(nextCouponsMap.get(mealType)!);
      }
    }
    
    return result;
  });
  
  guestCouponStats = computed(() => {

    const employee = this.currentEmployee();
  
    if (!employee) {
      return {
        generated: 0,
        redeemed: 0
      };
    }
  
    const allCoupons =
      this.dataService.coupons();
  
    const generatedByMe =
      allCoupons.filter(
        c =>
          c.isGuestCoupon &&
          c.sharedByEmployeeId === employee.id
      );
  
    const couponRedeemedCount =
      generatedByMe.filter(
        c => c.status === 'redeemed'
      ).length;
  
    const directRedeemedCount =
      this.dataService
        .guestCouponRequests()
        .filter(
          r =>
            r.employeeId === employee.id &&
            r.requestedBy === 'canteen_manager' &&
            r.status === 'redeemed'
        )
        .length;
  
    return {
  
      generated:
        generatedByMe.length,
  
      redeemed:
        couponRedeemedCount +
        directRedeemedCount
  
    };
  
  });

  redeemedCouponsHistory = computed(() => {
    return this.allEmployeeCoupons()
      .filter((c) => c.status === 'redeemed' && c.redeemDate)
      .sort(
        (a, b) =>
          new Date(b.redeemDate!).getTime() - new Date(a.redeemDate!).getTime()
      );
  });
  
  generatedGuestCouponsHistory = computed(() => {
    const employee = this.currentEmployee();
    if (!employee) {
      return [];
    }
    return this.dataService
      .coupons()
      .filter((c) => c.isGuestCoupon && c.sharedByEmployeeId === employee.id)
      .sort(
        (a, b) =>
          new Date(b.dateIssued).getTime() - new Date(a.dateIssued).getTime()
      );
  });
  guestPassRequestsHistory = computed(() => {

    const employee = this.currentEmployee();
  
    if (!employee) {
      return [];
    }
  
    return this.dataService
      .guestCouponRequests()
      .filter(
        r => r.employeeId === employee.id
      )
      .sort(
        (a, b) =>
          new Date(b.requestDate).getTime() -
          new Date(a.requestDate).getTime()
      );
  
  });

  pendingGuestApprovals = computed(() => {

    const employee = this.currentEmployee();
  
    if (!employee) {
      return [];
    }
  
    return this.dataService
      .guestCouponRequests()
      .filter(r =>
        r.employeeId === employee.id &&
        r.requestedBy === 'canteen_manager' &&
        r.status === 'pending_employee'
      )
      .sort(
        (a, b) =>
          new Date(b.requestDate).getTime() -
          new Date(a.requestDate).getTime()
      );
  
  });

  totalCoupons = computed(() => this.allEmployeeCoupons().length);
  usedCoupons = computed(
    () => this.allEmployeeCoupons().filter((c) => c.status === 'redeemed').length
  );
  remainingCoupons = computed(
    () => this.totalCoupons() - this.usedCoupons()
  );

  breakfastCoupon = computed(() => {
    return this.nextAvailableCoupons().find(c => c.couponType === 'Breakfast') || null;
  });

  lunchDinnerCoupon = computed(() => {
    return this.nextAvailableCoupons().find(c => c.couponType === 'Lunch/Dinner') || null;
  });

  // =========================
  // Redeem coupon modal
  // =========================
  async openRedeemModal(coupon: Coupon) {
    this.selectedCouponForRedemption.set(coupon);
    this.isRedeemModalOpen.set(true);
    this.qrCodeDataUrl.set(null);

    try {
      const dataUrl = await QRCode.toDataURL(coupon.redemptionCode, {
        width: 256,
        margin: 2,
      });
      this.qrCodeDataUrl.set(dataUrl);
    } catch (err) {
      console.error('Failed to generate QR code', err);
      this.qrCodeDataUrl.set(null);
    }
  }

  closeRedeemModal() {
    this.isRedeemModalOpen.set(false);
    this.selectedCouponForRedemption.set(null);
    this.qrCodeDataUrl.set(null);
  }
  
  // =========================
  // Guest Pass Request flow
  // =========================
  openGenerateGuestPassModal() {
    this.isGenerateGuestPassModalOpen.set(true);
    this.guestName.set('');
    this.guestCompany.set('');
    this.selectedGuestCouponType.set(null);
    this.requestError.set(null);
    this.requestSuccess.set(null);
    this.requestSubmitting.set(false);
  }

  closeGenerateGuestPassModal() {
    this.isGenerateGuestPassModalOpen.set(false);
  }

  submitGuestPassRequest() {
    this.requestError.set(null);
    this.requestSuccess.set(null);

    const employee = this.currentEmployee();
    if (!employee) {
      this.requestError.set('Could not verify current user. Please log in again.');
      return;
    }

    const name = this.guestName().trim();
    const company = this.guestCompany().trim();
    const type = this.selectedGuestCouponType();

    if (!name || !company || !type) {
      this.requestError.set('Please fill guest name, company and select coupon type.');
      return;
    }

    this.requestSubmitting.set(true);

    try {
      const result = this.dataService.generateGuestPassFromEmployeeCoupon(
        employee.id,
        employee.name,
        name,
        company,
        type
      );

      if (result.success) {
        this.requestSuccess.set(
          result.message || 'Guest pass request submitted successfully.'
        );
      } else {
        this.requestError.set(
          result.message || 'Failed to submit guest pass request.'
        );
      }
    } catch (e) {
      console.error(e);
      this.requestError.set('Unexpected error while submitting guest pass request.');
    } finally {
      this.requestSubmitting.set(false);
    }
  }

  confirmApproveGuestRequest() {

    const employee =
      this.currentEmployee();
  
    const request =
      this.selectedGuestRequest();
  
    if (!employee || !request) {
      return;
    }
  
    const result =
  this.dataService.approveGuestCouponByEmployee(
    request.id,
    employee.id
  );

if (!result.success) {

  alert(result.message);

  return;

}

this.closeApproveGuestPopup();
  
    this.closeApproveGuestPopup();
  
  }
  
  rejectGuestRequest(requestId: string) {
  
    const employee = this.currentEmployee();
  
    if (!employee) return;
  
    const result =
    this.dataService.rejectGuestCouponByEmployee(
        requestId,
        employee.id,
        'Rejected by employee'
      );
  
    alert(result.message);
  
  }
  openApproveGuestPopup(
    request: GuestCouponRequest
  ) {
  
    this.selectedGuestRequest.set(request);
  
    this.isApproveGuestPopupOpen.set(true);
  
  }
  
  closeApproveGuestPopup() {
  
    this.isApproveGuestPopupOpen.set(false);
  
    this.selectedGuestRequest.set(null);
  
  }
  copyCodeToClipboard(code: string) {
    navigator.clipboard.writeText(code).then(() => {
      this.copySuccess.set(true);
      setTimeout(() => this.copySuccess.set(false), 2000);
    });
  }

  // =========================
  // History modals
  // =========================
  openHistoryModal() {
    this.isHistoryModalOpen.set(true);
  }
  
  closeHistoryModal() {
    this.isHistoryModalOpen.set(false);
  }

  openGuestHistoryModal() {
    this.isGuestHistoryModalOpen.set(true);
  }

  closeGuestHistoryModal() {
    this.isGuestHistoryModalOpen.set(false);
  }

  async openGuestQrFromRequest(request: GuestCouponRequest) {

    if (!request.generatedCouponId) {
      alert('QR Code not found.');
      return;
    }
  
    const coupon = this.dataService
      .coupons()
      .find(c => c.couponId === request.generatedCouponId);
  
    if (!coupon) {
      alert('Guest coupon not found.');
      return;
    }
  
    await this.openGuestQrModal(coupon);
  }

  // =========================
  // Guest QR modal for generated guest coupons
  // =========================
  async openGuestQrModal(coupon: Coupon) {
    this.selectedGuestCouponForQr.set(coupon);
    this.isGuestQrModalOpen.set(true);
    this.guestPassQrCodeDataUrl.set(null);

    const msg = `Here is your guest coupon for Hyva Canteen (${coupon.couponType}). Your redemption code is: *${coupon.redemptionCode}*`;
    this.whatsAppShareMessage.set(encodeURIComponent(msg));
    this.copySuccess.set(false);

    try {
      const dataUrl = await QRCode.toDataURL(coupon.redemptionCode, {
        width: 256,
        margin: 2,
      });
      this.guestPassQrCodeDataUrl.set(dataUrl);
    } catch (err) {
      console.error('Failed to generate guest QR code', err);
      this.guestPassQrCodeDataUrl.set(null);
    }
  }

  closeGuestQrModal() {
    this.isGuestQrModalOpen.set(false);
    this.selectedGuestCouponForQr.set(null);
    this.guestPassQrCodeDataUrl.set(null);
  }

  // =========================
  // UI helpers
  // =========================
  getCouponTypeClass(couponType: Coupon['couponType']): string {
    switch (couponType) {
      case 'Breakfast':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'Lunch/Dinner':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'Snacks':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'Beverage':
        return 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  }
  
  formatDateTime(isoString: string | null): string {
    if (!isoString) return 'N/A';
    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  }
  downloadQrCard() {
    const employee = this.currentEmployee();
    const qrDataUrl = this.employeeQrCodeDataUrl();

    if (!employee || !qrDataUrl) return;

    const scale = 4; // High resolution scale factor
    const canvas = document.createElement('canvas');
    canvas.width = 350 * scale;
    canvas.height = 350 * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(scale, scale); // Scale the context

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 350, 350); // Original dimensions

    // Header
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('HYVA CANTEEN', 175, 30);

    // QR Code Image
    const img = new Image();
    img.src = qrDataUrl;
    img.onload = () => {
      ctx.drawImage(img, 65, 50, 220, 220);

      // Name & ID
      ctx.font = 'bold 16px Arial';
      ctx.fillStyle = '#000000';
      ctx.fillText(employee.name || '', 175, 290);
      ctx.font = '14px Arial';
      ctx.fillText(`Employee ID: ${employee.id}`, 175, 310);

      // Download
      const link = document.createElement('a');
      link.download = `${employee.id}_QR.png`;
      link.href = canvas.toDataURL('image/png', 1.0); // Highest quality
      link.click();
    };
  }
  async generatePermanentEmployeeQr() {

    const employee = this.currentEmployee();
  
    if (!employee) return;
  
    try {
  
      const qrData = `EMP:${employee.id}`;
  
      const dataUrl = await QRCode.toDataURL(
        qrData,
        {
          width: 220,
          margin: 2,
        }
      );
  
      this.employeeQrCodeDataUrl.set(dataUrl);
  
    } catch (err) {
  
      console.error(err);
  
    }  
  }
  }
  
