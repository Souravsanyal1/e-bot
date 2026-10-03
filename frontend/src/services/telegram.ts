declare global {
  interface Window {
    Telegram?: {
      WebApp?: any;
    };
  }
}

export const tg = {
  get WebApp() {
    return typeof window !== 'undefined' ? window.Telegram?.WebApp : null;
  },

  isAvailable() {
    return Boolean(this.WebApp && this.WebApp.initData);
  },

  init() {
    const app = this.WebApp;
    if (app) {
      try {
        app.ready();
        app.expand();
        if (app.setHeaderColor) {
          app.setHeaderColor('#0A0A0F');
        }
        if (app.setBackgroundColor) {
          app.setBackgroundColor('#0A0A0F');
        }
      } catch (e) {
        console.warn('Telegram WebApp init warning:', e);
      }
    }
  },

  getUser() {
    const app = this.WebApp;
    if (app?.initDataUnsafe?.user) {
      return app.initDataUnsafe.user;
    }
    // Clean unique device ID for browser preview with zero initial balance
    let devId = localStorage.getItem('eforce_local_uid');
    if (!devId) {
      devId = String(Math.floor(100000000 + Math.random() * 900000000));
      localStorage.setItem('eforce_local_uid', devId);
    }
    return {
      id: parseInt(devId, 10),
      first_name: 'Miner #' + devId.slice(-4),
      username: '',
      is_dev: true
    };
  },

  getInitData() {
    return this.WebApp?.initData || '';
  },

  getStartParam(): string {
    const app = this.WebApp;
    // 1. Direct Telegram WebApp start_param from initDataUnsafe
    if (app?.initDataUnsafe?.start_param) {
      return String(app.initDataUnsafe.start_param).trim();
    }

    // 2. Query parameters in URL (search)
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const queryParam = 
        searchParams.get('tgWebAppStartParam') || 
        searchParams.get('startapp') || 
        searchParams.get('start') || 
        searchParams.get('ref') || '';
      if (queryParam) return queryParam.trim();
    } catch {}

    // 3. Hash parameters in URL
    try {
      if (window.location.hash) {
        const hashClean = window.location.hash.replace(/^#\/?/, '');
        const hashParams = new URLSearchParams(hashClean);
        const hashParam = 
          hashParams.get('tgWebAppStartParam') || 
          hashParams.get('startapp') || 
          hashParams.get('start') || 
          hashParams.get('ref') || '';
        if (hashParam) return hashParam.trim();
      }
    } catch {}

    // 4. Stored session fallback
    try {
      return localStorage.getItem('eforce_pending_ref') || '';
    } catch {
      return '';
    }
  },

  haptic: {
    impact(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'medium') {
      try {
        window.Telegram?.WebApp?.HapticFeedback?.impactOccurred(style);
      } catch (e) {}
    },
    notification(type: 'error' | 'success' | 'warning' = 'success') {
      try {
        window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred(type);
      } catch (e) {}
    },
    selection() {
      try {
        window.Telegram?.WebApp?.HapticFeedback?.selectionChanged();
      } catch (e) {}
    }
  },

  openLink(url: string) {
    if (this.WebApp?.openLink) {
      this.WebApp.openLink(url);
    } else {
      window.open(url, '_blank');
    }
  },

  openTelegramLink(url: string) {
    if (this.WebApp?.openTelegramLink) {
      this.WebApp.openTelegramLink(url);
    } else {
      window.open(url, '_blank');
    }
  }
};
