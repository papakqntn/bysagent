/**
 * BYSEK AI Assistant
 * Voice-controlled address search and navigation
 */
class BysekAssistant {
  constructor() {
    this.recognition = null;
    this.isListening = false;
    this.isSupported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
    this.setupRecognition();
  }

  setupRecognition() {
    if (!this.isSupported) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    this.recognition.lang = 'pl-PL';
    this.recognition.interimResults = false;
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => {
      this.isListening = true;
      this.updateUI('listening');
    };

    this.recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      console.log('BYSEK heard:', transcript);
      this.processVoiceCommand(transcript);
    };

    this.recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      this.isListening = false;
      this.updateUI('error', event.error);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      if (!this.processingResult) {
        this.updateUI('idle');
      }
    };
  }

  toggleAssistant() {
    const modal = document.getElementById('bysek-modal');
    const isVisible = modal.classList.contains('visible');

    if (isVisible) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    const modal = document.getElementById('bysek-modal');
    modal.classList.add('visible');
    
    // Check if in PWA mode on iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

    if (isIOS && isStandalone) {
      this.updateUI('ios-warning');
    } else if (!this.isSupported) {
      this.updateUI('not-supported');
    } else {
      this.updateUI('idle');
      this.speak('Cześć! Podaj adres, którego szukasz.');
    }
  }

  close() {
    const modal = document.getElementById('bysek-modal');
    modal.classList.remove('visible');
    if (this.recognition) this.recognition.stop();
    this.isListening = false;
  }

  startListening() {
    if (!this.isSupported || this.isListening) return;
    this.recognition.start();
  }

  processVoiceCommand(text) {
    this.processingResult = true;
    this.updateUI('processing', text);

    // Clean text: remove "ulica", "ul", "numer", etc.
    let cleanText = text.toLowerCase()
      .replace(/ulica|ul\.|ul /g, '')
      .replace(/numer|nr /g, '')
      .replace(/dom /g, '')
      .trim();

    console.log('Cleaned query:', cleanText);

    // Search in database
    const results = app.data.search(cleanText);

    setTimeout(() => {
      if (results.length > 0) {
        const bestMatch = results[0];
        this.speak(`Znalazłem adres: ${bestMatch.street} ${bestMatch.houseNumber}. Otwieram.`);
        this.updateUI('success', `${bestMatch.street} ${bestMatch.houseNumber}`);
        
        setTimeout(() => {
          this.close();
          listView.showDetail(bestMatch.id);
          app.data.addToRecent(bestMatch.id);
        }, 1500);
      } else {
        this.speak('Niestety nie znalazłem takiego adresu. Spróbuj powtórzyć.');
        this.updateUI('not-found', text);
        this.processingResult = false;
      }
    }, 1000);
  }

  speak(text) {
    if (!window.speechSynthesis) return;
    // Cancel any current speech
    window.speechSynthesis.cancel();
    
    const ut = new SpeechSynthesisUtterance(text);
    ut.lang = 'pl-PL';
    ut.rate = 1.1;
    window.speechSynthesis.speak(ut);
  }

  updateUI(state, extra = '') {
    const statusText = document.getElementById('bysek-status');
    const micBtn = document.getElementById('bysek-mic-btn');
    const resultText = document.getElementById('bysek-result');

    // Reset classes
    micBtn.className = 'bysek-mic-btn';
    
    switch (state) {
      case 'idle':
        statusText.textContent = 'Naciśnij mikrofon и powiedz adres';
        resultText.textContent = '';
        break;
      case 'listening':
        statusText.textContent = 'Słucham...';
        micBtn.classList.add('active');
        break;
      case 'processing':
        statusText.textContent = 'Przetwarzam...';
        resultText.textContent = `"${extra}"`;
        break;
      case 'success':
        statusText.textContent = 'Znalazłem!';
        resultText.innerHTML = `<span style="color:var(--success)">${extra}</span>`;
        break;
      case 'not-found':
        statusText.textContent = 'Nie znalazłem adresu';
        resultText.innerHTML = `<span style="color:var(--danger)">"${extra}"</span>`;
        break;
      case 'ios-warning':
        statusText.innerHTML = '<span style="color:var(--warning)">Błąd системы:</span>';
        resultText.innerHTML = '<div style="font-size:0.85rem;line-height:1.4">Apple blokuje mikrofon w trybie "Ekranu Głównego".<br><br>Otwórz aplikację <b>w Safari</b> lub użyj dyktowania na klawiaturze в polu wyszukiwania.</div>';
        micBtn.style.display = 'none';
        break;
      case 'not-supported':
        statusText.textContent = 'Głos nie jest wspierany';
        resultText.textContent = 'Twoja przeglądarka nie obsługuje rozpoznawania głosu.';
        micBtn.style.display = 'none';
        break;
      case 'error':
        statusText.textContent = 'Błąd mikrofonu';
        resultText.textContent = 'Upewnij się, że masz włączony internet i Siri.';
        break;
    }
  }
}

// Init assistant
const bysek = new BysekAssistant();
