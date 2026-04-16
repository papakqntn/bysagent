/**
 * BYŚ Agent — Map View
 * 3D map with buildings using MapLibre GL JS + OpenFreeMap
 */
class MapView {
  constructor() {
    this.map = null;
    this.markers = [];
    this.is3D = true;
    this.initialized = false;
    this.currentPopupId = null;

    // Center of Praga-Północ / Praga-Południe, Warsaw
    this.defaultCenter = [21.045, 52.248];
    this.defaultZoom = 14;
    this.defaultPitch = 55;
    this.defaultBearing = -15;
  }

  // ─── Initialize Map ────────────────────────────────────

  init() {
    if (this.initialized) {
      this.refreshMarkers();
      return;
    }

    const loading = document.getElementById('map-loading');

    try {
      this.map = new maplibregl.Map({
        container: 'map-container',
        style: 'https://tiles.openfreemap.org/styles/liberty',
        center: this.defaultCenter,
        zoom: this.defaultZoom,
        pitch: this.defaultPitch,
        bearing: this.defaultBearing,
        antialias: true,
        maxZoom: 19,
        minZoom: 10
      });

      // Add navigation controls
      this.map.addControl(
        new maplibregl.NavigationControl({ visualizePitch: true }),
        'bottom-right'
      );

      this.map.on('load', () => {
        this.add3DBuildings();
        this.addAddressMarkers();
        this.setupMapSearch();

        // Hide loading
        setTimeout(() => {
          loading.classList.add('hidden');
        }, 500);

        this.initialized = true;
      });

      this.map.on('error', (e) => {
        console.warn('Map error:', e);
        loading.innerHTML = `
          <div style="text-align:center;padding:20px;">
            <div style="font-size:2rem;margin-bottom:12px;">🗺️</div>
            <div style="color:#5A6577;font-size:0.9rem;">Nie udało się załadować mapy.<br>Sprawdź połączenie z internetem.</div>
          </div>
        `;
      });
    } catch (e) {
      console.error('Map init error:', e);
      loading.innerHTML = `
        <div style="text-align:center;padding:20px;">
          <div style="font-size:2rem;margin-bottom:12px;">🗺️</div>
          <div style="color:#5A6577;font-size:0.9rem;">Nie udało się załadować mapy.</div>
        </div>
      `;
    }
  }

  // ─── 3D Buildings ──────────────────────────────────────

  add3DBuildings() {
    const layers = this.map.getStyle().layers;

    // Find the first symbol layer to insert 3D buildings before it
    let labelLayerId;
    for (const layer of layers) {
      if (layer.type === 'symbol' && layer.layout && layer.layout['text-field']) {
        labelLayerId = layer.id;
        break;
      }
    }

    // Check available sources
    const sources = this.map.getStyle().sources;
    let sourceId = null;
    let sourceLayer = 'building';

    for (const [id, source] of Object.entries(sources)) {
      if (source.type === 'vector') {
        sourceId = id;
        break;
      }
    }

    if (!sourceId) {
      console.warn('No vector source found for 3D buildings');
      return;
    }

    // Remove existing building layers that might interfere
    for (const layer of layers) {
      if (layer.id && layer.id.toLowerCase().includes('building') && layer.type === 'fill') {
        try {
          this.map.setLayoutProperty(layer.id, 'visibility', 'none');
        } catch (e) { /* ignore */ }
      }
    }

    // Add 3D building extrusion layer
    try {
      this.map.addLayer(
        {
          id: 'bys-3d-buildings',
          source: sourceId,
          'source-layer': sourceLayer,
          type: 'fill-extrusion',
          minzoom: 14,
          paint: {
            'fill-extrusion-color': [
              'interpolate',
              ['linear'],
              ['coalesce', ['get', 'render_height'], ['get', 'height'], 10],
              0, '#e8edf2',
              15, '#d4dce6',
              30, '#c0cad8',
              60, '#adb9cc'
            ],
            'fill-extrusion-height': [
              'coalesce',
              ['get', 'render_height'],
              ['get', 'height'],
              10
            ],
            'fill-extrusion-base': [
              'coalesce',
              ['get', 'render_min_height'],
              0
            ],
            'fill-extrusion-opacity': 0.75
          }
        },
        labelLayerId
      );
    } catch (e) {
      console.warn('Could not add 3D buildings:', e);
    }
  }

  // ─── Address Markers ───────────────────────────────────

  addAddressMarkers() {
    this.clearMarkers();

    const addresses = app.data.getAll();
    addresses.forEach((addr) => {
      if (addr.lat && addr.lng) {
        this.addMarker(addr);
      }
    });
  }

