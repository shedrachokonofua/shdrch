<?php
require_once __DIR__ . '/../vendor/autoload.php';

$apiKey = getenv('LITELLM_API_KEY');
$litellmHost = getenv('LITELLM_HOST');
$comfyuiHost = getenv('COMFYUI_HOST') ?: 'https://comfyui.home.shdr.ch';
$outputDir = getenv('IMAGE_OUTPUT_DIR') ?: '/app/storage/images';

// Available models to randomly pick from
$llmModels = [
  'aether/qwen3:8b',
  'aether/gemma3:27b',
  'aether/mistral-small3.2',
];

$imageModels = [
  'z_image_turbo_bf16.safetensors',
];

// Ensure output directory exists
if (!is_dir($outputDir)) {
  mkdir($outputDir, 0755, true);
}

$llmClient = new \GuzzleHttp\Client(['base_uri' => rtrim($litellmHost, '/'), 'timeout' => 60]);
$http = new \GuzzleHttp\Client(['base_uri' => rtrim($comfyuiHost, '/'), 'timeout' => 300]);

$workflow = json_decode(file_get_contents(__DIR__ . '/../comfyui-workflow.json'), true);

$results = [];

for ($i = 1; $i <= 20; $i++) {
  // Pick random models for this iteration
  $llmModel = $llmModels[array_rand($llmModels)];
  $imageModel = $imageModels[array_rand($imageModels)];

  echo "Generating image $i/@20...\n";
  echo "  LLM: $llmModel | Image: $imageModel\n";

  // Step 1: Generate a unique image prompt
  $response = $llmClient->post('/v1/chat/completions', [
    'headers' => ['Authorization' => "Bearer $apiKey"],
    'json' => [
      'model' => $llmModel,
      'messages' => [
        ['role' => 'user', 'content' => 'Write a short image prompt (3-4 sentences) for a realistic historical scene. Pick any era/place randomly - ancient civilizations, medieval times, renaissance, industrial revolution, early 20th century, etc. Cover all continents and cultures. Describe it simply like a photograph caption - no flowery language, no "8k cinematic unreal engine" nonsense. Just: what, where, when, lighting. If there are people, describe them in detail in era-specific clothing. Be creative and diverse. Output ONLY the prompt, nothing else.'],
      ],
    ],
  ]);

  $llmResult = json_decode($response->getBody()->getContents(), true);
  $imagePrompt = trim($llmResult['choices'][0]['message']['content']);

  echo "  Prompt: " . substr($imagePrompt, 0, 80) . "...\n";

  // Step 2: Inject prompt and model into workflow
  $currentWorkflow = $workflow;
  $currentWorkflow['6']['inputs']['text'] = $imagePrompt;
  $currentWorkflow['16']['inputs']['unet_name'] = $imageModel;

  // Step 3: Queue in ComfyUI
  $response = $http->post('/prompt', ['json' => ['prompt' => $currentWorkflow]]);
  $result = json_decode($response->getBody()->getContents(), true);
  $promptId = $result['prompt_id'];

  // Step 4: Poll for completion
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

  // Step 5: Download the image
  $imageUrl = '/view?' . http_build_query([
    'filename' => $outputImage['filename'],
    'subfolder' => $outputImage['subfolder'] ?? '',
    'type' => $outputImage['type'] ?? 'output',
  ]);

  $imageResponse = $http->get($imageUrl);
  $imageData = $imageResponse->getBody()->getContents();

  // Step 6: Save to disk (overwrites existing)
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
  ];

  echo "  Saved: $filename\n";
}

// Save metadata (overwrites existing)
$metadataFile = $outputDir . '/metadata.json';
file_put_contents($metadataFile, json_encode($results, JSON_PRETTY_PRINT));

echo "\n=== Generation Complete ===\n";
echo "Generated " . count($results) . " images\n";
echo "Output directory: $outputDir\n";
echo "Metadata saved to: $metadataFile\n";

