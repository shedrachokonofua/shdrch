<?php
$ip = $_SERVER['HTTP_X_REAL_IP'] ?? $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$canonicalUrl = 'https://shdr.ch';
$siteName = 'shdrch';
$description = "Shedrach's home page.";

// Load generated images metadata
$imageDir = __DIR__ . '/../storage/images';
$metadataFile = $imageDir . '/metadata.json';
$backgroundImage = null;
$imagePrompt = null;
$llmModel = null;
$imageModel = null;

if (file_exists($metadataFile)) {
  $metadata = json_decode(file_get_contents($metadataFile), true);
  if (!empty($metadata)) {
    // Pick a random image from the generated set
    $selected = $metadata[array_rand($metadata)];
    $backgroundImage = '/images/' . $selected['filename'];
    $imagePrompt = $selected['prompt'] ?? null;
    $llmModel = $selected['llm_model'] ?? null;
    $imageModel = $selected['image_model'] ?? null;
  }
} else {
  // Fallback: check for any images in the directory
  $images = glob($imageDir . '/image_*.png');
  if (!empty($images)) {
    $selected = $images[array_rand($images)];
    $backgroundImage = '/images/' . basename($selected);
  }
}
?>
<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title><?php echo $siteName; ?></title>
  <meta name="description" content="<?php echo $description; ?>">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="<?php echo $canonicalUrl; ?>">

  <meta property="og:type" content="website">
  <meta property="og:url" content="<?php echo $canonicalUrl; ?>">
  <meta property="og:title" content="<?php echo $siteName; ?>">
  <meta property="og:description" content="<?php echo $description; ?>">
  <meta property="og:site_name" content="<?php echo $siteName; ?>">

  <meta name="twitter:card" content="summary">
  <meta name="twitter:url" content="<?php echo $canonicalUrl; ?>">
  <meta name="twitter:title" content="<?php echo $siteName; ?>">
  <meta name="twitter:description" content="<?php echo $description; ?>">

  <meta name="theme-color" content="#0a0a0a">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Person",
    "name": "<?php echo $siteName; ?>",
    "url": "<?php echo $canonicalUrl; ?>",
    "sameAs": [
      "https://github.com/shedrachokonofua",
      "https://linkedin.com/in/shdrch"
    ],
    "email": "s@shdr.ch",
    "jobTitle": "Software Engineer"
  }
  </script>

  <?php if ($backgroundImage): ?>
    <link rel="preload" as="image" href="<?php echo htmlspecialchars($backgroundImage, ENT_QUOTES, 'UTF-8'); ?>"
      fetchpriority="high">
  <?php endif; ?>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/assets/styles.css">
</head>

<body>
  <?php include __DIR__ . '/assets/icons.svg'; ?>

  <div class="bg" <?php if ($backgroundImage): ?>style="--bg-image: url('<?php echo htmlspecialchars($backgroundImage, ENT_QUOTES, 'UTF-8'); ?>')" <?php endif; ?>>
  </div>
  <div class="overlay"></div>

  <!-- Menu button -->
  <button class="menu-btn" id="menuBtn" aria-label="Menu" aria-expanded="false">
    <svg>
      <use href="#icon-menu" />
    </svg>
  </button>

  <div class="menu-dropdown" id="menuDropdown">
    <button id="resetBtn">
      <svg>
        <use href="#icon-reset" />
      </svg>
      reset positions
    </button>
    <button id="shuffleBtn">
      <svg>
        <use href="#icon-shuffle" />
      </svg>
      shuffle background
    </button>
  </div>

  <main class="container" itemscope itemtype="https://schema.org/Person">
    <h1 class="greeting">$ hello, <span><?php echo htmlspecialchars($ip, ENT_QUOTES, 'UTF-8'); ?></span></h1>
    <meta itemprop="name" content="<?php echo $siteName; ?>">
    <nav aria-label="Social links">
      <ul>
        <li>
          <a class="link" href="https://github.com/shedrachokonofua" rel="me noopener" target="_blank" itemprop="sameAs"
            aria-label="GitHub profile">
            github
          </a>
        </li>
        <li>
          <a href="https://linkedin.com/in/shdrch" rel="me noopener" target="_blank" itemprop="sameAs"
            aria-label="LinkedIn profile">
            linkedin
          </a>
        </li>
        <li>
          <a href="mailto:s@shdr.ch" itemprop="email" aria-label="Send email">
            email
          </a>
        </li>
      </ul>
    </nav>
    <footer>served by aether</footer>
  </main>

  <?php if ($imagePrompt): ?>
    <aside class="image-credit" title="This background was AI-generated">
      <div class="meta">
        <span><span class="label">prompt model:</span>
          <?php echo htmlspecialchars(basename($llmModel), ENT_QUOTES, 'UTF-8'); ?></span>
        <span><span class="label">image model:</span>
          <?php echo htmlspecialchars(str_replace('.safetensors', '', $imageModel), ENT_QUOTES, 'UTF-8'); ?></span>
      </div>
      <p class="prompt"><?php echo htmlspecialchars($imagePrompt, ENT_QUOTES, 'UTF-8'); ?></p>
    </aside>
  <?php endif; ?>

  <script src="/assets/app.js"></script>
</body>

</html>
