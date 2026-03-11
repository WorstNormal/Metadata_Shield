import exifr from 'exifr';

// ── Кеш результатов анализа (запоминаем уже проверенные изображения) ──
const analysisCache = new Map();  // ключ: URL, значение: результат
const deepCache = new Map();      // ключ: URL, значение: результат глубокого анализа
const CACHE_MAX_SIZE = 500;

function cacheSet(cache, key, value) {
  // Очистка половины кеша при переполнении
  if (cache.size >= CACHE_MAX_SIZE) {
    const keysToDelete = [...cache.keys()].slice(0, Math.floor(CACHE_MAX_SIZE / 2));
    keysToDelete.forEach(k => cache.delete(k));
  }
  cache.set(key, value);
}

// ── Контекстное обнаружение: известные платформы ИИ и агрегаторы ──
const AI_PAGE_PATTERNS = [
  // ── Генераторы изображений ИИ ──
  { pattern: /nanobanana\.io/i, name: 'Nano Banana (Gemini)' },
  { pattern: /deepai\.org/i, name: 'DeepAI' },
  { pattern: /craiyon\.com/i, name: 'Craiyon (DALL-E mini)' },
  { pattern: /playgroundai\.com/i, name: 'Playground AI' },
  { pattern: /leonardo\.ai/i, name: 'Leonardo.AI' },
  { pattern: /midjourney\.com/i, name: 'Midjourney' },
  { pattern: /openai\.com\/dall-e/i, name: 'DALL-E (OpenAI)' },
  { pattern: /openai\.com\/images/i, name: 'ChatGPT Images' },
  { pattern: /stability\.ai/i, name: 'Stability AI' },
  { pattern: /nightcafe\.studio/i, name: 'NightCafe' },
  { pattern: /dreamstudio\.ai/i, name: 'DreamStudio' },
  { pattern: /clipdrop\.co/i, name: 'Clipdrop (Stability)' },
  { pattern: /ideogram\.ai/i, name: 'Ideogram' },
  { pattern: /flux\.ai/i, name: 'Flux' },
  { pattern: /firefly\.adobe\.com/i, name: 'Adobe Firefly' },
  { pattern: /imagine\.meta\.com/i, name: 'Meta Imagine' },
  { pattern: /designer\.microsoft\.com/i, name: 'Microsoft Designer' },
  { pattern: /copilot\.microsoft\.com/i, name: 'Microsoft Copilot' },
  { pattern: /bing\.com\/create/i, name: 'Bing Image Creator' },
  { pattern: /dream\.ai/i, name: 'Dream by WOMBO' },
  { pattern: /wombo\.art/i, name: 'WOMBO Dream' },
  { pattern: /starryai\.com/i, name: 'StarryAI' },
  { pattern: /hotpot\.ai/i, name: 'Hotpot AI' },
  { pattern: /getimg\.ai/i, name: 'getimg.ai' },
  { pattern: /neural\.love/i, name: 'Neural.love' },
  { pattern: /pixai\.art/i, name: 'PixAI' },
  { pattern: /tensor\.art/i, name: 'Tensor.Art' },
  { pattern: /seaart\.ai/i, name: 'SeaArt' },
  { pattern: /openart\.ai/i, name: 'OpenArt' },
  { pattern: /mage\.space/i, name: 'Mage.Space' },
  { pattern: /dezgo\.com/i, name: 'Dezgo' },
  { pattern: /instantart\.io/i, name: 'InstantArt' },
  { pattern: /dreamlike\.art/i, name: 'Dreamlike.art' },
  { pattern: /picfinder\.ai/i, name: 'PicFinder' },
  { pattern: /krea\.ai/i, name: 'Krea AI' },
  { pattern: /freepik\.com\/ai/i, name: 'Freepik AI' },
  { pattern: /canva\.com\/ai-image/i, name: 'Canva AI' },
  { pattern: /fotor\.com\/ai/i, name: 'Fotor AI' },

  // ── Генераторы видео ИИ ──
  { pattern: /runwayml\.com/i, name: 'Runway' },
  { pattern: /pika\.art/i, name: 'Pika' },
  { pattern: /lumalabs\.ai/i, name: 'Luma Dream Machine' },
  { pattern: /klingai\.com/i, name: 'Kling AI' },
  { pattern: /sora\.com/i, name: 'Sora (OpenAI)' },
  { pattern: /haiper\.ai/i, name: 'Haiper' },
  { pattern: /synthesia\.io/i, name: 'Synthesia' },
  { pattern: /invideo\.io\/ai/i, name: 'InVideo AI' },
  { pattern: /heygen\.com/i, name: 'HeyGen' },
  { pattern: /d-id\.com/i, name: 'D-ID' },
  { pattern: /colossyan\.com/i, name: 'Colossyan' },
  { pattern: /fliki\.ai/i, name: 'Fliki' },
  { pattern: /elai\.io/i, name: 'Elai.io' },
  { pattern: /veed\.io\/ai/i, name: 'VEED AI' },
  { pattern: /genmo\.ai/i, name: 'Genmo' },
  { pattern: /morph\.studio/i, name: 'Morph Studio' },
  { pattern: /minimax\.io/i, name: 'MiniMax (Hailuo)' },
  { pattern: /hailuoai\.video/i, name: 'Hailuo AI' },
  { pattern: /viggle\.ai/i, name: 'Viggle AI' },

  // ── Генераторы музыки ИИ ──
  { pattern: /suno\.com/i, name: 'Suno AI' },
  { pattern: /udio\.com/i, name: 'Udio' },

  // ── Агрегаторы контента ИИ и галереи ──
  { pattern: /civitai\.com/i, name: 'CivitAI' },
  { pattern: /lexica\.art/i, name: 'Lexica' },
  { pattern: /prompthero\.com/i, name: 'PromptHero' },
  { pattern: /arthub\.ai/i, name: 'ArtHub' },
  { pattern: /aiartists\.org/i, name: 'AI Artists' },
  { pattern: /playgrounds\.ai/i, name: 'Playgrounds' },
  { pattern: /aifindy\.com/i, name: 'AI Findy' },
  { pattern: /enterpix\.app/i, name: 'Enterpix' },
  { pattern: /liblib\.art/i, name: 'LibLib AI' },
  { pattern: /shakker\.ai/i, name: 'Shakker AI' },
  { pattern: /promptbase\.com/i, name: 'PromptBase' },
  { pattern: /aimodels\.fyi/i, name: 'AI Models FYI' },
];

