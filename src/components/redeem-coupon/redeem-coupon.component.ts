import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  Validators,
  FormGroup,
  FormControl,
} from '@angular/forms';
import { DataService } from '../../services/data.service';
import { RouterLink } from '@angular/router';

// Declare Html5Qrcode global
declare var Html5Qrcode: any;

type AlertType = 'redeemed' | 'not_available' | 'already_redeemed';

@Component({
  selector: 'app-redeem-coupon',
  standalone: true,
  templateUrl: './redeem-coupon.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
})
export class RedeemCouponComponent implements OnDestroy {
  couponCheckMode = signal(false);

employeeCouponInfo = signal<any>(null);
  requestFilter =
  signal<'all' | 'pending' | 'completed'>(
    'all'
  );

pendingMealRequests = computed(() => {

  const filter =
    this.requestFilter();

  const requests =
    this.dataService
      .pendingMealRequests();

  if (filter === 'pending') {
    return requests.filter(
      r => r.status === 'pending'
    );
  }

  if (filter === 'completed') {
    return requests.filter(
      r => r.status === 'completed'
    );
  }

  return requests;

});
  pendingEmployeeId = signal<number | null>(null);

pendingEmployeeName = signal('');

pendingMealType = signal('');
  private dataService = inject(DataService);
  private html5QrCode: any;

  // small status message
  redeemStatusMessage = signal<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  // QR scanner state
  isScannerVisible = signal(false);
  scannerErrorMessage = signal<string | null>(null);

  // big alert banner
  alertVisible = signal(false);
  alertType = signal<AlertType | null>(null);
  alertMessage = signal('');

  redeemCouponForm = new FormGroup({
    code: new FormControl('', [
      Validators.required,
      Validators.minLength(1),
    ]),
  });

  constructor() {}

  ngOnDestroy() {
    this.stopScanner();
    this.stopSpeaking();
  }

  showScanner() {
    this.isScannerVisible.set(true);
    this.scannerErrorMessage.set(null);
    setTimeout(() => this.startScanner(), 100);
  }

  hideScanner() {
    this.stopScanner();
    this.isScannerVisible.set(false);
  }

  private async startScanner() {
    
    const readerElementId = 'qr-reader-redeem';
    if (!document.getElementById(readerElementId)) {
      this.scannerErrorMessage.set(
        'QR Reader element could not be initialized. Please refresh.'
      );
      console.error('QR Reader element not found in DOM.');
      return;
    }

    this.html5QrCode = new Html5Qrcode(readerElementId);
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

    const onScanSuccess = (decodedText: string) => {
      const code = decodedText.trim();
      const isPermanentQr = code.startsWith('EMP:') || code.toUpperCase().startsWith('EMP') || isNaN(Number(code)) || code.length > 4;

      if (isPermanentQr) {
        this.handlePermanentQr(code);
      } else {
        this.redeemCouponForm.patchValue({ code: code });
        this.handleRedeemCoupon();
      }
      this.hideScanner();
    };

    const onScanFailure = (_error: string) => {
      // ignore
    };

    this.html5QrCode
      .start({ facingMode: 'environment' }, config, onScanSuccess, onScanFailure)
      .catch((err: any) => {
        console.error('Unable to start QR scanner', err);
      
        this.scannerErrorMessage.set(
          'Scanner Error: ' + JSON.stringify(err)
        );
      });
  }

  private stopScanner() {
    if (this.html5QrCode && this.html5QrCode.isScanning) {
      this.html5QrCode
        .stop()
        .catch((err: any) => console.error('Error stopping the scanner.', err));
    }
  }

