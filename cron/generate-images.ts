import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';

type Workflow = Record<string, any>;

type GeneratedImage = {
  index: number;
  filename: string;
  prompt: string;
  filepath: string;
  llm_model: string;
  image_model: string;
  region: string;
  era: string;
};

type ManifestEntry = Omit<GeneratedImage, 'index' | 'filepath'>;

type ComfyImage = {
  filename: string;
  subfolder?: string;
  type?: string;
};

const IMAGE_COUNT = 20;
const COMFYUI_POLL_ATTEMPTS = 120;
const COMFYUI_POLL_INTERVAL_MS = 1000;
const WEBP_OPTIONS = { quality: 82, effort: 4 };

const llmModels = [
  'aether/qwen3.5-9b',
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
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function trimTrailingSlashes(url: string): string {
  return url.replace(/\/+$/, '');
}

function sha256Hex(data: Uint8Array): string {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(data);
  return hasher.digest('hex');
}

function buildImagePromptInstruction(era: string, region: string): string {
  return `Write a 3-4 sentence image prompt for a realistic historical photograph from ${era} in ${region}.

Describe it like a museum photo caption: plain language, no AI art buzzwords (no "8k", "cinematic", "masterpiece", etc).

Include:
- The specific scene or moment
- Exact location details
- Time of day and lighting
- If people are present: their appearance and what they're doing

CRITICAL: All clothing, tools, architecture, and technology must be historically accurate for ${era}. No anachronisms - only materials, techniques, and objects that existed in that specific time and place.

Output ONLY the image prompt, nothing else.`;
}

async function ensureDir(dir: string) {
  await mkdir(dir, { recursive: true });
}

async function requestImagePrompt(config: {
  litellmHost: string;
  apiKey: string;
  llmModel: string;
  era: string;
  region: string;
}) {
  const res = await fetch(`${config.litellmHost}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.llmModel,
      messages: [{ role: 'user', content: buildImagePromptInstruction(config.era, config.region) }],
    }),
  });

  if (!res.ok) throw new Error(`LLM request failed: ${res.status} ${await res.text()}`);

  const body = await res.json() as any;
  const prompt = body.choices?.[0]?.message?.content?.trim();
  if (!prompt) throw new Error('LLM response did not include a prompt');
  return prompt;
}

async function queueComfyWorkflow(config: {
  comfyuiHost: string;
  workflow: Workflow;
  imagePrompt: string;
  imageModel: string;
}) {
  const currentWorkflow = structuredClone(config.workflow);
  currentWorkflow['6'].inputs.text = config.imagePrompt;
  currentWorkflow['16'].inputs.unet_name = config.imageModel;

  const res = await fetch(`${config.comfyuiHost}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: currentWorkflow }),
  });

  if (!res.ok) throw new Error(`ComfyUI prompt failed: ${res.status} ${await res.text()}`);

  const body = await res.json() as { prompt_id: string };
  if (!body.prompt_id) throw new Error('ComfyUI response did not include a prompt_id');
  return body.prompt_id;
}

function findFirstOutputImage(outputs: Record<string, any> | undefined): ComfyImage | null {
  if (!outputs) return null;

  for (const output of Object.values(outputs)) {
    const image = output?.images?.[0];
    if (image) return image;
  }

  return null;
}

async function waitForComfyImage(comfyuiHost: string, promptId: string): Promise<ComfyImage | null> {
  for (let attempts = 0; attempts < COMFYUI_POLL_ATTEMPTS; attempts++) {
    await Bun.sleep(COMFYUI_POLL_INTERVAL_MS);

    const res = await fetch(`${comfyuiHost}/history/${promptId}`);
    if (!res.ok) continue;

    const history = await res.json() as Record<string, any>;
    const outputImage = findFirstOutputImage(history[promptId]?.outputs);
    if (outputImage) return outputImage;
  }

  return null;
}

async function fetchComfyImageAsWebp(comfyuiHost: string, image: ComfyImage): Promise<Buffer> {
  const viewUrl = new URL('/view', comfyuiHost);
  viewUrl.searchParams.set('filename', image.filename);
  viewUrl.searchParams.set('subfolder', image.subfolder || '');
  viewUrl.searchParams.set('type', image.type || 'output');

  const res = await fetch(viewUrl.toString());
  if (!res.ok) throw new Error(`Image fetch failed: ${res.status}`);

  return sharp(await res.arrayBuffer())
    .webp(WEBP_OPTIONS)
    .toBuffer();
}

