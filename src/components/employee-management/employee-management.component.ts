import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, Validators, FormGroup, FormControl } from '@angular/forms';
import { DataService } from '../../services/data.service';
import { AuthService } from '../../services/auth.service';
import { Employee } from '../../models/user.model';
import { RouterLink } from '@angular/router';
import { jsPDF } from 'jspdf';
import * as QRCode from 'qrcode';

@Component({
  selector: 'app-employee-management',
  templateUrl: './employee-management.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, RouterLink]
})
export class EmployeeManagementComponent {
  private dataService = inject(DataService);
  private authService = inject(AuthService);
  selectedEmployees = signal<number[]>([]);
  isQrPoolModalOpen = signal(false);
  qrPoolCount = signal(100);
toggleEmployee(id: number) {
  const selected = this.selectedEmployees();

  if (selected.includes(id)) {
    this.selectedEmployees.set(
      selected.filter(x => x !== id)
    );
  } else {
    this.selectedEmployees.set(
      [...selected, id]
    );
  }
}
  
  // FIX: Added a type guard to ensure the user is an Employee before accessing employeeId.
  isSuperAdmin = computed(() => {
    const user = this.authService.currentUser();
    return user && 'employeeId' in user && user.employeeId === 'admin01';
  });
  employees = computed(() => this.dataService.employees().filter(e => e.role === 'employee' || e.role === 'contractual employee'));
  
  isEditModalOpen = signal(false);
  isDeleteModalOpen = signal(false);
  isDeactivateModalOpen = signal(false);
  isAddDepartmentModalOpen = signal(false);
  selectedEmployeeForAction = signal<Employee | null>(null);
  statusMessage = signal<{ type: 'success' | 'error', text: string } | null>(null);