  addMarker(addr) {
    // Create custom marker element
    const el = document.createElement('div');
    el.className = 'map-marker' + (addr.isFavorite ? ' favorite' : '');
    el.title = `${addr.street} ${addr.houseNumber}`;

    const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
      .setLngLat([addr.lng, addr.lat])
      .addTo(this.map);

    el.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showPopup(addr);
    });

    this.markers.push({ marker, id: addr.id });
  }

  clearMarkers() {
    this.markers.forEach(({ marker }) => marker.remove());
    this.markers = [];
  }

  refreshMarkers() {
    if (!this.initialized) return;
    this.addAddressMarkers();
  }

  // ─── Popup ─────────────────────────────────────────────

  showPopup(addr) {
    this.currentPopupId = addr.id;

    document.getElementById('popup-address').textContent =
      `${addr.street} ${addr.houseNumber}`;
    document.getElementById('popup-district').textContent =
      `${addr.district || addr.city}`;

    // Build info chips
    const infoEl = document.getElementById('popup-info');
    infoEl.innerHTML = '';

    if (addr.gateCode) {
      const chip = document.createElement('button');
      chip.className = 'map-popup-chip';
      chip.textContent = `🔑 ${addr.gateCode}`;
      chip.onclick = () => {
        navigator.clipboard.writeText(addr.gateCode).then(() => {
          app.showToast('Kod skopiowany!', 'success');
        });
      };
      infoEl.appendChild(chip);
    }

    if (addr.intercomCode) {
      const chip = document.createElement('button');
      chip.className = 'map-popup-chip';
      chip.textContent = `🔔 ${addr.intercomCode}`;
      chip.onclick = () => {
        navigator.clipboard.writeText(addr.intercomCode).then(() => {
          app.showToast('Kod skopiowany!', 'success');
        });
      };
      infoEl.appendChild(chip);
    }

    if (addr.phoneAdmin) {
      const chip = document.createElement('a');
      chip.className = 'map-popup-chip';
      chip.href = `tel:${addr.phoneAdmin.replace(/\s/g, '')}`;
      chip.textContent = `📞 Zadzwoń`;
      infoEl.appendChild(chip);
    }

    // Detail button
    const detailBtn = document.getElementById('popup-detail-btn');
    detailBtn.onclick = () => {
      this.closePopup();
      app.data.addToRecent(addr.id);
      listView.showDetail(addr.id);
    };

    document.getElementById('map-popup').classList.add('visible');

    // Fly to marker
    this.map.flyTo({
      center: [addr.lng, addr.lat],
      zoom: 17,
      pitch: this.is3D ? 55 : 0,
      duration: 800
    });
  }

  closePopup() {
    document.getElementById('map-popup').classList.remove('visible');
    this.currentPopupId = null;
  }

  // ─── Map Search ────────────────────────────────────────

  setupMapSearch() {
    const input = document.getElementById('map-search-input');
    let debounce;

    input.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        const q = input.value.trim();
        if (!q) {
          this.addAddressMarkers();
          return;
        }
        const results = app.data.search(q);
        this.clearMarkers();
        results.forEach((addr) => {
          if (addr.lat && addr.lng) {
            this.addMarker(addr);
          }
        });

        // Fly to first result
        if (results.length > 0 && results[0].lat && results[0].lng) {
          this.map.flyTo({
            center: [results[0].lng, results[0].lat],
            zoom: 16,
            duration: 600
          });
        }
      }, 300);
    });
  }

  // ─── Controls ──────────────────────────────────────────

  geolocate() {
    if (!navigator.geolocation) {
      app.showToast('Geolokalizacja niedostępna', 'error');
      return;
    }

    app.showToast('Szukanie lokalizacji...', '');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.map.flyTo({
          center: [pos.coords.longitude, pos.coords.latitude],
          zoom: 16,
          pitch: this.is3D ? 55 : 0,
          duration: 1000
        });
        app.showToast('Lokalizacja znaleziona!', 'success');
      },
      (err) => {
        app.showToast('Nie udało się uzyskać lokalizacji', 'error');
        console.warn('Geolocation error:', err);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  resetView() {
    if (!this.map) return;
    this.closePopup();
    this.map.flyTo({
      center: this.defaultCenter,
      zoom: this.defaultZoom,
      pitch: this.is3D ? this.defaultPitch : 0,
      bearing: this.defaultBearing,
      duration: 1000
    });
  }

  toggle3D() {
    this.is3D = !this.is3D;
    this.map.easeTo({
      pitch: this.is3D ? 55 : 0,
      bearing: this.is3D ? -15 : 0,
      duration: 600
    });

    // Toggle 3D buildings visibility
    try {
      if (this.map.getLayer('bys-3d-buildings')) {
        this.map.setLayoutProperty(
          'bys-3d-buildings',
          'visibility',
          this.is3D ? 'visible' : 'none'
        );
      }
    } catch (e) { /* ignore */ }

    app.showToast(this.is3D ? 'Widok 3D włączony' : 'Widok 2D włączony', '');
  }

  // ─── Fly to specific address ───────────────────────────

  flyToAddress(addr) {
    if (!addr.lat || !addr.lng) {
      app.showToast('Brak współrzędnych dla tego adresu', 'error');
      return;
    }

    app.navigateTo('map');

    // Wait for map to be ready
    const fly = () => {
      this.map.flyTo({
        center: [addr.lng, addr.lat],
        zoom: 17,
        pitch: this.is3D ? 55 : 0,
        duration: 1000
      });
      setTimeout(() => this.showPopup(addr), 1200);
    };

    if (this.initialized) {
      setTimeout(fly, 300);
    } else {
      this.map.on('load', () => setTimeout(fly, 500));
    }
  }

  // ─── Resize ────────────────────────────────────────────

  resize() {
    if (this.map) {
      setTimeout(() => this.map.resize(), 100);
    }
  }
}

// Global instance
const mapView = new MapView();
