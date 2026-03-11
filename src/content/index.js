// Проверка валидности контекста расширения (предотвращает ошибку "Extension context invalidated")
function isExtensionValid() {
  try {
    return !!chrome.runtime?.id;
  } catch (e) {
    return false;
  }
}

// Кеш настроек
let globalSettings = { enabled: true, mode: 'auto' };

function loadSettings(callback) {
  if (!isExtensionValid()) { if (callback) callback(); return; }
  chrome.storage.sync.get(['enabled', 'mode'], (items) => {
    globalSettings.enabled = items.enabled !== false; // По умолчанию true
    globalSettings.mode = items.mode || 'auto'; // По умолчанию auto
    if (callback) callback();
  });
}

// Отслеживание обработанных медиа-элементов
const processedMedia = new WeakSet();

// ── Кнопка Глубокого Сканирования ──
let activeScanBtn = null;
let scanBtnTimeout = null;

function showScanButton(el) {
  hideScanButton(); // удалить существующую

  const rect = el.getBoundingClientRect();
  // Пропускать крошечные элементы
  if (rect.width < 200 || rect.height < 200) return;

  const btn = document.createElement('div');
  btn.className = 'mds-scan-btn';
  btn.innerHTML = '🔬';
  btn.title = 'Глубокий анализ ИИ (Gemini)';

  // Позиционирование в верхнем левом углу элемента
  // Не показывать кнопку, если верх изображения не видна в viewport
  if (rect.top < 0 || rect.top > window.innerHeight) return;
  if (rect.left < 0 || rect.left > window.innerWidth) return;

  btn.style.position = 'fixed';
  const btnSize = 30;
  const margin = 6;
  const top = rect.top + margin;
  const left = rect.left + margin;
  btn.style.top = `${top}px`;
  btn.style.left = `${left}px`;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    triggerDeepAnalysis(el, btn);
  });

  // Держать кнопку активной при наведении на нее
  btn.addEventListener('mouseenter', () => {
    if (scanBtnTimeout) { clearTimeout(scanBtnTimeout); scanBtnTimeout = null; }
  });
  btn.addEventListener('mouseleave', () => {
    scanBtnTimeout = setTimeout(hideScanButton, 300);
  });

  document.body.appendChild(btn);
  activeScanBtn = btn;
}

function hideScanButton() {
  if (activeScanBtn) {
    activeScanBtn.remove();
    activeScanBtn = null;
  }
  if (scanBtnTimeout) {
    clearTimeout(scanBtnTimeout);
    scanBtnTimeout = null;
  }
}

function triggerDeepAnalysis(el, btn) {
  // Получить URL
  let url = null;
  if (el.tagName === 'IMG') {
    url = el.src;
  } else if (el.tagName === 'VIDEO') {
    url = el.poster || el.src;
    const source = el.querySelector('source');
    if (!url && source) url = source.src;
  }

  if (!url || url.startsWith('data:') || url.startsWith('blob:')) {
    btn.innerHTML = '❌';
    btn.title = 'Невозможно проанализировать это медиа';
    return;
  }

  // Показать состояние загрузки — серая рамка
  el.style.outline = '3px solid rgba(150, 150, 150, 0.7)';
  el.style.outlineOffset = '-3px';
  el.classList.add('mds-loading-pulse');
  btn.innerHTML = '';
  btn.className = 'mds-scan-btn mds-scan-loading';
  btn.title = 'Анализ с помощью Gemini AI...';

  if (!isExtensionValid()) { btn.innerHTML = '❌'; btn.title = 'Расширение перезагружено — обновите страницу'; el.classList.remove('mds-loading-pulse'); el.style.outline = ''; return; }
  try { chrome.runtime.sendMessage({ action: 'deepAnalyze', url }, (response) => {
    if (chrome.runtime.lastError) {
      console.warn("MDS Deep: Service worker error", chrome.runtime.lastError);
      el.classList.remove('mds-loading-pulse');
      el.style.outline = '3px solid rgba(60, 120, 255, 0.8)';
      btn.innerHTML = '❌';
      btn.className = 'mds-scan-btn';
      btn.title = 'Ошибка: ' + chrome.runtime.lastError.message;
      return;
    }

    console.log('MDS Deep: Result', response);

    if (response?.status === 'ERROR') {
      el.classList.remove('mds-loading-pulse');
      el.style.outline = '3px solid rgba(60, 120, 255, 0.8)';
      btn.innerHTML = '⚠️';
      btn.className = 'mds-scan-btn';
      btn.title = 'Ошибка: ' + response.details;
      return;
    }

    if (response?.status === 'DEEP') {
      el.classList.remove('mds-loading-pulse');
      // Удалить кнопку сканирования
      hideScanButton();
      // Показать наложение с результатом
      injectDeepResult(el, response);
    }
  }); } catch(e) { console.warn('MDS: Extension context lost', e); }
}

