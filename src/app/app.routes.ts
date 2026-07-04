import { Routes } from '@angular/router';
import { LoginComponent } from '../components/login/login.component';
import { AdminDashboardComponent } from '../components/admin-dashboard/admin-dashboard.component';
import { AnalyticsDashboardComponent } from '../components/analytics-dashboard/analytics-dashboard.component';
import { EmployeeManagementComponent } from '../components/employee-management/employee-management.component';
import { AddEmployeeComponent } from '../components/add-employee/add-employee.component';
import { ManageContractorsComponent } from '../components/manage-contractors/manage-contractors.component';
import { ManageCouponsComponent } from '../components/manage-coupons/manage-coupons.component';
import { HistoryComponent } from '../components/history/history.component';
import { EmployeeHistoryComponent } from '../components/employee-history/employee-history.component';
import { SettingsComponent } from '../components/settings/settings.component';
import { ChangePasswordComponent } from '../components/change-password/change-password.component';
import { CanteenManagerDashboardComponent } from '../components/canteen-manager-dashboard/canteen-manager-dashboard.component';
import { MenuManagementComponent } from '../components/menu-management/menu-management.component';
import { RedeemCouponComponent } from '../components/redeem-coupon/redeem-coupon.component';
import { EmployeeDashboardComponent } from '../components/user-dashboard/user-dashboard.component';
import { CouponHistoryComponent } from '../components/coupon-history/coupon-history.component';
import { ContractorDashboardComponent } from '../components/contractor-dashboard/contractor-dashboard.component';
import { authGuard, adminGuard, canteenManagerGuard, contractorGuard } from '../services/auth.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'admin', component: AdminDashboardComponent, canActivate: [adminGuard] },
  { path: 'admin/analytics', component: AnalyticsDashboardComponent, canActivate: [adminGuard] },
  { path: 'admin/employees', component: EmployeeManagementComponent, canActivate: [adminGuard] },
  { path: 'admin/add-employee', component: AddEmployeeComponent, canActivate: [adminGuard], data: { type: 'employee' } },
  { path: 'admin/add-contract-employee', component: AddEmployeeComponent, canActivate: [adminGuard], data: { type: 'contractual' } },
  { path: 'admin/add-admin-canteen', component: AddEmployeeComponent, canActivate: [adminGuard], data: { type: 'admin-canteen' } },
  { path: 'admin/contractors', component: ManageContractorsComponent, canActivate: [adminGuard] },
  { path: 'admin/manage-coupons', component: ManageCouponsComponent, canActivate: [adminGuard] },
  { path: 'admin/history', component: HistoryComponent, canActivate: [adminGuard] },
  { path: 'admin/history/employee/:id', component: EmployeeHistoryComponent, canActivate: [adminGuard] },
  { path: 'admin/settings', component: SettingsComponent, canActivate: [adminGuard] },
  { path: 'change-password', component: ChangePasswordComponent, canActivate: [authGuard] },
  { path: 'canteen-manager', component: CanteenManagerDashboardComponent, canActivate: [canteenManagerGuard] },
  { path: 'canteen-manager/menu', component: MenuManagementComponent, canActivate: [canteenManagerGuard] },
  { path: 'canteen-manager/redeem', component: RedeemCouponComponent, canActivate: [canteenManagerGuard] },
  { path: 'employee', component: EmployeeDashboardComponent, canActivate: [authGuard] },
  { path: 'employee/coupon-history', component: CouponHistoryComponent, canActivate: [authGuard] },
  { path: 'contractual-employee', component: EmployeeDashboardComponent, canActivate: [authGuard] },
  { path: 'contractor', component: ContractorDashboardComponent, canActivate: [contractorGuard] },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: '**', redirectTo: 'login' }
];