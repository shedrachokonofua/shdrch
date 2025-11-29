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
    ['role' => 'user', 'content' => 'Hello! How are you?'],
  ],
]);

echo $response->choices[0]->message->content;