// ── Контекстное обнаружение: известные домены CDN медиа ИИ ──
const AI_IMAGE_URL_PATTERNS = [
  { pattern: /oaidalleapiprodscus\.blob\.core\.windows\.net/i, name: 'DALL-E (OpenAI)' },
  { pattern: /replicate\.delivery/i, name: 'Replicate' },
  { pattern: /cdn\.midjourney\.com/i, name: 'Midjourney' },
  { pattern: /image\.civitai\.com/i, name: 'CivitAI CDN' },
  { pattern: /imagecache\.civitai\.com/i, name: 'CivitAI Cache' },
  { pattern: /cdn\.openart\.ai/i, name: 'OpenArt CDN' },
  { pattern: /cdn\.lexica\.art/i, name: 'Lexica CDN' },
  { pattern: /images\.tensor\.art/i, name: 'Tensor.Art CDN' },
  { pattern: /cdn\.seaart\.ai/i, name: 'SeaArt CDN' },
  { pattern: /media\.discordapp\.net\/.*midjourney/i, name: 'Midjourney (Discord)' },
];

// ── Триггеры метаданных (на основе ключевых слов) ──
const AI_TRIGGERS = [
  'midjourney', 'dall-e', 'stable diffusion', 'comfyui', 'steerable', 
  'ai generated', 'leonardo', 'firefly', 'flux', 'ideogram', 'imagen', 'google ai', 'synthid',
  // Триггеры видео ИИ
  'sora', 'pika', 'kling', 'luma', 'gen-2', 'gen-3', 'runway gen', 'haiper',
  'synthesia', 'ai video', 'deepfake'
];
const EDIT_TRIGGERS = [
  'adobe photoshop', 'lightroom', 'gimp', 'affinity photo', 'capture one',
  // Триггеры видеоредакторов
  'premiere pro', 'davinci resolve', 'final cut', 'after effects',
  'vegas pro', 'filmora', 'capcut'
];

// Бинарные маркеры C2PA (простой поиск байтов)
const C2PA_MARKERS = [
  'jumbf', 'c2pa'
];

/**
 * Проверка, происходит ли изображение с известной платформы ИИ (по URL страницы или URL изображения).
 * Возвращает объект результата или null, если совпадений контекста нет.
 */
function checkContextSignals(imageUrl, pageUrl) {
  // 1. Проверка, является ли сама СТРАНИЦА известным генератором изображений ИИ
  if (pageUrl) {
    for (const { pattern, name } of AI_PAGE_PATTERNS) {
      if (pattern.test(pageUrl)) {
        return {
          status: 'AI',
          details: `Изображение найдено на известной ИИ-платформе: ${name}. Страница: ${pageUrl}`
        };
      }
    }
  }

  // 2. Проверка, поступает ли URL ИЗОБРАЖЕНИЯ с известного CDN ИИ
  for (const { pattern, name } of AI_IMAGE_URL_PATTERNS) {
    if (pattern.test(imageUrl)) {
      return {
        status: 'AI',
        details: `Изображение загружено с известного CDN сервиса ИИ: ${name}`
      };
    }
  }

  return null; // нет совпадений по контексту
}

