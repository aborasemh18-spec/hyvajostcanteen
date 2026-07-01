import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  ReactiveFormsModule,
  Validators,
  FormGroup,
  FormControl,
} from '@angular/forms';
import { DataService } from '../../services/data.service';
import { Coupon } from '../../models/coupon.model';
import { Employee } from '../../models/user.model';
import { AuthService } from '../../services/auth.service';
import { Contractor } from '../../models/contractor.model';
import { GuestCouponRequest } from '../../models/guest-coupon-request.model';
import * as XLSX from 'xlsx';

// Declare jsPDF global to use the library from the script tag
declare var jspdf: any;

type UiGuestRequest = GuestCouponRequest & {
  employeeName: string;
};

@Component({
  selector: 'app-manage-coupons',
  templateUrl: './manage-coupons.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  host: {
    '(document:click)': 'onDocumentClick($event)',
  },
})
export class ManageCouponsComponent {
  private dataService = inject(DataService);
  private authService = inject(AuthService);
  private elementRef = inject(ElementRef);

  activeTab = signal<
  'employees' |
  'contractors' |
  'contractorEmployees' |
  'guest'
>('employees');
  couponTypes: Coupon['couponType'][] = [
    'Breakfast',
    'Lunch/Dinner',
    'Snacks',
    'Beverage',
  ];

  isSuperAdmin = computed(() => {
    const user = this.authService.currentUser();
    return user && 'employeeId' in user && user.employeeId === 'admin01';
  });

  // --- Employee Tab State & Logic ---
  employees = computed(() =>
    this.dataService
      .employees()
      .filter((e) => e.role === 'employee' && e.status === 'active')
  );
  contractorEmployees = computed(() =>
    this.dataService
      .employees()
      .filter(
        (e) =>
          e.role === 'contractual employee' &&
          e.status === 'active'
      )
  );
  isGenerateCouponsModalOpen = signal(false);
  selectedEmployee = signal<Employee | null>(null);
  generateCouponError = signal<string | null>(null);
  isManageEmployeeCouponsModalOpen = signal(false);
  selectedEmployeeForCouponMgmt = signal<Employee | null>(null);
  isManageContractorCouponsModalOpen =
  signal(false);

selectedContractorForCouponMgmt =
  signal<Contractor | null>(null);
  isRemoveLastBatchModalOpen = signal(false);

  searchTerm = signal('');
  sortConfig = signal<{ key: keyof Employee; direction: 'asc' | 'desc' }>({
    key: 'name',
    direction: 'asc',
  });

  generateCouponsForm = new FormGroup({
    couponType: new FormControl<Coupon['couponType'] | null>(null, [
      Validators.required,
    ]),
  });

  // --- Contractor Tab State & Logic ---
  contractors = this.dataService.contractors;
  isGenerateContractorCouponsModalOpen = signal(false);
  selectedContractor = signal<Contractor | null>(null);
  generateContractorCouponError = signal<string | null>(null);

  generateContractorCouponsForm = new FormGroup({
    couponType: new FormControl<Coupon['couponType'] | null>(null, [
      Validators.required,
    ]),
    quantity: new FormControl(26),
  });

  // --- Guest Requests Tab State ---
  guestSearchTerm = signal('');
  guestRequestDate = signal('');

  // --- Shared State ---
  isExportMenuOpen = signal(false);
  exportFromDate = signal('');
  exportToDate = signal('');
  statusMessage = signal<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  employeesMap = computed(() => {
    const map = new Map<number, Employee>();
    this.dataService.employees().forEach((emp) => map.set(emp.id, emp));
    return map;
  });

  // --- Computed Values for Employees Tab ---
  filteredAndSortedEmployees = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const { key, direction } = this.sortConfig();

