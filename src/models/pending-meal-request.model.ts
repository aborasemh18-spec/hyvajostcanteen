export interface PendingMealRequest {
  requestId: string;
  employeeId: number;
  employeeName: string;
  mealType: 'morning' | 'lunch' | 'evening' | 'dinner';
  mealDate: string;
  status: 'pending' | 'completed';

  isCouponAdjusted?: boolean;
  adjustedCouponId?: string;
  adjustmentDate?: string;
}