async function analyzeMedia(url, pageUrl) {

  try {
    // ── Шаг 0: Контекстное обнаружение (URL страницы / CDN медиа) ──
    const contextResult = checkContextSignals(url, pageUrl);
    if (contextResult) {
      console.log(`MDS: Context detection matched for ${url}`);
      return contextResult;
    }

    // ── Шаг 1: Получение байтов медиа для анализа метаданных ──
    // Мы получаем только первые 128KB для чтения заголовков EXIF/XMP и пропуска полной загрузки
    let response = await fetch(url, {
      method: 'GET',
      headers: {
        'Range': 'bytes=0-131072'
      }
    });

    if (!response.ok && response.status !== 206) {
      console.warn(`MDS: Range request failed (${response.status}) for ${url}. Trying full fetch...`);
      // Некоторые CDN возвращают 400 Bad Request для заголовков Range.
      // Возврат к загрузке полного изображения без заголовка Range.
      response = await fetch(url, { method: 'GET' });
      if (!response.ok) {
        throw new Error(`Не удалось загрузить медиа: ${response.status}`);
      }
    }

    const buffer = await response.arrayBuffer();

    // ── Шаг 2: Бинарный поиск маркеров C2PA ──
    // Использование TextDecoder вместо String.fromCharCode.apply для предотвращения "Maximum call stack size exceeded"
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const bufferString = decoder.decode(new Uint8Array(buffer.slice(0, Math.min(buffer.byteLength, 65536))));
    const lowerBufferString = bufferString.toLowerCase();
    
    for (const marker of C2PA_MARKERS) {
      if (lowerBufferString.includes(marker)) {
        return {
          status: 'AI', // C2PA в настоящее время высоко коррелирует с ИИ/Content Credentials
          details: `Найден маркер Content Credentials (C2PA): "${marker}"`
        };
      }
    }

    // ── Шаг 3: Парсинг EXIF, XMP и IPTC с использованием exifr ──
    const options = { tiff: true, xmp: true, icc: false, iptc: true };
    let exifData = null;
    try {
      exifData = await exifr.parse(buffer, options);
    } catch (e) {
      console.warn("MDS: exifr parsing failed, relying on binary search fallback.");
    }

    // Преобразование метаданных в строку для простого поиска по ключевым словам
    let metaString = lowerBufferString; // Использовать сырой бинарный буфер как резервное пространство для поиска!
    
    if (exifData) {
      metaString += ' ' + JSON.stringify(exifData).toLowerCase();
      // Проверка, извлек ли exifr сырую XMP строку
      if (exifData.xmp) {
         metaString += ' ' + exifData.xmp.toLowerCase();
      }
    }

    // ── Шаг 4: Проверка триггеров ключевых слов ИИ ──
    for (const trigger of AI_TRIGGERS) {
      if (metaString.includes(trigger)) {
        return {
          status: 'AI',
          details: `Сгенерировано или обработано ИИ. Найдено ключевое слово: "${trigger.toUpperCase()}"`,
          raw: exifData
        };
      }
    }

    // ── Шаг 5: Проверка триггеров ключевых слов редактора ──
    for (const trigger of EDIT_TRIGGERS) {
      if (metaString.includes(trigger)) {
        return {
          status: 'EDIT',
          details: `Отредактировано с использованием ПО. Найдено ключевое слово: "${trigger.toUpperCase()}"`,
          raw: exifData
        };
      }
    }

    // По умолчанию: если нет триггеров, но есть метаданные
    return { status: 'CLEAN', details: 'Метаданные проанализированы, редактирования или сигнатуры ИИ не найдены.', raw: exifData };

  } catch (error) {
    console.error('Analyzing media failed:', error);
    return { status: 'ERROR', details: error.message };
  }
}