function injectDeepResult(el, result) {
  // Удалить любой существующий результат для этого элемента
  const existingOverlay = el._mdsDeepOverlay;
  if (existingOverlay) existingOverlay.remove();

  const verdict = result.verdict || 'UNKNOWN';
  const confidence = result.confidence || 0;
  const explanation = result.explanation || '';

  // Определение стиля
  let emoji, colorClass;
  if (verdict === 'AI_GENERATED') {
    emoji = '🤖';
    colorClass = 'mds-deep-ai';
  } else if (verdict === 'EDITED') {
    emoji = '🖌️';
    colorClass = 'mds-deep-edit';
  } else if (verdict === 'AUTHENTIC') {
    emoji = '✅';
    colorClass = 'mds-deep-clean';
  } else {
    emoji = '❓';
    colorClass = 'mds-deep-unknown';
  }

  // Создание значка
  const badge = document.createElement('div');
  badge.className = `mds-deep-badge ${colorClass}`;
  badge.innerHTML = `${emoji} <span class="mds-deep-conf">${confidence}%</span>`;

  // Позиционирование
  const wrapperOffset = {
    top: el.offsetTop,
    left: el.offsetLeft,
    width: el.offsetWidth
  };
  badge.style.top = `${wrapperOffset.top + 5}px`;
  badge.style.left = `${wrapperOffset.left + 5}px`;

  // Подсказка при наведении
  const verdictLabels = {
    'AI_GENERATED': 'Создано ИИ',
    'EDITED': 'Отредактировано',
    'AUTHENTIC': 'Аутентично',
    'UNKNOWN': 'Неизвестно'
  };
  badge.title = `🔬 Глубокий анализ: ${verdictLabels[verdict] || verdict}\n` +
    `Уверенность: ${confidence}%\n` +
    `${explanation}`;

  const parent = el.offsetParent || document.body;
  parent.appendChild(badge);
  el._mdsDeepOverlay = badge;

  // Добавить цветную рамку к элементу
  el.style.outline = verdict === 'AI_GENERATED' ? '3px solid rgba(255, 60, 60, 0.8)'
    : verdict === 'EDITED' ? '3px solid rgba(255, 200, 30, 0.8)'
      : verdict === 'AUTHENTIC' ? '3px solid rgba(60, 200, 80, 0.8)'
        : '3px solid rgba(160, 100, 255, 0.7)';
  el.style.outlineOffset = '-3px';
}

// ── UI Elements inject (existing metadata badges) ──
function injectBadge(el, status, details) {
  if (status !== 'AI' && status !== 'EDIT') return;

  const wrapperOffset = {
    top: el.offsetTop,
    left: el.offsetLeft,
    width: el.offsetWidth,
    height: el.offsetHeight
  };

  const badge = document.createElement('div');
  badge.className = `mds-ai-badge mds-${status.toLowerCase()}`;
  badge.innerHTML = status === 'AI' ? '🤖' : '🖌️';

  // Расположение значка в правом верхнем углу элемента
  badge.style.top = `${wrapperOffset.top + 5}px`;
  badge.style.left = `${wrapperOffset.left + wrapperOffset.width - 30}px`;

  badge.title = `${status === 'AI' ? 'Создано ИИ' : 'Отредактировано в ПО'}\n${details}`;

  const parent = el.offsetParent || document.body;
  parent.appendChild(badge);
}

/**
 * Извлечь анализируемые URL-адреса из медиа-элемента.
 */
function getMediaUrls(el) {
  const urls = [];
  const tag = el.tagName;

  if (tag === 'IMG') {
    if (el.src && !el.src.startsWith('data:')) {
      urls.push({ url: el.src, displayElement: el });
    }
  } else if (tag === 'VIDEO') {
    if (el.src && !el.src.startsWith('data:') && !el.src.startsWith('blob:')) {
      urls.push({ url: el.src, displayElement: el });
    }
    if (el.poster && !el.poster.startsWith('data:')) {
      urls.push({ url: el.poster, displayElement: el });
    }
    el.querySelectorAll('source').forEach(source => {
      if (source.src && !source.src.startsWith('data:') && !source.src.startsWith('blob:')) {
        urls.push({ url: source.src, displayElement: el });
      }
    });
  } else if (tag === 'SOURCE') {
    const parentVideo = el.closest('video');
    if (!parentVideo && el.src && !el.src.startsWith('data:') && !el.src.startsWith('blob:')) {
      urls.push({ url: el.src, displayElement: el.parentElement || el });
    }
  }

  return urls;
}

