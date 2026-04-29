const apiKey    = requireEnv('LITELLM_API_KEY');
const litellmHost  = requireEnv('LITELLM_HOST');
const comfyuiHost  = process.env.COMFYUI_HOST || 'https://comfyui.home.shdr.ch';
const upload       = process.env.UPLOAD === 'true';

const outputDir = process.env.IMAGE_OUTPUT_DIR || './storage/images';

const llmModels = [
  'aether/qwen3:8b',
];

const imageModels = [
  'z_image_turbo_bf16.safetensors',
];

const regions = [
  'West Africa (Mali, Ghana, Benin)',
  'East Africa (Ethiopia, Swahili Coast)',
  'North Africa (Egypt, Morocco, Tunisia)',
  'Central Asia (Silk Road, Mongolia, Persia)',
  'South Asia (India, Sri Lanka)',
  'Southeast Asia (Khmer, Majapahit, Siam)',
  'East Asia (China, Japan, Korea)',
  'Pacific Islands (Polynesia, Melanesia)',
  'Middle East (Mesopotamia, Levant, Arabia)',
  'Mediterranean (Greece, Rome, Byzantium)',
  'Western Europe (France, England, Spain)',
  'Northern Europe (Scandinavia, Baltic)',
  'Eastern Europe (Russia, Poland, Balkans)',
  'Mesoamerica (Maya, Aztec)',
  'South America (Inca, pre-Columbian)',
  'North America (Indigenous nations, Colonial)',
  'Australia (Aboriginal, Colonial)',
  'Caribbean (Indigenous, Colonial)',
];

const eras = [
  'ancient times (3000 BCE - 500 CE)',
  'early medieval period (500-1000 CE)',
  'high medieval period (1000-1300 CE)',
  'late medieval period (1300-1500 CE)',
  '16th century Renaissance',
  '17th century Baroque era',
  '18th century Enlightenment',
  'early 19th century',
  'mid 19th century Industrial Revolution',
  'late 19th century',
  'early 1900s (1900-1920)',
  '1920s-1930s',
];

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function sha256Hex(data: Uint8Array): string {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(data);
  return hasher.digest('hex');
}

import { mkdir } from 'node:fs/promises';

async function ensureDir(dir: string) {
  await mkdir(dir, { recursive: true });
}