// ── Глубокий анализ через Gemini API ──
async function deepAnalyze(url) {
  try {
    // 1. Получение API-ключа из хранилища
    const { geminiApiKey } = await chrome.storage.sync.get('geminiApiKey');
    if (!geminiApiKey) {
      return { status: 'ERROR', details: 'API-ключ Gemini не установлен. Откройте настройки расширения, чтобы добавить ключ.' };
    }

    // 2. Загрузка изображения и конвертация в base64
    console.log('MDS Deep: Fetching image for analysis...', url.substring(0, 60));
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Не удалось загрузить изображение: ${response.status}`);
    }

    const blob = await response.blob();
    const mimeType = blob.type || 'image/jpeg';

    // Конвертация blob в base64 с помощью подхода аналогичного FileReader в service worker
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, chunk);
    }
    const base64Data = btoa(binary);

    // 3. Вызов Gemini API
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;

    const prompt = `You are an expert forensic image analyst. Analyze this image and determine if it was:
1. AI-GENERATED (created by AI tools like Midjourney, DALL-E, Stable Diffusion, etc.)
2. EDITED (modified using software like Photoshop, after significant manipulation)
3. AUTHENTIC (a real, unmodified photograph)

Look for these AI artifacts:
- Unnatural textures, skin smoothness, or hair rendering
- Inconsistent lighting or shadows
- Distorted hands, fingers, teeth, or text
- Repeating patterns or symmetry anomalies
- Over-idealized features or compositions
- Telltale signs of specific AI models

Respond ONLY with valid JSON (no markdown, no code fences):
{"verdict": "AI_GENERATED" or "EDITED" or "AUTHENTIC", "confidence": 0-100, "explanation": "brief explanation in Russian"}`;

    const geminiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Data
              }
            }
          ]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1024
        }
      })
    });

    if (!geminiResponse.ok) {
      const errBody = await geminiResponse.text();
      console.error('MDS Deep: Gemini API error', geminiResponse.status, errBody);
      if (geminiResponse.status === 400) {
        throw new Error('Неверный запрос — проверьте API-ключ или формат изображения');
      } else if (geminiResponse.status === 403) {
        throw new Error('API-ключ недействителен или превышена квота');
      } else if (geminiResponse.status === 429) {
        throw new Error('Превышен лимит частоты запросов — попробуйте позже');
      }
      throw new Error(`Ошибка Gemini API: ${geminiResponse.status}`);
    }

    const result = await geminiResponse.json();

    // 4. Разбор ответа
    const textContent = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log('MDS Deep: Raw Gemini response:', textContent);

    // Очистка потенциальных блоков кода markdown
    let cleanJson = textContent.trim();
    cleanJson = cleanJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

    try {
      const parsed = JSON.parse(cleanJson);
      return {
        status: 'DEEP',
        verdict: parsed.verdict || 'UNKNOWN',
        confidence: parsed.confidence ?? 0,
        explanation: parsed.explanation || 'Объяснение отсутствует',
        details: `${parsed.verdict} (уверенность ${parsed.confidence}%) — ${parsed.explanation}`
      };
    } catch (parseErr) {
      console.warn('MDS Deep: JSON.parse failed, trying regex fallback...');
      
      // Резервный вариант с regex для частичного/некорректного JSON
      const verdictMatch = cleanJson.match(/"verdict"\s*:\s*"([^"]+)"/i);
      const confMatch = cleanJson.match(/"confidence"\s*:\s*(\d+)/i);
      const explMatch = cleanJson.match(/"explanation"\s*:\s*"([^"]*)"/i);
      
      const verdict = verdictMatch ? verdictMatch[1] : 'UNKNOWN';
      const confidence = confMatch ? parseInt(confMatch[1]) : 0;
      const explanation = explMatch ? explMatch[1] : textContent.substring(0, 200);
      
      return {
        status: 'DEEP',
        verdict,
        confidence,
        explanation,
        details: `${verdict} (уверенность ${confidence}%) — ${explanation}`
      };
    }

  } catch (error) {
    console.error('MDS Deep: Analysis failed:', error);
    return { status: 'ERROR', details: error.message };
  }
}

// Прослушивание сообщений от Content Script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analyzeImage' || request.action === 'analyzeMedia') {
    // Проверка кеша
    const cached = analysisCache.get(request.url);
    if (cached) {
      console.log('MDS: Cache hit (metadata)', request.url.substring(0, 60));
      sendResponse(cached);
      return;
    }
    analyzeMedia(request.url, request.pageUrl).then((result) => {
      cacheSet(analysisCache, request.url, result);
      sendResponse(result);
    });
    return true;
  }
  if (request.action === 'deepAnalyze') {
    // Проверка кеша
    const cached = deepCache.get(request.url);
    if (cached) {
      console.log('MDS: Cache hit (deep)', request.url.substring(0, 60));
      sendResponse(cached);
      return;
    }
    deepAnalyze(request.url).then((result) => {
      if (result.status !== 'ERROR') {
        cacheSet(deepCache, request.url, result);
      }
      sendResponse(result);
    });
    return true;
  }
});
