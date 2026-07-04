import { Component, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { DataService } from '../../services/data.service';
import { Coupon } from '../../models/coupon.model';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-coupon-history',
  templateUrl: './coupon-history.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink],
})
export class CouponHistoryComponent {
  private authService = inject(AuthService);
  private dataService = inject(DataService);
  private route = inject(ActivatedRoute);
  
  private routeQueryParam = toSignal(this.route.queryParams);

  currentEmployee = this.authService.currentUser;

  pageTitle = computed(() => {
    const params = this.routeQueryParam();
    if (params && params['type'] === 'Breakfast') {
      return 'Breakfast Coupon History';
    } else if (params && params['type'] === 'Lunch/Dinner') {
      return 'Lunch / Dinner Coupon History';
    }
    return 'Total Coupon History';
  });

  couponBatches = computed(() => {
    const employee = this.currentEmployee();
    if (!employee) return [];
    
    let allCoupons = this.dataService.getCouponsForEmployee(employee.id);
    
    const params = this.routeQueryParam();
    if (params && params['type']) {
      allCoupons = allCoupons.filter(c => c.couponType === params['type']);
    }
    
    const batches = new Map<string, Coupon[]>();
    
    for (const coupon of allCoupons) {
      const batchId = coupon.batchId || coupon.dateIssued; 
      if (!batches.has(batchId)) {
        batches.set(batchId, []);
      }
      batches.get(batchId)!.push(coupon);
    }
    
    return Array.from(batches.entries()).map(([batchId, coupons], index) => {
      const redeemed = coupons.filter(c => c.status === 'redeemed');
      const isFullyRedeemed = redeemed.length === coupons.length;
      const lastRedeemedDate = redeemed.length > 0 
        ? new Date(Math.max(...redeemed.map(c => new Date(c.redeemDate!).getTime())))
        : null;

      return {
        batchId,
        mealType: coupons[0].couponType,
        assignedOn: new Date(coupons[0].dateIssued),
        lastRedeemedDate: isFullyRedeemed ? lastRedeemedDate : null,
        isFullyRedeemed,
        originalIndex: index + 1 // Not strictly true index across all, but we can compute order based on time
      };
    }).sort((a, b) => b.assignedOn.getTime() - a.assignedOn.getTime());
  });
}
