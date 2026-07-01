import { Component, inject } from '@angular/core';
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
  
  onLogout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}

