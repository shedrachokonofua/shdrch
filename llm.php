<?php
require_once __DIR__ . '/vendor/autoload.php';

$apiKey = getenv('LITELLM_API_KEY');
$litellmHost = getenv('LITELLM_HOST');

$client = OpenAI::factory()
  ->withApiKey($apiKey)
  ->withBaseUri(rtrim($litellmHost, '/') . '/v1')
  ->withHttpClient(new \GuzzleHttp\Client(['timeout' => 60]))
  ->make();

$response = $client->chat()->create([
  'model' => 'aether/qwen3:8b',
  'messages' => [
    ['role' => 'user', 'content' => 'Respond with a JSON object containing your greeting and current mood. Include keys: "greeting" and "mood".'],
  ],
  'response_format' => ['type' => 'json_object'],
]);

$json = $response->choices[0]->message->content;
echo $json . "\n";

// Parse it if you need to work with the data
$data = json_decode($json, true);
print_r($data);
