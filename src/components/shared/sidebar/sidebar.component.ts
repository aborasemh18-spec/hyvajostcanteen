import { Component, ChangeDetectionStrategy, computed, inject, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  host: {
    '[class.w-64]': '!isCollapsed()',
    '[class.w-20]': 'isCollapsed()',
    'class': 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 flex flex-col flex-shrink-0 transition-all duration-300 ease-in-out border-r border-gray-200 dark:border-gray-700 shadow-sm z-20 h-full'
  }
})
export class SidebarComponent {
  private authService = inject(AuthService);
  currentUser = this.authService.currentUser;
  // FIX: Added a type guard to ensure the user is an Employee before accessing employeeId.
  isSuperAdmin = computed(() => {
    const user = this.currentUser();
    return user && 'employeeId' in user && user.employeeId === 'admin01';
  });

  isAdmin = computed(() => {
    const user = this.currentUser();
    return user && 'role' in user && user.role === 'admin';
  });

  isCanteenManager = computed(() => {
    const user = this.currentUser();
    return user && 'role' in user && user.role === 'canteen manager';
  });

  isContractor = computed(() => {
    const user = this.currentUser();
    return user && 'contractorId' in user;
  });

  isEmployee = computed(() => {
    const user = this.currentUser();
    return user && 'role' in user && (user.role === 'employee' || user.role === 'contractual employee');
  });

  getEmployeeDashboardRoute = computed(() => {
    const user = this.currentUser();
    if (user && 'role' in user && user.role === 'contractual employee') {
      return '/contractual-employee';
    }
    return '/employee';
  });

  logout = output<void>();
  isCollapsed = signal(false);

  toggleCollapse() {
    this.isCollapsed.update(collapsed => !collapsed);
  }
}