  searchTerm = signal('');
  sortConfig = signal<{ key: keyof Employee, direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });

  departments = signal<string[]>([
    'HR & Admin', 'Operations', 'SCM', 'PPC', 'Production', 'Stores', 
    'IT', 'Security', 'Housekeeping', 'Sales', 'Finance', 'Quality'
  ]);
  contractors = this.dataService.contractorBusinessNames;
  editEmployeeForm: FormGroup;
  newDepartmentForm: FormGroup;

  constructor() {
    this.editEmployeeForm = new FormGroup({
      id: new FormControl(0, [Validators.required]),
      name: new FormControl('', [Validators.required]),
      email: new FormControl('', [Validators.email]),
      employeeId: new FormControl('', [Validators.required]),
      department: new FormControl(''),
      role: new FormControl<Employee['role']>('employee', [Validators.required]),
      contractor: new FormControl(''),
    });

    this.newDepartmentForm = new FormGroup({
      name: new FormControl('', [Validators.required])
    });

    this.editEmployeeForm.get('role')?.valueChanges.subscribe(role => {
      const departmentControl = this.editEmployeeForm.get('department');
      const contractorControl = this.editEmployeeForm.get('contractor');
      if (role === 'employee') {
          departmentControl?.setValidators([Validators.required]);
      } else {
          departmentControl?.clearValidators();
          departmentControl?.setValue('');
      }
      departmentControl?.updateValueAndValidity();

      if (role === 'contractual employee') {
        contractorControl?.setValidators([Validators.required]);
      } else {
        contractorControl?.clearValidators();
        contractorControl?.setValue('');
      }
      contractorControl?.updateValueAndValidity();
    });
  }
  
  filteredAndSortedEmployees = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const { key, direction } = this.sortConfig();

    let filtered = this.employees().filter(employee => 
      employee.name.toLowerCase().includes(term) ||
      (employee.email && employee.email.toLowerCase().includes(term)) ||
      (employee.employeeId && employee.employeeId.toLowerCase().includes(term)) ||
      (employee.department && employee.department.toLowerCase().includes(term)) ||
      (employee.contractor && employee.contractor.toLowerCase().includes(term))
    );

    return filtered.sort((a, b) => {
      const valA = a[key] || '';
      const valB = b[key] || '';
      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  });
  
  updateSearch(event: Event) {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  setSort(key: keyof Employee) {
    if (this.sortConfig().key === key) {
      this.sortConfig.update(config => ({...config, direction: config.direction === 'asc' ? 'desc' : 'asc' }));
    } else {
      this.sortConfig.set({ key, direction: 'asc' });
    }
  }

  // --- Modal and Action Logic ---
  openQrPoolModal() {
    this.isQrPoolModalOpen.set(true);
  }
  
  closeQrPoolModal() {
    this.isQrPoolModalOpen.set(false);
  }
  
  async generateQrPoolCards() {
  
    await this.dataService.generateQrPool(
      this.qrPoolCount()
    );
  
    this.statusMessage.set({
      type: 'success',
      text: `${this.qrPoolCount()} QR cards generated successfully.`
    });
  
    this.closeQrPoolModal();
  }
  openEditModal(employee: Employee) {
    this.selectedEmployeeForAction.set(employee);
    this.editEmployeeForm.patchValue({
      id: employee.id,
      name: employee.name,
      email: employee.email || '',
      employeeId: employee.employeeId,
      department: employee.department || '',
      role: employee.role,
      contractor: employee.contractor || ''
    });
    this.isEditModalOpen.set(true);
  }

  openDeleteModal(employee: Employee) {
    this.selectedEmployeeForAction.set(employee);
    this.isDeleteModalOpen.set(true);
  }
  
  openDeactivateModal(employee: Employee) {
    this.selectedEmployeeForAction.set(employee);
    this.isDeactivateModalOpen.set(true);
  }

  closeModals() {
    this.isEditModalOpen.set(false);
    this.isDeleteModalOpen.set(false);
    this.isDeactivateModalOpen.set(false);
    this.isAddDepartmentModalOpen.set(false);
    this.selectedEmployeeForAction.set(null);
  }

  handleUpdateEmployee() {
    if (this.editEmployeeForm.valid) {
      const formValue = this.editEmployeeForm.value;
      const originalEmployee = this.employees().find(e => e.id === formValue.id);

      if (originalEmployee) {
        const updatedEmployee: Employee = {
            ...originalEmployee,
            name: formValue.name!,
            employeeId: formValue.employeeId!,
            role: formValue.role!,
            email: formValue.email || undefined,
            department: formValue.role === 'employee' ? formValue.department! : undefined,
            contractor: formValue.role === 'contractual employee' ? formValue.contractor! : undefined,
        };
        this.dataService.updateEmployee(updatedEmployee);
        this.statusMessage.set({ type: 'success', text: 'Employee details updated successfully.' });
        this.closeModals();
        setTimeout(() => this.statusMessage.set(null), 5000);
      }
    }
  }
  
  confirmDelete() {
    const employeeToDelete = this.selectedEmployeeForAction();
    if (employeeToDelete) {
        this.dataService.deleteEmployee(employeeToDelete.id);
        this.statusMessage.set({ type: 'success', text: `Employee "${employeeToDelete.name}" has been deleted.` });
        this.closeModals();
        setTimeout(() => this.statusMessage.set(null), 5000);
    }
  }

  confirmToggleStatus() {
    const employee = this.selectedEmployeeForAction();
    if (employee) {
      this.dataService.toggleEmployeeStatus(employee.id);
      const action = employee.status === 'active' ? 'deactivated' : 'reactivated';
      this.statusMessage.set({ type: 'success', text: `Employee "${employee.name}" has been ${action}.` });
      this.closeModals();
      setTimeout(() => this.statusMessage.set(null), 5000);
    }
  }

  openAddDepartmentModal() {
    this.newDepartmentForm.reset();
    this.isAddDepartmentModalOpen.set(true);
  }

  handleAddNewDepartment() {
    if (this.newDepartmentForm.valid) {
      const newDepartmentName = this.newDepartmentForm.value.name!;
      this.departments.update(deps => [...deps, newDepartmentName].sort());
      this.editEmployeeForm.patchValue({ department: newDepartmentName });
      this.isAddDepartmentModalOpen.set(false);
    }
  }
  async downloadSelectedQrPdf() {

    const selectedIds = this.selectedEmployees();
  
    const employees =
      this.filteredAndSortedEmployees()
        .filter(e => selectedIds.includes(e.id));
  
    if (employees.length === 0) {
      alert('Please select employees');
      return;
    }
  
    const pdf = new jsPDF('p', 'mm', 'a4');
  
    let x = 10;
    let y = 10;
    let count = 0;
  
    for (const emp of employees) {
  
      const qr = await QRCode.toDataURL(
        emp.permanentQrCode || `EMP:${emp.id}`
      );
  
    // Card Border
pdf.setDrawColor(180);
pdf.setLineWidth(0.5);
pdf.roundedRect(
  x,
  y,
  60,
  85,
  4,
  4
);

// Header
pdf.setFillColor(
  25,
  45,
  95
);

pdf.roundedRect(
  x,
  y,
  60,
  10,
  4,
  4,
  'F'
);

pdf.setTextColor(
  255,
  255,
  255
);

pdf.setFontSize(10);
pdf.setFont(
  'helvetica',
  'bold'
);

pdf.text(
  'HYVA CANTEEN',
  x + 30,
  y + 8,
  {
    align: 'center'
  }
);

// Employee Name
pdf.setTextColor(
  0,
  0,
  0
);

pdf.setFontSize(12);

pdf.text(
  emp.name,
  x + 30,
  y + 18,
  { align: 'center' }
);

// Employee ID
pdf.setFontSize(9);

pdf.setFont(
  'helvetica',
  'normal'
);

pdf.text(
  `ID : ${emp.employeeId}`,
  x + 30,
  y + 24,
  { align: 'center' }
);

// QR Border
pdf.setDrawColor(220);

pdf.roundedRect(
  x + 10,
  y + 28,
  40,
  40,
  3,
  3
);

// QR Image
pdf.addImage(
  qr,
  'PNG',
  x + 15,
  y + 33,
  30,
  30
);

// Footer Line
pdf.line(
  x + 5,
  y + 72,
  x + 55,
  y + 72
);

pdf.setFontSize(8);
pdf.setTextColor(90);

pdf.text(
  'SCAN TO REDEEM',
  x + 30,
  y + 78,
  {
    align: 'center'
  }
);
  
      count++;
      x += 65;
  
      if (count % 2 === 0) {
        x = 10;
        y += 90;
      }
  
      if (count % 4 === 0) {
        pdf.addPage();
        x = 10;
        y = 10;
      }
    }
  
    pdf.save('Employee_QR_Cards.pdf');
  }
  async downloadSelectedQrCardsPdf() {

    const selected =
      this.selectedQrCards();
  
    const cards =
      this.qrCards()
        .filter(c =>
          selected.includes(c.cardCode)
        );
  
    if (cards.length === 0) {
  
      alert('Please select QR cards');
  
      return;
    }
  
    const pdf =
      new jsPDF('p', 'mm', 'a4');
  
    let x = 10;
    let y = 10;
    let count = 0;
  
    for (const card of cards) {
  
      const qr =
        await QRCode.toDataURL(
          card.cardCode
        );
  
      pdf.rect(x, y, 60, 50);
  
      pdf.setFontSize(10);
      pdf.text(
        'HYVA CANTEEN',
        x + 8,
        y + 7
      );
  
      pdf.text(
        card.cardCode,
        x + 12,
        y + 15
      );
  
      pdf.addImage(
        qr,
        'PNG',
        x + 16,
        y + 18,
        25,
        25
      );
  
      count++;
      x += 65;
  
      if (count % 3 === 0) {
        x = 10;
        y += 55;
      }
  
      if (count % 15 === 0) {
        pdf.addPage();
        x = 10;
        y = 10;
      }
    }
  
    pdf.save('QR_Pool_Cards.pdf');
  }
  showQrPool = signal(false);
  qrSearch = signal('');

selectedQrCards = signal<string[]>([]);

qrFilter = signal<'all' | 'available' | 'assigned'>('all');

qrCards = computed(() => {

  const filter = this.qrFilter();

  const search =
    this.qrSearch()
      .toLowerCase();

  let cards =
    this.dataService.qrCards();

  if (filter === 'available') {
    cards = cards.filter(c => !c.assigned);
  }

  if (filter === 'assigned') {
    cards = cards.filter(c => c.assigned);
  }

  if (search) {

    cards = cards.filter(c =>

      c.cardCode
        .toLowerCase()
        .includes(search)

      ||

      (c.employeeName || '')
        .toLowerCase()
        .includes(search)

    );

  }

  return cards;

});

toggleQrCard(cardCode: string) {

  const current = this.selectedQrCards();

  if (current.includes(cardCode)) {

    this.selectedQrCards.set(
      current.filter(x => x !== cardCode)
    );

  } else {

    this.selectedQrCards.set([
      ...current,
      cardCode
    ]);

  }
  }
  toggleAllQrCards() {

    const allCards =
      this.qrCards()
        .map(c => c.cardCode);
  
    if (
      this.selectedQrCards().length ===
      allCards.length
    ) {
  
      this.selectedQrCards.set([]);
  
    } else {
  
      this.selectedQrCards.set(allCards);
  
    }
  
  }
}