    let filtered = this.employees().filter((employee) =>
      [
        employee.name,
        employee.email,
        employee.employeeId,
        employee.department,
      ]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(term))
    );

    return filtered.sort((a, b) => {
      const valA = (a[key] || '') as any;
      const valB = (b[key] || '') as any;
      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  });
  filteredContractorEmployees = computed(() => {

    const term = this.searchTerm().toLowerCase();
  
    return this.contractorEmployees().filter(employee =>
  
      employee.role === 'contractual employee' &&
      employee.status === 'active' &&
  
      (
        employee.name.toLowerCase().includes(term) ||
        employee.employeeId.toLowerCase().includes(term) ||
        (employee.contractor || '').toLowerCase().includes(term)
      )
  
    );
  
  }); 

  employeeCouponStats = computed(() => {
    type CouponTypeStats = { issued: number; redeemed: number };
  
    type EmployeeCouponStats = {
      totalIssued: number;
      totalRedeemed: number;
      breakdown: Partial<Record<Coupon['couponType'], CouponTypeStats>>;
    };
  
    const statsMap = new Map<number, EmployeeCouponStats>();
    const allCoupons = this.dataService.coupons();
  
    for (const employee of this.dataService.employees()) {
  
      statsMap.set(employee.id, {
        totalIssued: 0,
        totalRedeemed: 0,
        breakdown: {},
      });
  
      const employeeCoupons = allCoupons.filter(
        c => c.employeeId === employee.id
      );
  
      if (employeeCoupons.length === 0) {
        continue;
      }
  
      
      const stats = statsMap.get(employee.id)!;
  
      stats.totalIssued = employeeCoupons.length;

      stats.totalRedeemed = employeeCoupons.filter(
      c => c.status === 'redeemed'
      ).length;

for (const coupon of employeeCoupons) {
  
        if (!stats.breakdown[coupon.couponType]) {
          stats.breakdown[coupon.couponType] = {
            issued: 0,
            redeemed: 0,
          };
        }
  
        const typeStats = stats.breakdown[coupon.couponType]!;
  
        typeStats.issued++;
  
        if (coupon.status === 'redeemed') {
          typeStats.redeemed++;
        }
      }
    }
  
    return statsMap;
  });

  employeeDateStats = computed(() => {
    const statsMap = new Map<
      number,
      { lastIssued: string | null; lastRedeemed: string | null }
    >();
    const allCoupons = this.dataService.coupons();
    for (const employee of this.dataService.employees()) {
      statsMap.set(employee.id, { lastIssued: null, lastRedeemed: null });
    }
    for (const coupon of allCoupons) {
      if (coupon.employeeId && statsMap.has(coupon.employeeId)) {
        const currentStats = statsMap.get(coupon.employeeId)!;
        if (
          !currentStats.lastIssued ||
          new Date(coupon.dateIssued) > new Date(currentStats.lastIssued)
        ) {
          currentStats.lastIssued = coupon.dateIssued;
        }
        if (coupon.status === 'redeemed' && coupon.redeemDate) {
          if (
            !currentStats.lastRedeemed ||
            new Date(coupon.redeemDate) > new Date(currentStats.lastRedeemed)
          ) {
            currentStats.lastRedeemed = coupon.redeemDate;
          }
        }
      }
    }
    return statsMap;
  });
  
    employeeUnredeemedCoupons = computed(() => {
    const employee = this.selectedEmployeeForCouponMgmt();
    if (!employee) return [];
    const allCoupons = this.dataService.coupons();
    return allCoupons
      .filter((c) => c.employeeId === employee.id && c.status === 'issued')
      .sort(
        (a, b) =>
          new Date(a.dateIssued).getTime() - new Date(b.dateIssued).getTime()
      );
  });
  contractorUnredeemedCoupons =
  computed(() => {

    const contractor =
      this.selectedContractorForCouponMgmt();

    if (!contractor) {
      return [];
    }

    return this.dataService
      .coupons()
      .filter(
        c =>
          c.contractorId === contractor.id &&
          c.status === 'issued'
      );

  });
  lastBatchInfo = computed(() => {

    const contractor =
      this.selectedContractorForCouponMgmt();
  
    const coupons = contractor
      ? this.contractorUnredeemedCoupons()
      : this.employeeUnredeemedCoupons();
  
    if (coupons.length === 0) {
      return null;
    }
  
    let mostRecentDate = '';
  
    coupons.forEach((coupon) => {
  
      if (coupon.dateIssued > mostRecentDate) {
        mostRecentDate = coupon.dateIssued;
      }
  
    });
  
    const lastBatchCoupons =
      coupons.filter(
        c => c.dateIssued === mostRecentDate
      );
  
    if (lastBatchCoupons.length === 0) {
      return null;
    }
  
    return {
      count: lastBatchCoupons.length,
      dateIssued: mostRecentDate,
      couponType: lastBatchCoupons[0].couponType,
    };
  
  });

  // --- Computed Values for Contractors Tab ---
  contractorCouponStats = computed(() => {

    const statsMap = new Map<
      number,
      {
        available: number;
        redeemed: number;
        balance: number;
      }
    >();
  
    const allCoupons = this.dataService.coupons();
  
    for (const contractor of this.contractors()) {
  
      statsMap.set(contractor.id, {
        available: 0,
        redeemed: 0,
        balance: 0
      });
  
    }
  
    for (const coupon of allCoupons) {
  
      if (
        coupon.contractorId &&
        statsMap.has(coupon.contractorId)
    ) {
  
        const stats =
          statsMap.get(coupon.contractorId)!;
  
        if (coupon.status === 'issued') {
          stats.available++;
        }
  
        if (coupon.status === 'redeemed') {
          stats.redeemed++;
        }
  
        
  
      }
  
    }
    for (const stats of statsMap.values()) {

      stats.balance =
        stats.available - stats.redeemed;
    
    }
    return statsMap;
  
  });

  // --- Guest Pass Requests (NEW) ---

  /** Raw guest requests from DataService (assumes DataService exposes guestCouponRequests signal) */
  private guestRequestsRaw = computed(() => this.dataService.guestCouponRequests?.() ?? []);

  /** Decorated + filtered pending requests for UI */
  pendingGuestRequests = computed<UiGuestRequest[]>(() => {
    const term = this.guestSearchTerm().toLowerCase();
    const empMap = this.employeesMap();
    const selectedDate = this.guestRequestDate();
    const all = this.guestRequestsRaw()
    .filter(
      (r) =>
        (
          r.requestedBy === 'employee' &&
          r.status === 'pending_admin'
        ) ||
        (
          r.requestedBy === 'canteen_manager' &&
          r.status === 'pending_admin'
        )
    )
      .sort(
        (a, b) =>
          new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime()
      );

    return all
      .map((r) => {
        const emp = empMap.get(r.employeeId);
        return {
          ...r,
          employeeName: emp?.name || 'Unknown',
        };
      })
      .filter((r) => {

        const matchesSearch =
            !term ||
            r.employeeName.toLowerCase().includes(term) ||
            String(r.employeeId).includes(term) ||
            r.guestName.toLowerCase().includes(term) ||
            r.guestCompany.toLowerCase().includes(term) ||
            r.couponType.toLowerCase().includes(term);
    
        const matchesDate =
            !selectedDate ||
            String(r.requestDate).startsWith(selectedDate);
    
        return matchesSearch && matchesDate;
    
    });
  });

  /** Decorated + filtered processed requests for UI */
  processedGuestRequests = computed<UiGuestRequest[]>(() => {
    const term = this.guestSearchTerm().toLowerCase();
    const empMap = this.employeesMap();
    const selectedDate = this.guestRequestDate();
    const all = this.guestRequestsRaw()
    .filter(
      (r) =>
        r.status !== 'pending_employee' &&
        r.status !== 'pending_admin'
    )
      .sort(
        (a, b) =>
          new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime()
      );

    return all
      .map((r) => {
        const emp = empMap.get(r.employeeId);
        return {
          ...r,
          employeeName: emp?.name || 'Unknown',
        };
      })
      .filter((r) => {

        const matchesSearch =
            !term ||
            r.employeeName.toLowerCase().includes(term) ||
            String(r.employeeId).includes(term) ||
            r.guestName.toLowerCase().includes(term) ||
            r.guestCompany.toLowerCase().includes(term) ||
            r.couponType.toLowerCase().includes(term) ||
            r.status.toLowerCase().includes(term);
    
        const matchesDate =
            !selectedDate ||
            String(r.requestDate).startsWith(selectedDate);
    
        return matchesSearch && matchesDate;
    
    });
  });

  // --- Event Handlers & Methods ---
  onDocumentClick(event: MouseEvent) {
    const exportMenu =
      this.elementRef.nativeElement.querySelector('.export-menu-container');
    if (
      this.isExportMenuOpen() &&
      exportMenu &&
      !exportMenu.contains(event.target as Node)
    ) {
      this.isExportMenuOpen.set(false);
    }
  }

  openGenerateCouponsModal(employee: Employee) {
    this.selectedEmployee.set(employee);
    this.isGenerateCouponsModalOpen.set(true);
    this.generateCouponsForm.reset({ couponType: null });
    this.generateCouponError.set(null);
  }

  openManageEmployeeCouponsModal(employee: Employee) {
    this.selectedEmployeeForCouponMgmt.set(employee);
    this.isManageEmployeeCouponsModalOpen.set(true);
  }
  openManageContractorCouponsModal(
    contractor: Contractor
  ) {
  
    this.selectedContractorForCouponMgmt.set(
      contractor
    );
  
    this.isManageContractorCouponsModalOpen.set(
      true
    );
  
  }

  openGenerateContractorCouponsModal(contractor: Contractor) {
    this.selectedContractor.set(contractor);
    this.isGenerateContractorCouponsModalOpen.set(true);
    this.generateContractorCouponsForm.reset({
      quantity: 26,
    });
    this.generateContractorCouponError.set(null);
  }

  openRemoveLastBatchModal() {
    this.isRemoveLastBatchModalOpen.set(true);
  }

  closeModals() {
    this.isGenerateCouponsModalOpen.set(false);
    this.selectedEmployee.set(null);
    this.generateCouponError.set(null);

    this.isGenerateContractorCouponsModalOpen.set(false);
    this.selectedContractor.set(null);
    this.generateContractorCouponError.set(null);

    this.isManageEmployeeCouponsModalOpen.set(false);
    this.selectedEmployeeForCouponMgmt.set(null);

    this.isManageContractorCouponsModalOpen.set(false);
    this.selectedContractorForCouponMgmt.set(null);

    this.isRemoveLastBatchModalOpen.set(false);
  }

  handleGenerateCoupons() {
    this.generateCouponError.set(null);
    if (this.generateCouponsForm.valid && this.selectedEmployee()) {
      const { couponType } = this.generateCouponsForm.value;
      const result = this.dataService.generateCouponsForEmployee(
        this.selectedEmployee()!.id,
        couponType!
      );
      if (result.success) {
        this.statusMessage.set({ type: 'success', text: result.message });
        this.closeModals();
        setTimeout(() => this.statusMessage.set(null), 5000);
      } else {
        this.generateCouponError.set(result.message);
      }
    }
  }

  handleGenerateContractorCoupons() {
    this.generateContractorCouponError.set(null);
    if (this.generateContractorCouponsForm.valid && this.selectedContractor()) {
      const { couponType } =
  this.generateContractorCouponsForm.value;
  const quantity = 26;
      const result = this.dataService.generateCouponsForContractor(
        this.selectedContractor()!.id,
        couponType!,
        quantity!
      );
      if (result.success) {
        this.statusMessage.set({ type: 'success', text: result.message });
        this.closeModals();
        setTimeout(() => this.statusMessage.set(null), 5000);
      } else {
        this.generateContractorCouponError.set(result.message);
      }
    }
  }

  handleRemoveCoupon(couponId: string) {
    if (
      confirm(
        'Are you sure you want to permanently remove this coupon? This action cannot be undone.'
      )
    ) {
      const result = this.dataService.removeCoupon(couponId);
      if (result.success) {
        this.statusMessage.set({ type: 'success', text: result.message });
      } else {
        this.statusMessage.set({ type: 'error', text: result.message });
      }
      setTimeout(() => this.statusMessage.set(null), 5000);
    }
  }

  handleRemoveLastBatch() {

    const contractor =
      this.selectedContractorForCouponMgmt();
  
    if (contractor) {
  
      const result =
        this.dataService.removeLastContractorCouponBatch(
          contractor.id
        );
  
      this.isRemoveLastBatchModalOpen.set(false);
  
      if (result.success) {
  
        this.statusMessage.set({
          type: 'success',
          text: result.message
        });
  
      } else {
  
        this.statusMessage.set({
          type: 'error',
          text: result.message
        });
  
      }
  
      setTimeout(
        () => this.statusMessage.set(null),
        7000
      );
  
      return;
    }
  
    const employee =
      this.selectedEmployeeForCouponMgmt();
  
    if (!employee) return;
  
    const result =
      this.dataService.removeLastCouponBatch(
        employee.id
      );
  
    this.isRemoveLastBatchModalOpen.set(false);
  
    if (result.success) {
  
      this.statusMessage.set({
        type: 'success',
        text: result.message
      });
  
      if (
        this.employeeUnredeemedCoupons().length === 0
      ) {
  
        this.isManageEmployeeCouponsModalOpen.set(
          false
        );
  
        this.selectedEmployeeForCouponMgmt.set(
          null
        );
  
      }
  
    } else {
  
      this.statusMessage.set({
        type: 'error',
        text: result.message
      });
  
    }
  
    setTimeout(
      () => this.statusMessage.set(null),
      7000
    );
  
  }

  updateSearch(event: Event) {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  updateGuestSearch(event: Event) {
    this.guestSearchTerm.set((event.target as HTMLInputElement).value);
  }

  setSort(key: keyof Employee) {
    if (this.sortConfig().key === key) {
      this.sortConfig.update((config) => ({
        ...config,
        direction: config.direction === 'asc' ? 'desc' : 'asc',
      }));
    } else {
      this.sortConfig.set({ key, direction: 'asc' });
    }
  }

  toggleExportMenu() {
    this.isExportMenuOpen.update((v) => !v);
  }

  private downloadFile(data: string, filename: string, type: string) {
    const blob = new Blob([data], { type });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
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

  // --- Guest Request Actions ---

  handleApproveGuestRequest(request: UiGuestRequest) {
    const admin = this.authService.currentUser() as Employee | null;
    if (!admin) {
      this.statusMessage.set({
        type: 'error',
        text: 'Could not verify admin user.',
      });
      setTimeout(() => this.statusMessage.set(null), 5000);
      return;
    }

    const result = this.dataService.approveGuestCouponRequest?.(
      request.id,
      admin.id
    );

    if (!result) {
      this.statusMessage.set({
        type: 'error',
        text: 'Guest request approve API not implemented in DataService.',
      });
    } else if (result.success) {
      this.statusMessage.set({ type: 'success', text: result.message });
    } else {
      this.statusMessage.set({ type: 'error', text: result.message });
    }

    setTimeout(() => this.statusMessage.set(null), 6000);
  }

  handleRejectGuestRequest(request: UiGuestRequest) {
    const admin = this.authService.currentUser() as Employee | null;
    if (!admin) {
      this.statusMessage.set({
        type: 'error',
        text: 'Could not verify admin user.',
      });
      setTimeout(() => this.statusMessage.set(null), 5000);
      return;
    }

    const reasonRaw = window.prompt(
      'Enter rejection reason (optional):',
      'Not eligible' // default text
    );
    const reason = reasonRaw?.trim() || undefined;

    const result = this.dataService.rejectGuestCouponRequest?.(
      request.id,
      admin.id,
      reason
    );

    if (!result) {
      this.statusMessage.set({
        type: 'error',
        text: 'Guest request reject API not implemented in DataService.',
      });
    } else if (result.success) {
      this.statusMessage.set({ type: 'success', text: result.message });
    } else {
      this.statusMessage.set({ type: 'error', text: result.message });
    }

    setTimeout(() => this.statusMessage.set(null), 6000);
  }

  // --- Export helpers ---

  exportCouponsCsv() {
    const breakdownHeaders = this.couponTypes.map((t) => `${t} (I/R)`);
    const headers = [
      'Name',
      'Employee ID',
      'Department',
      'Role',
      ...breakdownHeaders,
      'Total (I/R)',
      'Last Issued On',
      'Last Redeemed On',
    ];
    const employeesToExport = this.filteredAndSortedEmployees();
    const statsMap = this.employeeCouponStats();
    const dateStatsMap = this.employeeDateStats();
    let csvContent = headers.join(',') + '\n';
    employeesToExport.forEach((emp) => {
      const stats = statsMap.get(emp.id);
      const dateStats =
        dateStatsMap.get(emp.id) || { lastIssued: null, lastRedeemed: null };
      const breakdownValues = this.couponTypes.map((type) => {
        const typeStat = stats?.breakdown[type];
        return typeStat
          ? `"${typeStat.issued}/${typeStat.redeemed}"`
          : '"0/0"';
      });
      const totalValue = stats
        ? `"${stats.totalIssued}/${stats.totalRedeemed}"`
        : '"0/0"';
      const row = [
        `"${emp.name}"`,
        emp.employeeId,
        emp.department || 'N/A',
        emp.role,
        ...breakdownValues,
        totalValue,
        this.formatDateTime(dateStats.lastIssued),
        this.formatDateTime(dateStats.lastRedeemed),
      ].join(',');
      csvContent += row + '\n';
    });
    this.downloadFile(
      csvContent,
      'hyva_pune_canteen_coupon_report.csv',
      'text/csv;charset=utf-8;'
    );
  }
  exportBillingReportCsv() {

    const fromDate = this.exportFromDate();
    const toDate = this.exportToDate();
  
    if (!fromDate || !toDate) {
  
      this.statusMessage.set({
        type: 'error',
        text: 'Please select From Date and To Date.'
      });
  
      return;
    }
  
    const headers = [
      'Employee Name',
      'Employee ID',
      'Coupon Type',
      'Issue Date',
      'Quantity'
    ];
  
    let csvContent =

  'HYVA INDIA - CANTEEN BILLING REPORT\n' +

  `Report Period: ${fromDate} To ${toDate}\n` +

  `Generated On: ${new Date().toLocaleString()}\n\n` +

  headers.join(',') +

  '\n';
  
    const employees =
      this.dataService.employees();
  
    const employeeMap =
      new Map(
        employees.map(e => [e.id, e])
      );
  
    const coupons =
      this.dataService.coupons();
  
    const filteredCoupons =
      coupons.filter(c => {
  
        const issueDate =
          c.dateIssued?.split('T')[0];
  
        return (
          issueDate >= fromDate &&
          issueDate <= toDate
        );
  
      });
  
      const grouped = new Map<string, any>();

      filteredCoupons.forEach(coupon => {
      
        const employee =
          employeeMap.get(coupon.employeeId);
      
        const issueDate =
          coupon.dateIssued.split('T')[0];
      
        const key =
          `${employee?.employeeId}-${coupon.couponType}-${issueDate}`;
      
        if (!grouped.has(key)) {
      
          grouped.set(key, {
            employeeName: employee?.name || '',
            employeeId: employee?.employeeId || '',
            couponType: coupon.couponType,
            issueDate,
            quantity: 0
          });
      
        }
      
        grouped.get(key).quantity++;
      
      });
      
      grouped.forEach(rowData => {
      
        const row = [
      
          `"${rowData.employeeName}"`,
      
          rowData.employeeId,
      
          rowData.couponType,
      
          rowData.issueDate,
      
          rowData.quantity
      
        ].join(',');
      
        csvContent += row + '\n';
      
      });  
  
    this.downloadFile(
      csvContent,
      `billing_report_${fromDate}_to_${toDate}.csv`,
      'text/csv;charset=utf-8;'
    );
  
  }
  exportBillingReportExcel() {

    const fromDate = this.exportFromDate();
    const toDate = this.exportToDate();
  
    if (!fromDate || !toDate) {
  
      this.statusMessage.set({
        type: 'error',
        text: 'Please select From Date and To Date.'
      });
  
      return;
    }
  
    const employees =
      this.dataService.employees();
  
    const employeeMap =
      new Map(
        employees.map(e => [e.id, e])
      );
  
    const coupons =
      this.dataService.coupons();
  
    const filteredCoupons =
      coupons.filter(c => {
  
        const issueDate =
          c.dateIssued.split('T')[0];
  
        return (
          issueDate >= fromDate &&
          issueDate <= toDate
        );
  
      });
  
    const grouped =
      new Map<string, any>();
  
    filteredCoupons.forEach(coupon => {
  
      const employee =
        employeeMap.get(coupon.employeeId);
  
      const issueDate =
        coupon.dateIssued.split('T')[0];
  
      const key =
        `${employee?.employeeId}-${coupon.couponType}-${issueDate}`;
  
      if (!grouped.has(key)) {
  
        grouped.set(key, {
          employeeName: employee?.name || '',
          employeeId: employee?.employeeId || '',
          couponType: coupon.couponType,
          issueDate,
          quantity: 0
        });
  
      }
  
      grouped.get(key).quantity++;
  
    });
  
    const rows: any[] = [];
  
    grouped.forEach(row => {
  
      rows.push([
        row.employeeName,
        row.employeeId,
        row.couponType,
        row.issueDate,
        row.quantity
      ]);
  
    });
  
    const ws =
      XLSX.utils.aoa_to_sheet([
        ['HYVA INDIA - CANTEEN BILLING REPORT'],
        [`Report Period: ${fromDate} To ${toDate}`],
        [`Generated On: ${new Date().toLocaleString()}`],
        [],
        [
          'Employee Name',
          'Employee ID',
          'Coupon Type',
          'Issue Date',
          'Quantity'
        ]
      ]);
  
    XLSX.utils.sheet_add_aoa(
      ws,
      rows,
      { origin: 'A6' }
    );
  
    ws['!merges'] = [
      {
        s: { r: 0, c: 0 },
        e: { r: 0, c: 4 }
      },
      {
        s: { r: 1, c: 0 },
        e: { r: 1, c: 4 }
      },
      {
        s: { r: 2, c: 0 },
        e: { r: 2, c: 4 }
      }
    ];
  
    ws['!cols'] = [
      { wch: 30 },
      { wch: 15 },
      { wch: 20 },
      { wch: 15 },
      { wch: 10 }
    ];
  
    const wb =
      XLSX.utils.book_new();
  
    XLSX.utils.book_append_sheet(
      wb,
      ws,
      'Billing Report'
    );
  
    XLSX.writeFile(
      wb,
      `billing_report_${fromDate}_to_${toDate}.xlsx`
    );
  
  }
  exportTotalDailyReport() {

    const fromDate = this.exportFromDate();
    const toDate = this.exportToDate();
  
    if (!fromDate || !toDate) {
  
      this.statusMessage.set({
        type: 'error',
        text: 'Please select From Date and To Date.'
      });
  
      return;
    }
    const coupons = this.dataService.coupons();
    const pendingRequests =
      this.dataService.pendingMealRequests();
      const guestRequests =
     this.dataService.guestCouponRequests();
     const redeemedCoupons = coupons.filter(c => {

      if (c.status !== 'redeemed') {
        return false;
      }
    
      if (!c.redeemDate) {
        return false;
      }
    
      const redeemDate = c.redeemDate.split('T')[0];
    
      return (
        redeemDate >= fromDate &&
        redeemDate <= toDate
      );
    
    });
    let breakfastCount = 0;
    let lunchCount = 0;
    let eveningSnacksCount = 0;
    let dinnerCount = 0;
    let pendingMealsCount = 0;
    let adjustedMealsCount = 0;

redeemedCoupons.forEach(coupon => {

  if (!coupon.redeemDate) {
    return;
  }

  const date = new Date(coupon.redeemDate);

  const currentMinutes =
    date.getHours() * 60 + date.getMinutes();

  // Breakfast 8:00 AM - 10:30 AM
  if (currentMinutes >= 480 && currentMinutes <= 630) {
    breakfastCount++;
  }

  // Lunch 11:00 AM - 2:00 PM
  else if (currentMinutes >= 660 && currentMinutes <= 840) {
    lunchCount++;
  }

  // Evening Snacks 4:30 PM - 6:30 PM
  else if (currentMinutes >= 990 && currentMinutes <= 1110) {
    eveningSnacksCount++;
  }

  // Dinner 7:30 PM - 9:30 PM
  else if (currentMinutes >= 1170 && currentMinutes <= 1290) {
    dinnerCount++;
  }

});
guestRequests
  .filter(
    r =>
      r.requestedBy === 'canteen_manager' &&
      r.status === 'redeemed' &&
      r.servedDate &&
      r.servedDate.split('T')[0] >= fromDate &&
      r.servedDate.split('T')[0] <= toDate
  )
  .forEach(request => {

    const date = new Date(request.servedDate!);

    const currentMinutes =
      date.getHours() * 60 +
      date.getMinutes();

    if (currentMinutes >= 450 && currentMinutes <= 630) {
      breakfastCount++;
    }
    else if (currentMinutes >= 690 && currentMinutes <= 870) {
      lunchCount++;
    }
    else if (currentMinutes >= 990 && currentMinutes <= 1110) {
      eveningSnacksCount++;
    }
    else if (currentMinutes >= 1170 && currentMinutes <= 1290) {
      dinnerCount++;
    }

  });
pendingMealsCount =
  pendingRequests.filter(
    r =>
      r.mealDate >= fromDate &&
      r.mealDate <= toDate &&
      r.status === 'pending'
  ).length;

adjustedMealsCount =
  pendingRequests.filter(
    r =>
      r.mealDate >= fromDate &&
      r.mealDate <= toDate &&
      r.isCouponAdjusted === true
  ).length;

  const grandTotal =
  breakfastCount +
  lunchCount +
  eveningSnacksCount +
  dinnerCount +
  pendingMealsCount;

  const rows = [
    ['Breakfast', breakfastCount],
    ['Lunch', lunchCount],
    ['Evening Snacks', eveningSnacksCount],
    ['Dinner', dinnerCount],
    ['Pending Meals', pendingMealsCount],
    ['Adjusted Meals', adjustedMealsCount],
    ['Grand Total', grandTotal]
  ];
  
  const ws = XLSX.utils.aoa_to_sheet([
    ['HYVA INDIA - TOTAL DAILY REPORT'],
    [`Report Date: ${fromDate}`],
    [`Generated On: ${new Date().toLocaleString()}`],
    [],
    ['Category', 'Count']
  ]);
  
  XLSX.utils.sheet_add_aoa(ws, rows, {
    origin: 'A6'
  });
  
  ws['!cols'] = [
    { wch: 25 },
    { wch: 20 }
  ];
  
  const wb = XLSX.utils.book_new();
  
  XLSX.utils.book_append_sheet(
    wb,
    ws,
    'Total Daily Report'
  );
  
  XLSX.writeFile(
    wb,
    `Total_Daily_Report_${fromDate}.xlsx`
  );
  }
  exportPermanentEmployeeDailyReport() {

    const fromDate = this.exportFromDate();
    const toDate = this.exportToDate();
  
    if (!fromDate || !toDate) {
  
      this.statusMessage.set({
        type: 'error',
        text: 'Please select From Date and To Date.'
      });
  
      return;
    }
  
    const coupons = this.dataService.coupons();
    const employees = this.dataService.employees();
    const pendingRequests =
       this.dataService.pendingMealRequests();
    const redeemedCoupons = coupons.filter(c => {
  
      if (c.status !== 'redeemed') {
        return false;
      }
  
      if (!c.redeemDate) {
        return false;
      }
  
      if (c.isGuestCoupon) {
        return false;
      }
  
      if (c.contractorId) {
        return false;
      }
  
      const redeemDate = c.redeemDate.split('T')[0];
  
      return (
        redeemDate >= fromDate &&
        redeemDate <= toDate
      );
  
    });
  
    const rows: any[] = [];
  
    let totalBreakfast = 0;
    let totalLunch = 0;
    let totalEvening = 0;
    let totalDinner = 0;
    let grandTotal = 0;
    let totalPendingMeals = 0;
    let totalAdjustedMeals = 0;
  
    employees.forEach(employee => {
      const employeeCoupons =
      redeemedCoupons.filter(
        c => c.employeeId === employee.id
      );
    
    let breakfast = 0;
    let lunch = 0;
    let evening = 0;
    let dinner = 0;
    let pendingMeals = 0;
    let adjustedMeals = 0;
    
    pendingMeals =
      pendingRequests.filter(
        r =>
          r.employeeId === employee.id &&
          r.mealDate >= fromDate &&
          r.mealDate <= toDate &&
          r.status === 'pending'
      ).length;
    
    adjustedMeals =
      pendingRequests.filter(
        r =>
          r.employeeId === employee.id &&
          r.mealDate >= fromDate &&
          r.mealDate <= toDate &&
          r.isCouponAdjusted === true
      ).length;
    
    if (
      employeeCoupons.length === 0 &&
      pendingMeals === 0 &&
      adjustedMeals === 0
    ) {
      return;
    }
      
  
      employeeCoupons.forEach(coupon => {
  
        if (!coupon.redeemDate) {
          return;
        }
  
        const date =
          new Date(coupon.redeemDate);
  
        const currentMinutes =
          date.getHours() * 60 +
          date.getMinutes();
  
        if (currentMinutes >= 480 && currentMinutes <= 630) {
          breakfast++;
        }
        else if (currentMinutes >= 660 && currentMinutes <= 840) {
          lunch++;
        }
        else if (currentMinutes >= 990 && currentMinutes <= 1110) {
          evening++;
        }
        else if (currentMinutes >= 1170 && currentMinutes <= 1290) {
          dinner++;
        }
  
      });
        
  const total =
  breakfast +
  lunch +
  evening +
  dinner +
  pendingMeals;
  
  rows.push([
    fromDate,
    employee.employeeId,
    employee.name,
    breakfast,
    lunch,
    evening,
    dinner,
    pendingMeals,
    adjustedMeals,
    total
  ]);
  
  totalBreakfast += breakfast;
  totalLunch += lunch;
  totalEvening += evening;
  totalDinner += dinner;
  
  totalPendingMeals += pendingMeals;
  totalAdjustedMeals += adjustedMeals;
  
  grandTotal += total;
    });
  
    rows.push([
      'TOTAL',
      '',
      '',
      totalBreakfast,
      totalLunch,
      totalEvening,
      totalDinner,
      totalPendingMeals,
      totalAdjustedMeals,
      grandTotal
    ]);
  
    const ws = XLSX.utils.aoa_to_sheet([
      ['HYVA INDIA - DAILY PERMANENT EMPLOYEE REPORT'],
      [`Report Date: ${fromDate}`],
      [`Generated On: ${new Date().toLocaleString()}`],
      [],
      [
        'Date',
        'Employee ID',
        'Employee Name',
        'Breakfast',
        'Lunch',
        'Evening Snacks',
        'Dinner',
        'Pending Meals',
        'Adjusted Meals',
        'Total Meals Served'
      ]
    ]);
  
    XLSX.utils.sheet_add_aoa(
      ws,
      rows,
      { origin: 'A6' }
    );
  
    ws['!cols'] = [
      { wch: 15 },
      { wch: 15 },
      { wch: 30 },
      { wch: 12 },
      { wch: 12 },
      { wch: 18 },
      { wch: 12 },
      { wch: 15 },
      { wch: 15 },
      { wch: 18 }
    ];
  
    const wb = XLSX.utils.book_new();
  
    XLSX.utils.book_append_sheet(
      wb,
      ws,
      'Permanent Employee Report'
    );
  
    XLSX.writeFile(
      wb,
      `Daily_Permanent_Employee_Report_${fromDate}.xlsx`
    );
  
  }
  exportContractorReportExcel() {

    const fromDate = this.exportFromDate();
    const toDate = this.exportToDate();
    if (!fromDate || !toDate) {

      this.statusMessage.set({
        type: 'error',
        text: 'Please select From Date and To Date.'
      });
    
      return;
    }
  
    const contractors = this.dataService.contractors();
    const contractorMap = new Map(
      contractors.map(c => [c.id, c])
    );
  
    const coupons = this.dataService.coupons();
  
    const grouped = new Map<string, any>();

coupons
  .filter(c =>
    c.contractorId &&
    c.dateIssued.split('T')[0] >= fromDate &&
    c.dateIssued.split('T')[0] <= toDate
  )
  .forEach(c => {

    const contractor =
      contractorMap.get(c.contractorId);

    const issueDate =
      c.dateIssued.split('T')[0];

    const key =
      `${contractor?.name}-${c.couponType}-${issueDate}`;

    if (!grouped.has(key)) {

      grouped.set(key, {
        contractorName: contractor?.name || '',
        couponType: c.couponType,
        issueDate,
        quantity: 0
      });

    }

    grouped.get(key).quantity++;

  });

const rows: any[] = [];

grouped.forEach(row => {

  rows.push([
    row.contractorName,
    row.couponType,
    row.issueDate,
    row.quantity
  ]);

});
  
const ws = XLSX.utils.aoa_to_sheet([
  ['HYVA INDIA - CONTRACTOR REPORT'],
  [`Report Period: ${fromDate} To ${toDate}`],
  [`Generated On: ${new Date().toLocaleString()}`],
  [],
  [
    'Contractor Name',
    'Coupon Type',
    'Issue Date',
    'Quantity'
  ],
  ...rows
]);

ws['!merges'] = [
  { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
  { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
  { s: { r: 2, c: 0 }, e: { r: 2, c: 3 } }
];
  
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contractor Report');
  
    XLSX.writeFile(
      wb,
      `contractor_report_${fromDate}_to_${toDate}.xlsx`
    );
  }
  exportDailyContractorReport() {

    const fromDate = this.exportFromDate();
    const toDate = this.exportToDate();
  
    if (!fromDate || !toDate) {
  
      this.statusMessage.set({
        type: 'error',
        text: 'Please select From Date and To Date.'
      });
  
      return;
    }
  
    const coupons = this.dataService.coupons();
    const contractors = this.dataService.contractors();
  
    const redeemedCoupons = coupons.filter(c => {
  
      if (c.status !== 'redeemed') {
        return false;
      }
  
      if (!c.redeemDate) {
        return false;
      }
  
      if (!c.contractorId) {
        return false;
      }
  
      const redeemDate = c.redeemDate.split('T')[0];
  
      return (
        redeemDate >= fromDate &&
        redeemDate <= toDate
      );
  
    });
  
    const rows: any[] = [];
  
    let totalBreakfast = 0;
    let totalLunch = 0;
    let totalEvening = 0;
    let totalDinner = 0;
    let grandTotal = 0;
  
    contractors.forEach(contractor => {
  
      const contractorCoupons =
        redeemedCoupons.filter(
          c => c.contractorId === contractor.id
        );
  
      if (contractorCoupons.length === 0) {
        return;
      }
  
      let breakfast = 0;
      let lunch = 0;
      let evening = 0;
      let dinner = 0;
  
      contractorCoupons.forEach(coupon => {
  
        const date = new Date(coupon.redeemDate!);
  
        const currentMinutes =
          date.getHours() * 60 +
          date.getMinutes();
  
        if (currentMinutes >= 480 && currentMinutes <= 630) {
          breakfast++;
        }
        else if (currentMinutes >= 660 && currentMinutes <= 840) {
          lunch++;
        }
        else if (currentMinutes >= 990 && currentMinutes <= 1110) {
          evening++;
        }
        else if (currentMinutes >= 1170 && currentMinutes <= 1290) {
          dinner++;
        }
  
      });
  
      const total =
        breakfast +
        lunch +
        evening +
        dinner;
  
      rows.push([
        fromDate,
        contractor.businessName,   // जर compile error आला तर businessName ऐवजी name कर
        breakfast,
        lunch,
        evening,
        dinner,
        total
      ]);
  
      totalBreakfast += breakfast;
      totalLunch += lunch;
      totalEvening += evening;
      totalDinner += dinner;
      grandTotal += total;
  
    });
  
    rows.push([
      'TOTAL',
      '',
      totalBreakfast,
      totalLunch,
      totalEvening,
      totalDinner,
      grandTotal
    ]);
  
    const ws = XLSX.utils.aoa_to_sheet([
      ['HYVA INDIA - DAILY CONTRACTOR REPORT'],
      [`Report Date: ${fromDate}`],
      [`Generated On: ${new Date().toLocaleString()}`],
      [],
      [
        'Date',
        'Contractor Name',
        'Breakfast',
        'Lunch',
        'Evening Snacks',
        'Dinner',
        'Total'
      ]
    ]);
  
    XLSX.utils.sheet_add_aoa(
      ws,
      rows,
      { origin: 'A6' }
    );
  
    ws['!cols'] = [
      { wch: 15 },
      { wch: 30 },
      { wch: 12 },
      { wch: 12 },
      { wch: 18 },
      { wch: 12 },
      { wch: 12 }
    ];
  
    const wb = XLSX.utils.book_new();
  
    XLSX.utils.book_append_sheet(
      wb,
      ws,
      'Daily Contractor Report'
    );
  
    XLSX.writeFile(
      wb,
      `Daily_Contractor_Report_${fromDate}.xlsx`
    );
  
  }
  exportGuestPassReportExcel() {
    const fromDate = this.exportFromDate();
    const toDate = this.exportToDate();
    
    if (!fromDate || !toDate) {
    
      this.statusMessage.set({
        type: 'error',
        text: 'Please select From Date and To Date.'
      });
    
      return;
    }
    const rows =
      this.dataService.guestCouponRequests().map(r => [
  
        r.employeeName,
  
        r.guestName,
  
        r.guestCompany,
  
        r.couponType,
  
        r.status,
  
        r.requestDate.split('T')[0],
  
        r.decisionDate
          ? r.decisionDate.split('T')[0]
          : ''
  
      ]);
  
      const ws = XLSX.utils.aoa_to_sheet([

        ['HYVA INDIA - GUEST PASS REPORT'],
        [`Report Period: ${fromDate} To ${toDate}`],
        [`Generated On: ${new Date().toLocaleString()}`],
        [],
      
        [
          'Employee Name',
          'Guest Name',
          'Guest Company',
          'Coupon Type',
          'Status',
          'Request Date',
          'Decision Date'
        ],
      
        ...rows
      
      ]);
      
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: 6 } }
      ];
  
    ws['!cols'] = [
      { wch: 25 },
      { wch: 25 },
      { wch: 25 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 }
    ];
  
    const wb = XLSX.utils.book_new();
  
    XLSX.utils.book_append_sheet(
      wb,
      ws,
      'Guest Pass Report'
    );
  
    XLSX.writeFile(
      wb,
      `guest_pass_report_${new Date().toISOString().split('T')[0]}.xlsx`
    );
  }
  exportDailyGuestPassReport() {

    const fromDate = this.exportFromDate();
    const toDate = this.exportToDate();
  
    if (!fromDate || !toDate) {
  
      this.statusMessage.set({
        type: 'error',
        text: 'Please select From Date and To Date.'
      });
  
      return;
    }
  
    const coupons = this.dataService.coupons();
    const guestRequests =
      this.dataService.guestCouponRequests();
  
    const redeemedCoupons = coupons.filter(c => {
  
      if (c.status !== 'redeemed') {
        return false;
      }
  
      if (!c.redeemDate) {
        return false;
      }
  
      if (!c.isGuestCoupon) {
        return false;
      }
  
      const redeemDate = c.redeemDate.split('T')[0];
  
      return (
        redeemDate >= fromDate &&
        redeemDate <= toDate
      );
  
    });
    const directRedeemedGuests =
     guestRequests.filter(
    r =>
      r.requestedBy === 'canteen_manager' &&
      (r.status === 'approved' || r.status === 'redeemed') &&
      r.servedDate &&
      r.servedDate.split('T')[0] >= fromDate &&
      r.servedDate.split('T')[0] <= toDate
  );
    const rows: any[] = [];
  
    let totalBreakfast = 0;
    let totalLunch = 0;
    let totalEvening = 0;
    let totalDinner = 0;
    let grandTotal = 0;
  
    redeemedCoupons.forEach(coupon => {
  
      let breakfast = 0;
      let lunch = 0;
      let evening = 0;
      let dinner = 0;
  
      const date =
        new Date(coupon.redeemDate!);
  
      const currentMinutes =
        date.getHours() * 60 +
        date.getMinutes();
  
      if (currentMinutes >= 480 && currentMinutes <= 630) {
        breakfast = 1;
      }
      else if (currentMinutes >= 660 && currentMinutes <= 840) {
        lunch = 1;
      }
      else if (currentMinutes >= 990 && currentMinutes <= 1110) {
        evening = 1;
      }
      else if (currentMinutes >= 1170 && currentMinutes <= 1290) {
        dinner = 1;
      }
  
      const total =
        breakfast +
        lunch +
        evening +
        dinner;
  
      rows.push([
        fromDate,
        coupon.guestName || '',
        coupon.guestCompany || '',
        breakfast,
        lunch,
        evening,
        dinner,
        total
      ]);
  
      totalBreakfast += breakfast;
      totalLunch += lunch;
      totalEvening += evening;
      totalDinner += dinner;
      grandTotal += total;
  
    });
    directRedeemedGuests.forEach(request => {

      let breakfast = 0;
let lunch = 0;
let evening = 0;
let dinner = 0;

const date = new Date(request.servedDate!);

const currentMinutes =
  date.getHours() * 60 +
  date.getMinutes();

if (currentMinutes >= 450 && currentMinutes <= 630) {
  breakfast = 1;
}
else if (currentMinutes >= 690 && currentMinutes <= 870) {
  lunch = 1;
}
else if (currentMinutes >= 990 && currentMinutes <= 1110) {
  evening = 1;
}
else if (currentMinutes >= 1170 && currentMinutes <= 1290) {
  dinner = 1;
}
    
      const total =
        breakfast +
        lunch +
        evening +
        dinner;
    
      rows.push([
        request.servedDate?.split('T')[0] || fromDate,
        request.guestName || '',
        request.guestCompany || '',
        breakfast,
        lunch,
        evening,
        dinner,
        total
      ]);
    
      totalBreakfast += breakfast;
      totalLunch += lunch;
      totalEvening += evening;
      totalDinner += dinner;
      grandTotal += total;
    
    });
  
    rows.push([
      'TOTAL',
      '',
      '',
      totalBreakfast,
      totalLunch,
      totalEvening,
      totalDinner,
      grandTotal
    ]);
  
    const ws = XLSX.utils.aoa_to_sheet([
      ['HYVA INDIA - DAILY GUEST PASS REPORT'],
      [`Report Date: ${fromDate}`],
      [`Generated On: ${new Date().toLocaleString()}`],
      [],
      [
        'Date',
        'Guest Name',
        'Guest Company',
        'Breakfast',
        'Lunch',
        'Evening Snacks',
        'Dinner',
        'Total'
      ]
    ]);
  
    XLSX.utils.sheet_add_aoa(
      ws,
      rows,
      { origin: 'A6' }
    );
  
    ws['!cols'] = [
      { wch: 15 },
      { wch: 25 },
      { wch: 25 },
      { wch: 12 },
      { wch: 12 },
      { wch: 18 },
      { wch: 12 },
      { wch: 12 }
    ];
  
    const wb = XLSX.utils.book_new();
  
    XLSX.utils.book_append_sheet(
      wb,
      ws,
      'Daily Guest Report'
    );
  
    XLSX.writeFile(
      wb,
      `Daily_Guest_Pass_Report_${fromDate}.xlsx`
    );
  
  }
  
  exportDailyContractorEmployeeReportExcel() {

    const fromDate = this.exportFromDate();
    const toDate = this.exportToDate();
  
    if (!fromDate || !toDate) {
  
      this.statusMessage.set({
        type: 'error',
        text: 'Please select From Date and To Date.'
      });
  
      return;
    }
  
    const coupons = this.dataService.coupons();
  
    const employees =
      this.dataService
        .employees()
        .filter(e =>
          e.role === 'contractual employee' &&
          e.status === 'active'
        );
  
    const contractors =
      this.dataService.contractors();
    const pendingRequests =
      this.dataService.pendingMealRequests();  
  
    const rows: any[] = [];
  
    let totalBreakfast = 0;
    let totalLunch = 0;
    let totalEvening = 0;
    let totalDinner = 0;
    let grandTotal = 0;
    let totalPendingMeals = 0;
    let totalAdjustedMeals = 0;
  
    employees.forEach(employee => {
  
      const contractor =
        contractors.find(
          c => c.businessName === employee.contractor
        );
  
      if (!contractor) {
        return;
      }
  
      const employeeCoupons =
        coupons.filter(c => {
  
          if (c.employeeId !== employee.id) {
            return false;
          }
  
          if (c.status !== 'redeemed') {
            return false;
          }
  
          if (!c.redeemDate) {
            return false;
          }
  
          const redeemDate =
            c.redeemDate.split('T')[0];
  
          return (
            redeemDate >= fromDate &&
            redeemDate <= toDate
          );
  
        });
        let breakfast = 0;
        let lunch = 0;
        let evening = 0;
        let dinner = 0;

        let pendingMeals = 0;
        let adjustedMeals = 0;
        pendingMeals =
        pendingRequests.filter(
          r =>
            r.employeeId === employee.id &&
            r.mealDate >= fromDate &&
            r.mealDate <= toDate &&
            r.status === 'pending'
        ).length;
      
      adjustedMeals =
        pendingRequests.filter(
          r =>
            r.employeeId === employee.id &&
            r.mealDate >= fromDate &&
            r.mealDate <= toDate &&
            r.isCouponAdjusted === true
        ).length;
        if (
          employeeCoupons.length === 0 &&
          pendingMeals === 0 &&
          adjustedMeals === 0
        ) {
          return;
        }
  
      employeeCoupons.forEach(coupon => {
  
        const date =
          new Date(coupon.redeemDate!);
  
        const minutes =
          date.getHours() * 60 +
          date.getMinutes();
  
        if (minutes >= 480 && minutes <= 630) {
          breakfast++;
        }
        else if (minutes >= 660 && minutes <= 840) {
          lunch++;
        }
        else if (minutes >= 990 && minutes <= 1110) {
          evening++;
        }
        else if (minutes >= 1170 && minutes <= 1290) {
          dinner++;
        }
  
      });
  
      const total =
       breakfast +
       lunch +
       evening +
       dinner +
       pendingMeals;
  
       rows.push([
        fromDate,
        contractor.businessName,
        employee.employeeId,
        employee.name,
        breakfast,
        lunch,
        evening,
        dinner,
        pendingMeals,
        adjustedMeals,
        total
      ]);
  
      totalBreakfast += breakfast;
      totalLunch += lunch;
      totalEvening += evening;
      totalDinner += dinner;

      totalPendingMeals += pendingMeals;
      totalAdjustedMeals += adjustedMeals;

      grandTotal += total;
  
    });
  
    rows.push([
      'TOTAL',
      '',
      '',
      '',
      totalBreakfast,
      totalLunch,
      totalEvening,
      totalDinner,
      totalPendingMeals,
      totalAdjustedMeals,
      grandTotal
    ]);
  
    const ws = XLSX.utils.aoa_to_sheet([
      ['HYVA INDIA - DAILY CONTRACTOR EMPLOYEE REPORT'],
      [`Report Date : ${fromDate}`],
      [`Generated On : ${new Date().toLocaleString()}`],
      [],
      [
        'Date',
        'Contractor',
        'Employee ID',
        'Employee Name',
        'Breakfast',
        'Lunch',
        'Evening Snacks',
        'Dinner',
        'Pending Meals',
        'Adjusted Meals',
        'Total Meals Served'
      ]
    ]);
  
    XLSX.utils.sheet_add_aoa(
      ws,
      rows,
      { origin: 'A6' }
    );
  
    ws['!cols'] = [
      { wch: 15 },
      { wch: 30 },
      { wch: 15 },
      { wch: 30 },
      { wch: 12 },
      { wch: 12 },
      { wch: 18 },
      { wch: 12 },
      { wch: 15 },
      { wch: 15 },
      { wch: 18 }
    ];
  
    const wb = XLSX.utils.book_new();
  
    XLSX.utils.book_append_sheet(
      wb,
      ws,
      'Contractor Employees'
    );
  
    XLSX.writeFile(
      wb,
      `Daily_Contractor_Employee_Report_${fromDate}.xlsx`
    );
  
  }

  exportCouponsPdf() {
    const doc = new jspdf.jsPDF({ orientation: 'landscape' });
    const employeesToExport = this.filteredAndSortedEmployees();
    const statsMap = this.employeeCouponStats();
    const dateStatsMap = this.employeeDateStats();
    const breakdownHeaders = this.couponTypes.map((t) => `${t.substring(0, 1)} (I/R)`);
    const head = [
      ['Name', 'ID', 'Dept', ...breakdownHeaders, 'Total', 'Last Issued', 'Last Redeemed'],
    ];
    const body = employeesToExport.map((emp) => {
      const stats = statsMap.get(emp.id);
      const dateStats =
        dateStatsMap.get(emp.id) || { lastIssued: null, lastRedeemed: null };
      const breakdownValues = this.couponTypes.map((type) => {
        const typeStat = stats?.breakdown[type];
        return typeStat ? `${typeStat.issued}/${typeStat.redeemed}` : '0/0';
      });
      const totalValue = stats
        ? `${stats.totalIssued}/${stats.totalRedeemed}`
        : '0/0';
      return [
        emp.name,
        emp.employeeId,
        emp.department || 'N/A',
        ...breakdownValues,
        totalValue,
        this.formatDateTime(dateStats.lastIssued),
        this.formatDateTime(dateStats.lastRedeemed),
      ];
    });
    doc.setFontSize(18);
    doc.text('Hyva India (Pune) - Employee Coupon Report', 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 29);
    jspdf.autoTable(doc, {
      startY: 35,
      head: head,
      body: body,
      theme: 'striped',
      headStyles: { fillColor: [75, 85, 99] },
      styles: { fontSize: 7, cellPadding: 1.5 },
    });
    doc.save('hyva_pune_canteen_coupon_report.pdf');
  }
}
