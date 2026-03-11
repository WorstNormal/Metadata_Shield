const fs = require('fs');

async function check() {
  const buffer = fs.readFileSync('google_ai_test.jpg');
  
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const bufferString = decoder.decode(new Uint8Array(buffer.slice(0, Math.min(buffer.byteLength, 65536))));
  const lowerBufferString = bufferString.toLowerCase();
  
  console.log("ДЛИНА:", buffer.byteLength);

  const AI_TRIGGERS = [
    'midjourney', 'dall-e', 'stable diffusion', 'comfyui', 'steerable', 
    'ai generated', 'leonardo', 'firefly', 'flux', 'ideogram', 'c2pa', 'jumbf'
  ];
  
  for (const trigger of AI_TRIGGERS) {
    if (lowerBufferString.includes(trigger)) {
        console.log("НАЙДЕН ТРИГГЕР:", trigger);
    }
  }
  
  console.log("\nСЫРОЕ НАЧАЛО ФАЙЛА:");
  console.log(bufferString.substring(0, 500));
}

check().catch(console.error);
