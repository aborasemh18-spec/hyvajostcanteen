import { Component, inject, computed } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from '../components/shared/sidebar/sidebar.component';
import { HeaderComponent } from '../components/shared/header/header.component';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CommonModule, SidebarComponent, HeaderComponent],
  templateUrl: './app.html'
})
export class App {
  authService = inject(AuthService);
  router = inject(Router);
  currentUser = this.authService.currentUser;
  
  showSidebar = computed(() => {
    const user = this.currentUser();
    if (!user) return false;
    
    if ('role' in user) {
      if (user.role === 'employee' || user.role === 'contractual employee') {
        return false;
      }
      return true;
    }
    
    if ('contractorId' in user) {
      return true;
    }
    
    return false;
  });

  onLogout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}

