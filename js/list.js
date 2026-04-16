/**
 * BYŚ Agent — List View
 * Address list with search, filters, detail view, and CRUD operations
 */
class ListView {
  constructor() {
    this.currentFilter = 'all';
    this.currentSort = 'street'; // 'street' or 'district'
    this.currentDetailId = null;
  }

  // ─── Render List ───────────────────────────────────────

  render(addresses) {
    const list = document.getElementById('address-list');
    const data = addresses || this.getFilteredAddresses();

    if (data.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📭</div>
          <div class="empty-state-title">Brak adresów</div>
          <div class="empty-state-desc">
            ${this.currentFilter === 'all'
              ? 'Dodaj pierwszy adres klikając przycisk + poniżej'
              : 'Brak adresów pasujących do filtra'}
          </div>
        </div>
      `;
      return;
    }

    // Sort
    const sorted = [...data].sort((a, b) => {
      if (this.currentSort === 'district') {
        return (a.district || '').localeCompare(b.district || '') ||
               a.street.localeCompare(b.street);
      }
      return a.street.localeCompare(b.street) ||
             (a.houseNumber || '').localeCompare(b.houseNumber || '', undefined, { numeric: true });
    });

    list.innerHTML = sorted.map((addr) => `
      <button class="address-card ${addr.isFavorite ? 'favorite' : ''}"
              id="addr-card-${addr.id}"
              onclick="listView.showDetail('${addr.id}')">
        <div class="address-icon">${addr.isFavorite ? '⭐' : '🏠'}</div>
        <div class="address-info">
          <div class="address-street">${this.escapeHtml(addr.street)} ${this.escapeHtml(addr.houseNumber)}</div>
          <div class="address-meta">
            <span class="address-district">${this.escapeHtml(addr.district || addr.city)}</span>
            ${addr.gateCode ? '<span class="address-badge">🔑 Kod</span>' : ''}
          </div>
        </div>
        <span class="address-chevron">›</span>
      </button>
    `).join('');
  }

  getFilteredAddresses() {
    const query = document.getElementById('list-search-input')?.value || '';
    let data;

    if (query.trim()) {
      data = app.data.search(query);
    } else {
      data = app.data.getAll();
    }

    switch (this.currentFilter) {
      case 'favorites':
        return data.filter((a) => a.isFavorite);
      case 'praga-polnoc':
        return data.filter((a) =>
          (a.district || '').toLowerCase().includes('północ') ||
          (a.district || '').toLowerCase().includes('polnoc')
        );
      case 'praga-poludnie':
        return data.filter((a) =>
          (a.district || '').toLowerCase().includes('południe') ||
          (a.district || '').toLowerCase().includes('poludnie')
        );
      default:
        return data;
    }
  }

  // ─── Search ────────────────────────────────────────────

  setupSearch() {
    const input = document.getElementById('list-search-input');
    let debounce;

    input.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        this.render();
      }, 200);
    });
  }

  // ─── Filters ───────────────────────────────────────────

  setFilter(filter, btn) {
    this.currentFilter = filter;

    // Update active tab
    document.querySelectorAll('.filter-tab').forEach((tab) => {
      tab.classList.remove('active');
    });
    btn.classList.add('active');

    this.render();
  }

  toggleSort() {
    this.currentSort = this.currentSort === 'street' ? 'district' : 'street';
    app.showToast(
      this.currentSort === 'street' ? 'Sortowanie: ulica' : 'Sortowanie: dzielnica',
      ''
    );
    this.render();
  }

  // ─── Detail View ───────────────────────────────────────

  showDetail(id) {
    const addr = app.data.getById(id);
    if (!addr) return;

    this.currentDetailId = id;
    app.data.addToRecent(id);

    // Title
    document.getElementById('detail-title').textContent =
      `${addr.street} ${addr.houseNumber}`;
    document.getElementById('detail-district').textContent =
      `${addr.district || addr.city}`;

    // Build detail body
    const body = document.getElementById('detail-body');
    let html = '';

    // Gate code
    if (addr.gateCode) {
      html += `
        <div class="detail-card" onclick="listView.copyToClipboard('${this.escapeHtml(addr.gateCode)}')">
          <div class="detail-card-icon code">🔑</div>
          <div class="detail-card-content">
            <div class="detail-card-label">Kod bramy / furtki</div>
            <div class="detail-card-value">${this.escapeHtml(addr.gateCode)}</div>
          </div>
          <div class="detail-card-action" title="Kopiuj">📋</div>
        </div>
      `;
    }

    // Intercom code
    if (addr.intercomCode) {
      html += `
        <div class="detail-card" onclick="listView.copyToClipboard('${this.escapeHtml(addr.intercomCode)}')">
          <div class="detail-card-icon code">🔔</div>
          <div class="detail-card-content">
            <div class="detail-card-label">Kod domofonu</div>
            <div class="detail-card-value">${this.escapeHtml(addr.intercomCode)}</div>
          </div>
          <div class="detail-card-action" title="Kopiuj">📋</div>
        </div>
      `;
    }

    // Phone
    if (addr.phoneAdmin) {
      html += `
        <a href="tel:${addr.phoneAdmin.replace(/\s/g, '')}" class="detail-card">
          <div class="detail-card-icon phone">📞</div>
          <div class="detail-card-content">
            <div class="detail-card-label">Telefon</div>
            <div class="detail-card-value">${this.escapeHtml(addr.phoneAdmin)}</div>
          </div>
          <div class="detail-card-action" title="Zadzwoń">📱</div>
        </a>
      `;
    }

    // Contact person
    if (addr.contactPerson) {
      html += `
        <div class="detail-card">
          <div class="detail-card-icon person">👤</div>
          <div class="detail-card-content">
            <div class="detail-card-label">Osoba kontaktowa</div>
            <div class="detail-card-value">${this.escapeHtml(addr.contactPerson)}</div>
          </div>
        </div>
      `;
    }

    // Notes
    if (addr.notes) {
      html += `
        <div class="detail-notes">
          <div class="detail-notes-label">📝 Notatki</div>
          <div class="detail-notes-text">${this.escapeHtml(addr.notes)}</div>
        </div>
      `;
    }

    // No info placeholder
    if (!addr.gateCode && !addr.intercomCode && !addr.phoneAdmin && !addr.contactPerson && !addr.notes) {
      html += `
        <div class="empty-state" style="padding: 30px 0;">
          <div class="empty-state-icon">📝</div>
          <div class="empty-state-title">Brak informacji</div>
          <div class="empty-state-desc">Kliknij "Edytuj" aby dodać dane</div>
        </div>
      `;
    }

    // Action buttons
    html += `
      <div class="detail-actions">
        <button class="detail-action-btn secondary" onclick="listView.closeDetail(); listView.showEditModal('${addr.id}')">
          ✏️ Edytuj
        </button>
        ${addr.lat && addr.lng ? `
          <button class="detail-action-btn primary" onclick="listView.closeDetail(); mapView.flyToAddress(app.data.getById('${addr.id}'))">
            🗺️ Mapa
          </button>
        ` : ''}
        <button class="detail-action-btn danger" onclick="listView.confirmDelete('${addr.id}')">
          🗑️
        </button>
      </div>
      <div style="text-align:center; margin-top: 16px;">
        <button style="background:none; border:none; cursor:pointer; font-size:1.5rem; padding: 8px;"
                onclick="listView.toggleFavorite('${addr.id}')"
                title="${addr.isFavorite ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}">
          ${addr.isFavorite ? '⭐' : '☆'}
        </button>
        <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 4px;">
          ${addr.isFavorite ? 'W ulubionych' : 'Dodaj do ulubionych'}
        </div>
      </div>
    `;

    body.innerHTML = html;

    // Show modal
    document.getElementById('detail-modal').classList.add('visible');
  }

  closeDetail() {
    document.getElementById('detail-modal').classList.remove('visible');
    this.currentDetailId = null;
  }

  // ─── Edit Modal ────────────────────────────────────────

  showAddModal() {
    document.getElementById('edit-modal-title').textContent = 'Nowy adres';
    document.getElementById('edit-form').reset();
    document.getElementById('edit-id').value = '';
    document.getElementById('edit-city').value = 'Warszawa';
    document.getElementById('edit-modal').classList.add('visible');
  }

  showEditModal(id) {
    const addr = app.data.getById(id);
    if (!addr) return;

    document.getElementById('edit-modal-title').textContent = 'Edytuj adres';
    document.getElementById('edit-id').value = addr.id;
    document.getElementById('edit-street').value = addr.street || '';
    document.getElementById('edit-house').value = addr.houseNumber || '';
    document.getElementById('edit-city').value = addr.city || 'Warszawa';
    document.getElementById('edit-district').value = addr.district || '';
    document.getElementById('edit-gate').value = addr.gateCode || '';
    document.getElementById('edit-intercom').value = addr.intercomCode || '';
    document.getElementById('edit-phone').value = addr.phoneAdmin || '';
    document.getElementById('edit-contact').value = addr.contactPerson || '';
    document.getElementById('edit-lat').value = addr.lat || '';
    document.getElementById('edit-lng').value = addr.lng || '';
    document.getElementById('edit-notes').value = addr.notes || '';

    document.getElementById('edit-modal').classList.add('visible');
  }

  closeEdit() {
    document.getElementById('edit-modal').classList.remove('visible');
  }

  saveForm(event) {
    event.preventDefault();

    const id = document.getElementById('edit-id').value;
    const formData = {
      street: document.getElementById('edit-street').value.trim(),
      houseNumber: document.getElementById('edit-house').value.trim(),
      city: document.getElementById('edit-city').value.trim() || 'Warszawa',
      district: document.getElementById('edit-district').value.trim(),
      gateCode: document.getElementById('edit-gate').value.trim(),
      intercomCode: document.getElementById('edit-intercom').value.trim(),
      phoneAdmin: document.getElementById('edit-phone').value.trim(),
      contactPerson: document.getElementById('edit-contact').value.trim(),
      lat: parseFloat(document.getElementById('edit-lat').value) || null,
      lng: parseFloat(document.getElementById('edit-lng').value) || null,
      notes: document.getElementById('edit-notes').value.trim()
    };

    if (id) {
      // Update
      app.data.update(id, formData);
      app.showToast('Adres zaktualizowany!', 'success');
    } else {
      // Create
      app.data.add(formData);
      app.showToast('Adres dodany!', 'success');
    }

    this.closeEdit();
    this.render();
    mapView.refreshMarkers();
    app.updateHomeStats();
  }

  // ─── Delete ────────────────────────────────────────────

  confirmDelete(id) {
    const addr = app.data.getById(id);
    if (!addr) return;

    const overlay = document.getElementById('confirm-dialog');
    document.getElementById('confirm-title').textContent = 'Usunąć adres?';
    document.getElementById('confirm-message').textContent =
      `${addr.street} ${addr.houseNumber} — tej operacji nie można cofnąć.`;

    overlay.classList.add('visible');

    document.getElementById('confirm-yes').onclick = () => {
      app.data.delete(id);
      overlay.classList.remove('visible');
      this.closeDetail();
      this.render();
      mapView.refreshMarkers();
      app.updateHomeStats();
      app.showToast('Adres usunięty', '');
    };

    document.getElementById('confirm-no').onclick = () => {
      overlay.classList.remove('visible');
    };
  }

  // ─── Favorites ─────────────────────────────────────────

  toggleFavorite(id) {
    app.data.toggleFavorite(id);
    this.render();
    mapView.refreshMarkers();
    app.updateHomeStats();

    // Refresh detail if open
    if (this.currentDetailId === id) {
      this.showDetail(id);
    }

    const addr = app.data.getById(id);
    app.showToast(
      addr.isFavorite ? 'Dodano do ulubionych ⭐' : 'Usunięto z ulubionych',
      'success'
    );
  }

  // ─── Clipboard ─────────────────────────────────────────

  copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        app.showToast(`Skopiowano: ${text}`, 'success');
      }).catch(() => {
        this.fallbackCopy(text);
      });
    } else {
      this.fallbackCopy(text);
    }
  }

  fallbackCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      app.showToast(`Skopiowano: ${text}`, 'success');
    } catch {
      app.showToast('Nie udało się skopiować', 'error');
    }
    document.body.removeChild(textarea);
  }

  // ─── Utilities ─────────────────────────────────────────

  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

// Global instance
const listView = new ListView();
