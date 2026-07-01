// NOTE: Filename is user.model.ts but this now defines the Employee model.
export interface Employee {
  id: number;
  name: string;
  email?: string;
  employeeId: string;
  password: string;
  role: 'admin' | 'contractual employee' | 'employee' | 'canteen manager';
  department?: string;
  employeeCategory?: 'Staff' | 'Technician';
  status: 'active' | 'deactivated';
  contractor?: string;
  permanentQrCode?: string;
  assignedQrCard?: string;
  lastRedeemedDate?: string;
  lastMorningBreakfastDate?: string;
  lastLunchDate?: string;
  lastEveningBreakfastDate?: string;
  lastDinnerDate?: string;
}