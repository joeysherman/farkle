import { registerSW } from 'virtual:pwa-register';

// Add type declaration to fix TypeScript error
declare module 'virtual:pwa-register' {
  export interface RegisterSWOptions {
    immediate?: boolean;
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
    onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void;
    onRegisterError?: (error: any) => void;
  }

  export function registerSW(options?: RegisterSWOptions): (reloadPage?: boolean) => Promise<void>;
}

// This is the service worker registration code
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('🔄 New content available, click on reload button to update.');
    if (confirm('New content available. Reload?')) {
      console.log('🔄 Updating application...');
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log('🟢 App ready to work offline');
  },
  onRegistered(registration) {
    if (registration) {
      console.log('🟢 Service Worker registered successfully');
      
      // Setup periodic check for updates
      setInterval(() => {
        registration.update();
        console.log('🔍 Checking for PWA updates');
      }, 60 * 60 * 1000); // Check every hour
    } else {
      console.log('❌ Service Worker registration failed');
    }
  },
  onRegisterError(error) {
    console.error('😢 Service Worker registration failed:', error);
  }
}); 