// Основной рабочий процесс
async function processMedia(el) {
  if (!globalSettings.enabled) return;

  const w = el.clientWidth || el.offsetWidth || 0;
  const h = el.clientHeight || el.offsetHeight || 0;
  if (w > 0 && w < 50 && h > 0 && h < 50) return;

  if (processedMedia.has(el)) return;
  processedMedia.add(el);

  const mediaUrls = getMediaUrls(el);
  if (mediaUrls.length === 0) return;

  for (const { url, displayElement } of mediaUrls) {
    const action = el.tagName === 'IMG' ? 'analyzeImage' : 'analyzeMedia';

    if (!isExtensionValid()) return;
    try { chrome.runtime.sendMessage({ action, url, pageUrl: location.href }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn("MDS: Service worker disconnected or error", chrome.runtime.lastError);
        return;
      }

      const mediaType = el.tagName === 'IMG' ? 'image' : 'video';
      console.log(`MDS: Checked ${mediaType} [${response?.status || 'UNKNOWN'}]`, url.substring(0, 60) + '...');

      if (response && (response.status === 'AI' || response.status === 'EDIT')) {
        injectBadge(displayElement, response.status, response.details);
      }
    }); } catch(e) { console.warn('MDS: Extension context lost', e); }
  }
}

const MEDIA_SELECTOR = 'img, video';

// Режим: Авто (Наблюдатель пересечений)
const mediaObserver = new IntersectionObserver((entries, observer) => {
  if (globalSettings.mode !== 'auto') return;
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      processMedia(entry.target);
      observer.unobserve(entry.target);
    }
  });
}, { rootMargin: '100px 0px', threshold: 0.1 });

// Режим: Наведение
let hoverTimer = null;
function handleMediaMouseEnter(e) {
  const el = e.currentTarget;

  // Показать кнопку Глубокого Сканирования (всегда, независимо от режима)
  if (scanBtnTimeout) { clearTimeout(scanBtnTimeout); scanBtnTimeout = null; }
  showScanButton(el);

  // Режим: наведение — также инициировать анализ метаданных
  if (globalSettings.mode !== 'hover' || !globalSettings.enabled) return;
  hoverTimer = setTimeout(() => {
    processMedia(el);
  }, 1000);
}

function handleMediaMouseLeave(e) {
  if (hoverTimer) {
    clearTimeout(hoverTimer);
    hoverTimer = null;
  }

  // Проверяем, находится ли курсор всё ещё в пределах изображения
  // (оверлеи Pinterest и других сайтов вызывают mouseleave, хотя курсор визуально над изображением)
  const rect = e.currentTarget.getBoundingClientRect();
  if (e.clientX >= rect.left && e.clientX <= rect.right &&
      e.clientY >= rect.top && e.clientY <= rect.bottom) {
    return; // курсор всё ещё над изображением — не скрываем кнопку
  }

  // Задержка скрытия кнопки сканирования, чтобы можно было переместить курсор на нее
  scanBtnTimeout = setTimeout(hideScanButton, 400);
}

function observeMediaElement(el) {
  mediaObserver.observe(el);
  el.addEventListener('mouseenter', handleMediaMouseEnter);
  el.addEventListener('mouseleave', handleMediaMouseLeave);
}

// Запуск
function init() {
  loadSettings(() => {
    const mediaElements = document.querySelectorAll(MEDIA_SELECTOR);
    mediaElements.forEach(el => observeMediaElement(el));

    const mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType !== Node.ELEMENT_NODE) return;

          const tag = node.tagName;
          if (tag === 'IMG' || tag === 'VIDEO') {
            observeMediaElement(node);
          } else if (node.querySelectorAll) {
            node.querySelectorAll(MEDIA_SELECTOR).forEach(el => observeMediaElement(el));
          }
        });
      });
    });

    mutationObserver.observe(document.body, { childList: true, subtree: true });

    // Скрывать кнопку сканирования при скролле (она появится заново при наведении)
    window.addEventListener('scroll', () => {
      hideScanButton();
    }, { passive: true });
  });
}

// Слушать изменения настроек от всплывающего окна расширения
try {
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync') {
      if (changes.enabled) globalSettings.enabled = changes.enabled.newValue;
      if (changes.mode) globalSettings.mode = changes.mode.newValue;
    }
  });
} catch(e) { console.warn('MDS: Extension context lost', e); }

// Выполнить инициализацию
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
