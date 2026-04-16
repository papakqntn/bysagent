/**
 * BYŚ Agent — Data Manager
 * Manages address data via localStorage.
 */
class DataManager {
  constructor() {
    this.storageKey = 'bys_addresses';
    this.recentKey = 'bys_recent';
    this.settingsKey = 'bys_settings';
    this.initDefaultData();
  }

  // ─── CRUD ───────────────────────────────────────────────

  getAll() {
    try {
      const data = JSON.parse(localStorage.getItem(this.storageKey)) || [];
      console.log(`BYŚ Database: loaded ${data.length} records. Data is safe ✓`);
      return data;
    } catch {
      return [];
    }
  }

  getById(id) {
    return this.getAll().find((a) => a.id === id) || null;
  }

  add(address) {
    const all = this.getAll();
    const newAddr = {
      id: this.generateId(),
      street: address.street || '',
      houseNumber: address.houseNumber || '',
      city: address.city || 'Warszawa',
      district: address.district || '',
      gateCode: address.gateCode || '',
      intercomCode: address.intercomCode || '',
      phoneAdmin: address.phoneAdmin || '',
      contactPerson: address.contactPerson || '',
      notes: address.notes || '',
      lat: address.lat || null,
      lng: address.lng || null,
      isFavorite: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    all.push(newAddr);
    this.save(all);
    return newAddr;
  }

  update(id, data) {
    const all = this.getAll();
    const index = all.findIndex((a) => a.id === id);
    if (index === -1) return null;

    all[index] = {
      ...all[index],
      ...data,
      id: all[index].id,
      createdAt: all[index].createdAt,
      updatedAt: new Date().toISOString()
    };
    this.save(all);
    return all[index];
  }

  delete(id) {
    const all = this.getAll().filter((a) => a.id !== id);
    this.save(all);
    this.removeFromRecent(id);
  }

  // ─── Search ─────────────────────────────────────────────

  search(query) {
    if (!query || !query.trim()) return this.getAll();
    const q = query.toLowerCase().trim();
    return this.getAll().filter((a) => {
      const searchable = [
        a.street,
        a.houseNumber,
        a.city,
        a.district,
        a.gateCode,
        a.contactPerson,
        a.notes
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return searchable.includes(q);
    });
  }

  // ─── Favorites ──────────────────────────────────────────

  toggleFavorite(id) {
    const addr = this.getById(id);
    if (!addr) return null;
    return this.update(id, { isFavorite: !addr.isFavorite });
  }

  getFavorites() {
    return this.getAll().filter((a) => a.isFavorite);
  }

  // ─── Recent ─────────────────────────────────────────────

  addToRecent(id) {
    let recent = this.getRecent();
    recent = recent.filter((r) => r !== id);
    recent.unshift(id);
    recent = recent.slice(0, 10); // Keep last 10
    localStorage.setItem(this.recentKey, JSON.stringify(recent));
  }

  removeFromRecent(id) {
    let recent = this.getRecent();
    recent = recent.filter((r) => r !== id);
    localStorage.setItem(this.recentKey, JSON.stringify(recent));
  }

  getRecent() {
    try {
      return JSON.parse(localStorage.getItem(this.recentKey)) || [];
    } catch {
      return [];
    }
  }

  getRecentAddresses() {
    const recentIds = this.getRecent();
    const all = this.getAll();
    return recentIds.map((id) => all.find((a) => a.id === id)).filter(Boolean);
  }

  // ─── Export / Import ────────────────────────────────────

  exportData() {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      addresses: this.getAll()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bys-agent-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  importData(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (!data.addresses || !Array.isArray(data.addresses)) {
        throw new Error('Nieprawidłowy format pliku');
      }
      const current = this.getAll();
      const existingIds = new Set(current.map((a) => a.id));
      let importedCount = 0;

      data.addresses.forEach((addr) => {
        if (!existingIds.has(addr.id)) {
          current.push(addr);
          importedCount++;
        }
      });

      this.save(current);
      return { success: true, count: importedCount };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // ─── Utilities ──────────────────────────────────────────

  save(data) {
    localStorage.setItem(this.storageKey, JSON.stringify(data));
  }

  generateId() {
    return 'addr_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  getStats() {
    const all = this.getAll();
    return {
      total: all.length,
      favorites: all.filter((a) => a.isFavorite).length,
      withCodes: all.filter((a) => a.gateCode || a.intercomCode).length,
      withPhones: all.filter((a) => a.phoneAdmin).length
    };
  }

  // ─── Default demo data ─────────────────────────────────

  initDefaultData() {
    if (this.getAll().length > 0) return;

    const demoAddresses = [
      {
        street: 'ul. Targowa',
        houseNumber: '15',
        city: 'Warszawa',
        district: 'Praga-Północ',
        gateCode: '1234#',
        intercomCode: '15*9',
        phoneAdmin: '+48 22 618 34 21',
        contactPerson: 'Pan Nowak (dozorca)',
        notes: 'Kontener na podwórku, wejście przez bramę od ul. Targowej. Dozorca zwykle jest do 16:00.',
        lat: 52.2554,
        lng: 21.0377,
        isFavorite: true
      },
      {
        street: 'ul. Ząbkowska',
        houseNumber: '8',
        city: 'Warszawa',
        district: 'Praga-Północ',
        gateCode: '4567*',
        intercomCode: '',
        phoneAdmin: '+48 22 619 55 10',
        contactPerson: 'Administracja budynku',
        notes: 'Dwa kontenery w podwórzu. Brama otwierana kodem. Trzeba zadzwonić jeśli brama nie działa.',
        lat: 52.2536,
        lng: 21.0406,
        isFavorite: false
      },
      {
        street: 'ul. Stalowa',
        houseNumber: '20',
        city: 'Warszawa',
        district: 'Praga-Północ',
        gateCode: '0000#',
        intercomCode: '20*1',
        phoneAdmin: '+48 508 123 456',
        contactPerson: 'Pani Kowalska',
        notes: 'Klucz u dozorczyni na parterze. Kontener za budynkiem.',
        lat: 52.2568,
        lng: 21.0385,
        isFavorite: false
      },
      {
        street: 'ul. Brzeska',
        houseNumber: '7',
        city: 'Warszawa',
        district: 'Praga-Północ',
        gateCode: '7890#',
        intercomCode: '',
        phoneAdmin: '+48 22 620 11 22',
        contactPerson: 'Pan Wiśniewski (administrator)',
        notes: 'Wejście od ulicy Brzeskiej, brama po prawej stronie. Kontener na końcu podwórka.',
        lat: 52.2525,
        lng: 21.0370,
        isFavorite: true
      },
      {
        street: 'ul. Grochowska',
        houseNumber: '45',
        city: 'Warszawa',
        district: 'Praga-Południe',
        gateCode: '2580#',
        intercomCode: '45*0',
        phoneAdmin: '+48 22 810 44 55',
        contactPerson: 'Spółdzielnia Mieszkaniowa',
        notes: 'Duży blok, kontener w śmietniku po lewej stronie budynku. Klucz do śmietnika na kod.',
        lat: 52.2430,
        lng: 21.0550,
        isFavorite: false
      },
      {
        street: 'ul. Waszyngtona',
        houseNumber: '12',
        city: 'Warszawa',
        district: 'Praga-Południe',
        gateCode: '3691#',
        intercomCode: '12*5',
        phoneAdmin: '+48 601 234 567',
        contactPerson: 'Pan Zieliński (portier)',
        notes: 'Portier wpuszcza od 7:00 do 20:00. Po 20:00 dzwonić na numer.',
        lat: 52.2357,
        lng: 21.0515,
        isFavorite: false
      },
      {
        street: 'ul. Międzynarodowa',
        houseNumber: '38',
        city: 'Warszawa',
        district: 'Praga-Południe',
        gateCode: '1470*',
        intercomCode: '',
        phoneAdmin: '+48 22 811 22 33',
        contactPerson: 'Administracja osiedla',
        notes: 'Nowe osiedle. Szlaban na pilota — trzeba dzwonić do administracji żeby otworzyła.',
        lat: 52.2320,
        lng: 21.0630,
        isFavorite: false
      },
      {
        street: 'ul. Grenadierów',
        houseNumber: '15',
        city: 'Warszawa',
        district: 'Praga-Południe',
        gateCode: '8520#',
        intercomCode: '15*3',
        phoneAdmin: '+48 512 345 678',
        contactPerson: 'Pani Maj (dozorczyni)',
        notes: 'Kontener w piwnicy — zjazd od strony parkingu. Dozorczyni ma klucze.',
        lat: 52.2412,
        lng: 21.0510,
        isFavorite: true
      }
    ];

    const addresses = demoAddresses.map((addr) => ({
      ...addr,
      id: this.generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));

    this.save(addresses);
  }
}
