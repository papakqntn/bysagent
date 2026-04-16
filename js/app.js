/**
 * BYŚ Agent — Main Application
 * Routing, navigation, and global state management
 */
class App {
  constructor() {
    this.data = new DataManager();
    this.currentView = 'home';
    this.toastTimeout = null;
    this.init();
  }

  // ─── Initialize ────────────────────────────────────────

  init() {
    // Register service worker
    this.registerSW();

    // Update home screen stats
    this.updateHomeStats();
    this.updateRecentList();

    // Setup list search
    listView.setupSearch();

    // Handle back button
    window.addEventListener('popstate', (e) => {
      if (e.state && e.state.view) {
        this.navigateTo(e.state.view, false);
      } else {
        this.navigateTo('home', false);
      }
    });

    // Close modals on overlay click
    document.getElementById('detail-modal').addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-overlay')) {
        listView.closeDetail();
      }
    });

    document.getElementById('edit-modal').addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-overlay')) {
        listView.closeEdit();
      }
    });

    // Push initial state
    history.replaceState({ view: 'home' }, '', '');

    console.log('BYŚ Agent initialized ✓');
  }

  // ─── Navigation ────────────────────────────────────────

  navigateTo(view, pushState = true) {
    if (view === this.currentView) return;

    const currentEl = document.getElementById(`${this.currentView}-view`);
    const nextEl = document.getElementById(`${view}-view`);

    if (!currentEl || !nextEl) return;

    // Animate out
    currentEl.classList.remove('active');

    // Animate in
    nextEl.classList.add('active');

    if (pushState) {
      history.pushState({ view }, '', '');
    }

    this.currentView = view;

    // View-specific init
    if (view === 'map') {
      mapView.init();
      mapView.resize();
    } else if (view === 'list') {
      listView.render();
    } else if (view === 'home') {
      this.updateHomeStats();
      this.updateRecentList();
    }
  }

  // ─── Home Screen ───────────────────────────────────────

  updateHomeStats() {
    const stats = this.data.getStats();
    document.getElementById('stat-total').textContent = stats.total;
    document.getElementById('stat-codes').textContent = stats.withCodes;
    document.getElementById('stat-fav').textContent = stats.favorites;
  }

  updateRecentList() {
    const recent = this.data.getRecentAddresses();
    const section = document.getElementById('home-recent-section');
    const list = document.getElementById('home-recent-list');

    if (recent.length === 0) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';
    list.innerHTML = recent.slice(0, 5).map((addr) => `
      <button class="recent-item" onclick="app.data.addToRecent('${addr.id}'); listView.showDetail('${addr.id}')">
        <div class="recent-icon">${addr.isFavorite ? '⭐' : '🏠'}</div>
        <div class="recent-info">
          <div class="recent-street">${escapeHtml(addr.street)} ${escapeHtml(addr.houseNumber)}</div>
          <div class="recent-district">${escapeHtml(addr.district || addr.city)}</div>
        </div>
        <span class="address-chevron">›</span>
      </button>
    `).join('');
  }

  // ─── Toast Notifications ───────────────────────────────

  showToast(message, type = '') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast' + (type ? ` ${type}` : '');

    // Show
    requestAnimationFrame(() => {
      toast.classList.add('visible');
    });

    // Auto-hide
    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      toast.classList.remove('visible');
    }, 2500);
  }

  // ─── Export / Import ───────────────────────────────────

  exportData() {
    this.data.exportData();
    this.showToast('Dane wyeksportowane 📤', 'success');
  }

  importData(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = this.data.importData(e.target.result);
      if (result.success) {
        this.showToast(`Zaimportowano ${result.count} adresów 📥`, 'success');
        this.updateHomeStats();
        this.updateRecentList();
        listView.render();
        mapView.refreshMarkers();
      } else {
        this.showToast(`Błąd importu: ${result.error}`, 'error');
      }
    };
    reader.readAsText(file);
    input.value = '';
  }

  // ─── Service Worker & Updates ──────────────────────────
  
  registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('sw.js')
        .then((reg) => {
          console.log('Service Worker registered');
          this.swRegistration = reg;
          
          // Listen for new worker waiting
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New update available, we'll handle it via manual check or automatic reload
                console.log('New update installed and waiting');
              }
            });
          });
        })
        .catch((err) => console.warn('SW registration failed:', err));

      // Handle reload when new SW takes control
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });
    }
  }

  async checkUpdate() {
    if (!this.swRegistration) {
      this.showToast('Aktualizacja niemożliwa (brak SW)', 'error');
      return;
    }

    const statusEl = document.getElementById('update-status');
    const updateBtn = document.getElementById('btn-update');

    updateBtn.disabled = true;
    this.showUpdateStatus('<span class="spin">🔄</span> Sprawdzanie...');

    try {
      // Trigger update check
      await this.swRegistration.update();
      
      // Wait a bit to see if updatefound was triggered
      setTimeout(() => {
        if (this.swRegistration.installing || this.swRegistration.waiting) {
          this.showUpdateStatus('⚙️ Pobieranie aktualizacji...');
          
          // If already waiting, skip
          const worker = this.swRegistration.waiting || this.swRegistration.installing;
          if (worker.state === 'installed') {
            this.applyUpdate(worker);
          } else {
            worker.addEventListener('statechange', () => {
              if (worker.state === 'installed') {
                this.applyUpdate(worker);
              }
            });
          }
        } else {
          this.showUpdateStatus('✅ Wersja aktualna', 'success');
          updateBtn.disabled = false;
          setTimeout(() => statusEl.classList.remove('visible'), 3000);
        }
      }, 1500);

    } catch (e) {
      console.error('Update check failed:', e);
      this.showUpdateStatus('❌ Błąd sprawdzania', 'error');
      updateBtn.disabled = false;
    }
  }

  applyUpdate(worker) {
    this.showUpdateStatus('✨ Instalowanie... Zapraszam ponownie!');
    setTimeout(() => {
      worker.postMessage({ type: 'SKIP_WAITING' });
    }, 1000);
  }

  showUpdateStatus(html, type = '') {
    const el = document.getElementById('update-status');
    el.innerHTML = html;
    el.className = 'update-status visible' + (type ? ` ${type}` : '');
  }
}

// ─── Utility ──────────────────────────────────────────

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ─── Init App ─────────────────────────────────────────

const app = new App();
