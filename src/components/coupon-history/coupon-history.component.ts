import { Component, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { DataService } from '../../services/data.service';
import { Coupon } from '../../models/coupon.model';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-coupon-history',
  templateUrl: './coupon-history.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink],
})
export class CouponHistoryComponent {
  private authService = inject(AuthService);
  private dataService = inject(DataService);
  
  currentEmployee = this.authService.currentUser;

  couponBatches = computed(() => {
    const employee = this.currentEmployee();
    if (!employee) return [];
    
    // Grouping logic based on batchId or dateIssued
    const allCoupons = this.dataService.getCouponsForEmployee(employee.id);
    const batches = new Map<string, Coupon[]>();
    
    for (const coupon of allCoupons) {
      // Assuming a batch identifier exists or grouping by dateIssued
      const batchId = coupon.batchId || coupon.dateIssued; 
      if (!batches.has(batchId)) {
        batches.set(batchId, []);
      }
      batches.get(batchId)!.push(coupon);
    }
    
    return Array.from(batches.entries()).map(([batchId, coupons]) => {
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
        isFullyRedeemed
      };
    }).sort((a, b) => b.assignedOn.getTime() - a.assignedOn.getTime());
  });
}