async function main() {
  await ensureDir(outputDir);

  const workflowPath = `${import.meta.dir}/../comfyui-workflow.json`;
  const workflow = await Bun.file(workflowPath).json() as Record<string, any>;

  const results: Array<{
    index: number;
    filename: string;
    prompt: string;
    filepath: string;
    llm_model: string;
    image_model: string;
    region: string;
    era: string;
  }>
   = [];

  for (let i = 1; i <= 20; i++) {
    const llmModel = pick(llmModels);
    const imageModel = pick(imageModels);
    const region = pick(regions);
    const era = pick(eras);

    console.log(`Generating image ${i}/20...`);
    console.log(`  LLM: ${llmModel} | Image: ${imageModel}`);
    console.log(`  Setting: ${era} in ${region}`);

    const promptInstruction = `Write a 3-4 sentence image prompt for a realistic historical photograph from ${era} in ${region}.\n\nDescribe it like a museum photo caption: plain language, no AI art buzzwords (no "8k", "cinematic", "masterpiece", etc).\n\nInclude:\n- The specific scene or moment\n- Exact location details\n- Time of day and lighting\n- If people are present: their appearance and what they're doing\n\nCRITICAL: All clothing, tools, architecture, and technology must be historically accurate for ${era}. No anachronisms - only materials, techniques, and objects that existed in that specific time and place.\n\nOutput ONLY the image prompt, nothing else.`;

    const llmRes = await fetch(`${litellmHost.replace(/\/+$/, '')}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: llmModel,
        messages: [{ role: 'user', content: promptInstruction }],
      }),
    });

    if (!llmRes.ok) throw new Error(`LLM request failed: ${llmRes.status} ${await llmRes.text()}`);
    const llmJson = await llmRes.json() as any;
    const imagePrompt = llmJson.choices?.[0]?.message?.content?.trim() || '';

    console.log(`  Prompt: ${imagePrompt.slice(0, 80)}...`);

    const currentWorkflow = structuredClone(workflow);
    currentWorkflow['6'].inputs.text = imagePrompt;
    currentWorkflow['16'].inputs.unet_name = imageModel;

    const promptRes = await fetch(`${comfyuiHost.replace(/\/+$/, '')}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: currentWorkflow }),
    });

    if (!promptRes.ok) throw new Error(`ComfyUI prompt failed: ${promptRes.status} ${await promptRes.text()}`);
    const promptData = await promptRes.json() as { prompt_id: string };
    const promptId = promptData.prompt_id;

    let outputImage: any = null;
    const maxAttempts = 120;

    for (let attempts = 0; attempts < maxAttempts; attempts++) {
      await Bun.sleep(1000);
      const historyRes = await fetch(`${comfyuiHost.replace(/\/+$/, '')}/history/${promptId}`);
      if (!historyRes.ok) continue;
      const historyData = await historyRes.json() as Record<string, any>;
      const outputs = historyData[promptId]?.outputs;
      if (outputs) {
        for (const nodeId of Object.keys(outputs)) {
          if (outputs[nodeId]?.images?.[0]) {
            outputImage = outputs[nodeId].images[0];
            break;
          }
        }
      }
      if (outputImage) break;
    }

    if (!outputImage) {
      console.error(`  ERROR: Timeout waiting for image ${i}`);
      continue;
    }

    const viewUrl = new URL('/view', comfyuiHost.replace(/\/+$/, ''));
    viewUrl.searchParams.set('filename', outputImage.filename);
    viewUrl.searchParams.set('subfolder', outputImage.subfolder || '');
    viewUrl.searchParams.set('type', outputImage.type || 'output');

    const imageRes = await fetch(viewUrl.toString());
    if (!imageRes.ok) throw new Error(`Image fetch failed: ${imageRes.status}`);
    const imageData = new Uint8Array(await imageRes.arrayBuffer());

    const hash = sha256Hex(imageData).slice(0, 12);
    const filename = `image-${hash}.png`;
    const filepath = `${outputDir}/${filename}`;

    await Bun.write(filepath, imageData);

    results.push({
      index: i,
      filename,
      prompt: imagePrompt,
      filepath,
      llm_model: llmModel,
      image_model: imageModel,
      region,
      era,
    });

    console.log(`  Saved: ${filename}`);
  }

  if (upload) {
    const s3Endpoint = requireEnv('S3_ENDPOINT');
    const s3Bucket   = requireEnv('S3_BUCKET');
    // CF purge is best-effort. When CF_* env is unset, manifest.json
    // invalidates via its 60s Cache-Control TTL instead of an explicit purge.
    const cfZoneId   = process.env.CF_ZONE_ID || '';
    const cfApiToken = process.env.CF_API_TOKEN || '';

    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
    const s3 = new S3Client({
      endpoint: s3Endpoint,
      forcePathStyle: true,
      region: 'us-east-1',
    });

    for (const r of results) {
      const data = await Bun.file(r.filepath).arrayBuffer();
      await s3.send(new PutObjectCommand({
        Bucket: s3Bucket,
        Key: `images/${r.filename}`,
        Body: new Uint8Array(data),
        ContentType: 'image/png',
        CacheControl: 'public, max-age=31536000, immutable',
      }));
      console.log(`  Uploaded: images/${r.filename}`);
    }

    const manifest = results.map(r => ({
      filename: r.filename,
      prompt: r.prompt,
      region: r.region,
      era: r.era,
      llm_model: r.llm_model,
      image_model: r.image_model,
    }));

    const manifestBody = JSON.stringify(manifest, null, 2);
    await s3.send(new PutObjectCommand({
      Bucket: s3Bucket,
      Key: 'images/manifest.json',
      Body: manifestBody,
      ContentType: 'application/json',
      CacheControl: 'public, max-age=60, must-revalidate',
    }));
    console.log('  Uploaded: images/manifest.json');

    if (cfZoneId && cfApiToken) {
      const cfRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${cfZoneId}/purge_cache`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cfApiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ files: ['https://shdr.ch/images/manifest.json'] }),
      });
      if (!cfRes.ok) throw new Error(`Cloudflare purge failed: ${cfRes.status} ${await cfRes.text()}`);
      console.log('  Purged Cloudflare cache for manifest.json');
    } else {
      console.log('  CF purge skipped (CF_ZONE_ID/CF_API_TOKEN unset; relying on 60s TTL)');
    }
  } else {
    // local mode: write metadata.json
    const metadataFile = `${outputDir}/manifest.json`;
    await Bun.write(metadataFile, JSON.stringify(results, null, 2));
    console.log(`  Metadata saved to: ${metadataFile}`);
  }

  console.log('\n=== Generation Complete ===');
  console.log(`Generated ${results.length} images`);
  console.log(`Output directory: ${outputDir}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