async function generateImage(config: {
  index: number;
  workflow: Workflow;
  outputDir: string;
  litellmHost: string;
  comfyuiHost: string;
  apiKey: string;
}): Promise<GeneratedImage | null> {
  const llmModel = pick(llmModels);
  const imageModel = pick(imageModels);
  const region = pick(regions);
  const era = pick(eras);

  console.log(`Generating image ${config.index}/${IMAGE_COUNT}...`);
  console.log(`  LLM: ${llmModel} | Image: ${imageModel}`);
  console.log(`  Setting: ${era} in ${region}`);

  const imagePrompt = await requestImagePrompt({
    litellmHost: config.litellmHost,
    apiKey: config.apiKey,
    llmModel,
    era,
    region,
  });
  console.log(`  Prompt: ${imagePrompt.slice(0, 80)}...`);

  const promptId = await queueComfyWorkflow({
    comfyuiHost: config.comfyuiHost,
    workflow: config.workflow,
    imagePrompt,
    imageModel,
  });

  const outputImage = await waitForComfyImage(config.comfyuiHost, promptId);
  if (!outputImage) {
    console.error(`  ERROR: Timeout waiting for image ${config.index}`);
    return null;
  }

  const imageData = await fetchComfyImageAsWebp(config.comfyuiHost, outputImage);
  const hash = sha256Hex(imageData).slice(0, 12);
  const filename = `image-${hash}.webp`;
  const filepath = `${config.outputDir}/${filename}`;

  await Bun.write(filepath, imageData);
  console.log(`  Saved: ${filename}`);

  return {
    index: config.index,
    filename,
    prompt: imagePrompt,
    filepath,
    llm_model: llmModel,
    image_model: imageModel,
    region,
    era,
  };
}

function toManifest(results: GeneratedImage[]): ManifestEntry[] {
  return results.map(({ filename, prompt, region, era, llm_model, image_model }) => ({
    filename,
    prompt,
    region,
    era,
    llm_model,
    image_model,
  }));
}

async function uploadResults(results: GeneratedImage[]) {
  const s3Endpoint = requireEnv('S3_ENDPOINT');
  const s3Bucket = requireEnv('S3_BUCKET');

  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
  const s3 = new S3Client({
    endpoint: s3Endpoint,
    forcePathStyle: true,
    region: 'us-east-1',
  });

  for (const result of results) {
    const data = await Bun.file(result.filepath).arrayBuffer();
    await s3.send(new PutObjectCommand({
      Bucket: s3Bucket,
      Key: `images/${result.filename}`,
      Body: new Uint8Array(data),
      ContentType: 'image/webp',
      CacheControl: 'public, max-age=31536000, immutable',
    }));
    console.log(`  Uploaded: images/${result.filename}`);
  }

  await s3.send(new PutObjectCommand({
    Bucket: s3Bucket,
    Key: 'images/manifest.json',
    Body: JSON.stringify(toManifest(results), null, 2),
    ContentType: 'application/json',
    CacheControl: 'public, max-age=60, must-revalidate',
  }));
  console.log('  Uploaded: images/manifest.json');
}

async function purgeCloudflareManifest() {
  const cfZoneId = process.env.CF_ZONE_ID || '';
  const cfApiToken = process.env.CF_API_TOKEN || '';

  if (!cfZoneId || !cfApiToken) {
    console.log('  CF purge skipped (CF_ZONE_ID/CF_API_TOKEN unset; relying on 60s TTL)');
    return;
  }

  const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${cfZoneId}/purge_cache`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${cfApiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ files: ['https://shdr.ch/images/manifest.json'] }),
  });

  if (!res.ok) throw new Error(`Cloudflare purge failed: ${res.status} ${await res.text()}`);
  console.log('  Purged Cloudflare cache for manifest.json');
}

async function writeLocalManifest(outputDir: string, results: GeneratedImage[]) {
  const metadataFile = `${outputDir}/manifest.json`;
  await Bun.write(metadataFile, JSON.stringify(results, null, 2));
  console.log(`  Metadata saved to: ${metadataFile}`);
}

async function main() {
  const apiKey = requireEnv('LITELLM_API_KEY');
  const litellmHost = trimTrailingSlashes(requireEnv('LITELLM_HOST'));
  const comfyuiHost = trimTrailingSlashes(process.env.COMFYUI_HOST || 'https://comfyui.home.shdr.ch');
  const upload = process.env.UPLOAD === 'true';
  const outputDir = process.env.IMAGE_OUTPUT_DIR || './storage/images';

  await ensureDir(outputDir);

  const workflowPath = `${import.meta.dir}/../comfyui-workflow.json`;
  const workflow = await Bun.file(workflowPath).json() as Workflow;
  const results: GeneratedImage[] = [];

  for (let index = 1; index <= IMAGE_COUNT; index++) {
    const result = await generateImage({
      index,
      workflow,
      outputDir,
      litellmHost,
      comfyuiHost,
      apiKey,
    });
    if (result) results.push(result);
  }

  if (upload) {
    await uploadResults(results);
    await purgeCloudflareManifest();
  } else {
    await writeLocalManifest(outputDir, results);
  }

  console.log('\n=== Generation Complete ===');
  console.log(`Generated ${results.length} images`);
  console.log(`Output directory: ${outputDir}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