  async handleRedeemCoupon() {
    if (!this.redeemCouponForm.valid) return;

    const code = this.redeemCouponForm.value.code!.trim();
    this.redeemStatusMessage.set(null);
    this.hideAlertManually();

    const isPermanentQr = code.startsWith('EMP:') || code.toUpperCase().startsWith('EMP') || isNaN(Number(code)) || code.length > 4;

    if (isPermanentQr) {
      await this.handlePermanentQr(code);
      this.redeemCouponForm.reset();
      return;
    }

    try {
      const result = await this.dataService.redeemCouponByCode(code);

      this.redeemStatusMessage.set({
        type: result.success ? 'success' : 'error',
        text: result.message,
      });

      const msg = result.message || '';
      let type: AlertType;

      if (result.success) {
        type = 'redeemed';
      } else if (
        msg.toLowerCase().includes('already been redeemed') ||
        msg.toLowerCase().includes('already redeemed')
      ) {
        type = 'already_redeemed';
      } else if (
        msg.includes('Invalid coupon code.') ||
        msg.includes('This coupon has not been assigned to an employee yet.') ||
        msg.includes('Cannot redeem coupon. Employee account is deactivated.')
      ) {
        type = 'not_available';
      } else {
        type = 'not_available';
      }

      this.showAlert(type, msg);
    } catch (err) {
      console.error('Error in redeemCouponByCode:', err);
      this.redeemStatusMessage.set({
        type: 'error',
        text: 'Something went wrong while redeeming the coupon.',
      });

      this.showAlert('not_available', 'Something went wrong while redeeming.');
    }

    this.redeemCouponForm.reset();
    setTimeout(() => this.redeemStatusMessage.set(null), 7000);
  }
  async handlePermanentQr(qrText: string) {
    if (this.couponCheckMode()) {

      const data =
        this.dataService.getEmployeeCouponSummary(
          qrText
        );
    
      this.employeeCouponInfo.set(data);
    
      this.hideScanner();
    
      return;
    }
    this.hideScanner();
  
    try {
  
      const result =
        await this.dataService.redeemPermanentQr(qrText);
  
      this.redeemStatusMessage.set({
        type: result.success ? 'success' : 'error',
        text: result.message,
      });
  
      if (result.success) {
        this.showAlert('redeemed', result.message);
      } else if (
        result.message.toLowerCase().includes('already')
      ) {
        this.showAlert('already_redeemed', result.message);
      } else {

        if (result.canCreateRequest) {
      
          this.pendingEmployeeId.set(
            result.employeeId || null
          );
      
          this.pendingEmployeeName.set(
            result.employeeName || ''
          );
      
          this.pendingMealType.set(
            result.mealType || ''
          );
      
        }
      
        this.showAlert(
          'not_available',
          result.message
        );
      
      }
  
    } catch (err) {
  
      console.error(err);
  
      this.showAlert(
        'not_available',
        'QR redeem failed'
      );
    }
  }
  // ========== ALERT + VOICE HELPERS ==========

  private showAlert(type: AlertType, message: string) {
    this.alertType.set(type);
    this.alertMessage.set(message);
    this.alertVisible.set(true);

    this.speakForType(type);

    setTimeout(() => {
      this.alertVisible.set(false);
      this.alertType.set(null);
    }, 8000);
  }
  createMealRequest() {

    const confirmed = confirm(
      `Create ${this.pendingMealType()} meal request for ${this.pendingEmployeeName()}?`
    );
  
    if (!confirmed) {
      return;
    }
  
    const result =
      this.dataService.createPendingMealRequest(
        this.pendingEmployeeId()!,
        this.pendingEmployeeName(),
        this.pendingMealType() as any
      );
  
    alert(result.message);
  
    if (result.success) {
  
      this.pendingEmployeeId.set(null);
  
      this.pendingEmployeeName.set('');
  
      this.pendingMealType.set('');
  
    }
  
  }
  hideAlertManually() {
    this.alertVisible.set(false);
    this.alertType.set(null);
    this.stopSpeaking();
  }

  // 🔊 Browser Text-to-Speech
  private speakForType(type: AlertType) {

    // Android APK
    if ((window as any).Capacitor) {

      let audioFile = '';
    
      if (type === 'redeemed') {
        audioFile = 'src/assets/sounds/coupon_redeemed.mp3';
      } else if (type === 'not_available') {
        audioFile = 'src/assets/sounds/coupon_not_available.mp3';
      } else if (type === 'already_redeemed') {
        audioFile = 'src/assets/sounds/coupon_already_redeemed.mp3';
      }
    
      const audio = new Audio(audioFile);
    
      audio.play().catch(err => {
        console.error('Audio play failed', err);
      });
    
      return;
    }
  
    // Web Browser TTS
    this.stopSpeaking();
  
    if (!('speechSynthesis' in window)) {
      return;
    }
  
    let text = '';
  
    if (type === 'redeemed') {
      text = 'Coupon redeemed successfully';
    } else if (type === 'not_available') {
      text = 'Coupon not available';
    } else if (type === 'already_redeemed') {
      text = 'Coupon already redeemed';
    }
  
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-IN';
  
    window.speechSynthesis.speak(utterance);
  }

  private stopSpeaking() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }
}
