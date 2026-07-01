import { Coupon } from './coupon.model';

export interface GuestCouponRequest {
  id: string;
  employeeId: number;
  employeeName: string;
  guestName: string;
  guestCompany: string;
  couponType: Coupon['couponType'];
  status:
  | 'pending_employee'
  | 'pending_admin'
  | 'approved'
  | 'rejected'
  | 'redeemed';
  requestDate: string;      // ISO string
  decisionDate?: string;    // ISO string
  adminId?: number;         // employeeId of admin who decided
  rejectionReason?: string;
  generatedCouponId?: string;
  requestedBy?: 'employee' | 'canteen_manager';
  employeeDecisionDate?: string;

  employeeApprovedBy?: number;

  employeeRejectedReason?: string;
  servedDate?: string;
}
