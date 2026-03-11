document.addEventListener('DOMContentLoaded', () => {
  const globalToggle = document.getElementById('globalToggle');
  const modeAuto = document.getElementById('modeAuto');
  const modeHover = document.getElementById('modeHover');
  const geminiApiKey = document.getElementById('geminiApiKey');
  const toggleKeyVisibility = document.getElementById('toggleKeyVisibility');
  const apiKeyStatus = document.getElementById('apiKeyStatus');

  // Загрузка сохраненных настроек
  chrome.storage.sync.get(['enabled', 'mode', 'geminiApiKey'], (items) => {
    // по умолчанию: true, auto
    globalToggle.checked = items.enabled !== false;
    
    if (items.mode === 'hover') {
      modeHover.checked = true;
    } else {
      modeAuto.checked = true;
    }

    if (items.geminiApiKey) {
      geminiApiKey.value = items.geminiApiKey;
      apiKeyStatus.textContent = '✅ Ключ сохранен';
      apiKeyStatus.className = 'api-key-status saved';
    }
  });

  // Сохранение при изменении
  globalToggle.addEventListener('change', () => {
    chrome.storage.sync.set({ enabled: globalToggle.checked });
  });

  modeAuto.addEventListener('change', () => {
    if (modeAuto.checked) {
       chrome.storage.sync.set({ mode: 'auto' });
    }
  });

  modeHover.addEventListener('change', () => {
    if (modeHover.checked) {
      chrome.storage.sync.set({ mode: 'hover' });
    }
  });

  // API Ключ Gemini — сохранение при потере фокуса или Enter
  function saveApiKey() {
    const key = geminiApiKey.value.trim();
    if (key) {
      chrome.storage.sync.set({ geminiApiKey: key });
      apiKeyStatus.textContent = '✅ Ключ сохранен';
      apiKeyStatus.className = 'api-key-status saved';
    } else {
      chrome.storage.sync.remove('geminiApiKey');
      apiKeyStatus.textContent = '';
      apiKeyStatus.className = 'api-key-status';
    }
  }

  geminiApiKey.addEventListener('blur', saveApiKey);
  geminiApiKey.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveApiKey();
      geminiApiKey.blur();
    }
  });

  // Переключение видимости ключа
  toggleKeyVisibility.addEventListener('click', () => {
    if (geminiApiKey.type === 'password') {
      geminiApiKey.type = 'text';
      toggleKeyVisibility.textContent = '🙈';
    } else {
      geminiApiKey.type = 'password';
      toggleKeyVisibility.textContent = '👁';
    }
  });
});
