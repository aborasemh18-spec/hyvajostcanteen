import { ApplicationConfig, provideZonelessChangeDetection, APP_INITIALIZER } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { SupabaseHealthCheckService } from '../supabase/supabase-health-check.service';

export function initializeSupabase(healthCheckService: SupabaseHealthCheckService) {
  return () => healthCheckService.runHealthCheck();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes),
    {
      provide: APP_INITIALIZER,
      useFactory: initializeSupabase,
      deps: [SupabaseHealthCheckService],
      multi: true,
    }
  ]
};
