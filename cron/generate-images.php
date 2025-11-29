<?php
require_once __DIR__ . '/../vendor/autoload.php';

$apiKey = getenv('LITELLM_API_KEY');
$litellmHost = getenv('LITELLM_HOST');
$comfyuiHost = getenv('COMFYUI_HOST') ?: 'https://comfyui.home.shdr.ch';
$outputDir = getenv('IMAGE_OUTPUT_DIR') ?: '/app/storage/images';

$llmModels = [
  'aether/qwen3:8b',
];

$imageModels = [
  'z_image_turbo_bf16.safetensors',
];

$regions = [
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

$eras = [
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

if (!is_dir($outputDir)) {
  mkdir($outputDir, 0755, true);
}

$llmClient = new \GuzzleHttp\Client(['base_uri' => rtrim($litellmHost, '/'), 'timeout' => 60]);
$http = new \GuzzleHttp\Client(['base_uri' => rtrim($comfyuiHost, '/'), 'timeout' => 300]);

$workflow = json_decode(file_get_contents(__DIR__ . '/../comfyui-workflow.json'), true);

$results = [];

for ($i = 1; $i <= 20; $i++) {
  // Pick random models, region, and era for this iteration
  $llmModel = $llmModels[array_rand($llmModels)];
  $imageModel = $imageModels[array_rand($imageModels)];
  $region = $regions[array_rand($regions)];
  $era = $eras[array_rand($eras)];

  echo "Generating image $i/20...\n";
  echo "  LLM: $llmModel | Image: $imageModel\n";
  echo "  Setting: $era in $region\n";

  $promptInstruction = <<<PROMPT
Write a 3-4 sentence image prompt for a realistic historical photograph from $era in $region.

Describe it like a museum photo caption: plain language, no AI art buzzwords (no "8k", "cinematic", "masterpiece", etc).

Include:
- The specific scene or moment
- Exact location details
- Time of day and lighting
- If people are present: their appearance and what they're doing

CRITICAL: All clothing, tools, architecture, and technology must be historically accurate for $era. No anachronisms - only materials, techniques, and objects that existed in that specific time and place.

Output ONLY the image prompt, nothing else.
PROMPT;

  $response = $llmClient->post('/v1/chat/completions', [
    'headers' => ['Authorization' => "Bearer $apiKey"],
    'json' => [
      'model' => $llmModel,
      'messages' => [
        ['role' => 'user', 'content' => $promptInstruction],
      ],
    ],
  ]);

  $llmResult = json_decode($response->getBody()->getContents(), true);
  $imagePrompt = trim($llmResult['choices'][0]['message']['content']);

  echo "  Prompt: " . substr($imagePrompt, 0, 80) . "...\n";

  $currentWorkflow = $workflow;
  $currentWorkflow['6']['inputs']['text'] = $imagePrompt;
  $currentWorkflow['16']['inputs']['unet_name'] = $imageModel;

  $response = $http->post('/prompt', ['json' => ['prompt' => $currentWorkflow]]);
  $result = json_decode($response->getBody()->getContents(), true);
  $promptId = $result['prompt_id'];

  $outputImage = null;
  $attempts = 0;
  $maxAttempts = 120; // 2 minutes timeout per image

  while ($attempts < $maxAttempts) {
    sleep(1);
    $attempts++;

    $history = $http->get("/history/$promptId");
    $data = json_decode($history->getBody()->getContents(), true);

    if (!empty($data[$promptId]['outputs'])) {
      foreach ($data[$promptId]['outputs'] as $nodeId => $output) {
        if (isset($output['images'][0])) {
          $outputImage = $output['images'][0];
          break 2;
        }
      }
    }
  }

  if (!$outputImage) {
    echo "  ERROR: Timeout waiting for image $i\n";
    continue;
  }

  $imageUrl = '/view?' . http_build_query([
    'filename' => $outputImage['filename'],
    'subfolder' => $outputImage['subfolder'] ?? '',
    'type' => $outputImage['type'] ?? 'output',
  ]);

  $imageResponse = $http->get($imageUrl);
  $imageData = $imageResponse->getBody()->getContents();

  $filename = sprintf('image_%02d.png', $i);
  $filepath = $outputDir . '/' . $filename;

  file_put_contents($filepath, $imageData);

  $results[] = [
    'index' => $i,
    'filename' => $filename,
    'prompt' => $imagePrompt,
    'filepath' => $filepath,
    'llm_model' => $llmModel,
    'image_model' => $imageModel,
    'region' => $region,
    'era' => $era,
  ];

  echo "  Saved: $filename\n";
}

$metadataFile = $outputDir . '/metadata.json';
file_put_contents($metadataFile, json_encode($results, JSON_PRETTY_PRINT));

echo "\n=== Generation Complete ===\n";
echo "Generated " . count($results) . " images\n";
echo "Output directory: $outputDir\n";
echo "Metadata saved to: $metadataFile\n";

