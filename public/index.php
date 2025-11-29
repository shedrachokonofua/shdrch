<?php
$ip = $_SERVER['HTTP_X_REAL_IP'] ?? $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$canonicalUrl = 'https://shdr.ch';
$siteName = 'shdrch';
$description = "Shedrach's personal corner of the internet.";

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
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
  <link rel="preload" as="image" href="<?php echo htmlspecialchars($backgroundImage, ENT_QUOTES, 'UTF-8'); ?>" fetchpriority="high">
  <?php endif; ?>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    html,
    body {
      height: 100%;
    }

    body {
      font-family: "JetBrains Mono", monospace;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      color: #f5f5f5;
      padding: 2rem;
      position: relative;
      overflow-x: hidden;
    }

    /* Background layer */
    .bg {
      position: fixed;
      inset: 0;
      z-index: -2;
      <?php if ($backgroundImage): ?>
        background: url('<?php echo htmlspecialchars($backgroundImage, ENT_QUOTES, 'UTF-8'); ?>') center/cover no-repeat;
      <?php else: ?>
        background: #0a0a0a;
      <?php endif; ?>
    }

    /* Overlay for readability */
    .overlay {
      position: fixed;
      inset: 0;
      z-index: -1;
      background: linear-gradient(135deg,
          rgba(0, 0, 0, 0.6) 0%,
          rgba(0, 0, 0, 0.4) 50%,
          rgba(0, 0, 0, 0.6) 100%);
      backdrop-filter: blur(0.5px);
    }

    .container {
      position: absolute;
      max-width: 420px;
      width: calc(100% - 4rem);
      padding: 2.5rem;
      background: rgba(0, 0, 0, 0.35);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      animation: fadeIn 0.8s ease-out;
      cursor: grab;
      user-select: none;
      touch-action: none;
    }

    .container:active {
      cursor: grabbing;
    }

    .container.dragging {
      opacity: 0.9;
      transition: none;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(10px);
      }

      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .greeting {
      font-size: 18px;
      font-weight: 400;
      color: #fff;
      margin-bottom: 2.5rem;
    }

    .greeting span {
      color: #34d399;
      text-shadow: 0 0 20px rgba(52, 211, 153, 0.3);
    }

    nav {
      margin-bottom: 3rem;
    }

    nav ul {
      list-style: none;
      display: flex;
      gap: 1.5rem;
    }

    nav a {
      color: rgba(255, 255, 255, 0.75);
      text-decoration: underline;
      text-underline-offset: 3px;
      text-decoration-color: rgba(255, 255, 255, 0.35);
      font-size: 18px;
      transition: all 0.15s ease;
    }

    nav a:hover {
      color: #fff;
      text-decoration-color: rgba(255, 255, 255, 0.6);
    }

    footer {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.4);
    }

    /* Image credit panel */
    .image-credit {
      position: absolute;
      max-width: 320px;
      padding: 1rem 1.25rem;
      background: rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      font-size: 11px;
      color: rgba(255, 255, 255, 0.5);
      line-height: 1.5;
      animation: slideUp 1s ease-out 0.3s both;
      cursor: grab;
      user-select: none;
      touch-action: none;
    }

    .image-credit:active {
      cursor: grabbing;
    }

    .image-credit.dragging {
      opacity: 0.9;
      transition: none;
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }

      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .image-credit .meta {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      margin-bottom: 0.75rem;
      font-size: 10px;
      color: rgba(255, 255, 255, 0.45);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .image-credit .meta .label {
      color: rgba(255, 255, 255, 0.2);
    }

    .image-credit .prompt {
      color: rgba(255, 255, 255, 0.55);
    }

    /* Responsive adjustments */
    @media (max-width: 640px) {
      nav ul {
        flex-wrap: wrap;
        gap: 1rem;
      }
    }
  </style>
</head>

<body>
  <div class="bg"></div>
  <div class="overlay"></div>

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
    <aside class="image-credit">
      <div class="meta">
        <?php if ($llmModel): ?>
          <span><span class="label">prompt model:</span>
            <?php echo htmlspecialchars(basename($llmModel), ENT_QUOTES, 'UTF-8'); ?></span>
        <?php endif; ?>
        <?php if ($imageModel): ?>
          <span><span class="label">image model:</span>
            <?php echo htmlspecialchars(str_replace('.safetensors', '', $imageModel), ENT_QUOTES, 'UTF-8'); ?></span>
        <?php endif; ?>
      </div>
      <p class="prompt"><?php echo htmlspecialchars($imagePrompt, ENT_QUOTES, 'UTF-8'); ?></p>
    </aside>
  <?php endif; ?>

  <script>
    function makeDraggable(el, storageKey, defaultPos) {
      let isDragging = false;
      let startX, startY, initialX, initialY;

      // Load saved position or use default
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const { x, y } = JSON.parse(saved);
        el.style.left = x + 'px';
        el.style.top = y + 'px';
      } else {
        el.style.left = defaultPos.left;
        el.style.top = defaultPos.top;
        if (defaultPos.right) el.style.right = defaultPos.right;
        if (defaultPos.bottom) el.style.bottom = defaultPos.bottom;
      }

      function onStart(e) {
        if (e.target.tagName === 'A') return;
        isDragging = true;
        el.classList.add('dragging');

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        startX = clientX;
        startY = clientY;
        initialX = el.offsetLeft;
        initialY = el.offsetTop;
      }

      function onMove(e) {
        if (!isDragging) return;
        e.preventDefault();

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        const dx = clientX - startX;
        const dy = clientY - startY;

        let newX = initialX + dx;
        let newY = initialY + dy;

        const rect = el.getBoundingClientRect();
        const maxX = window.innerWidth - rect.width;
        const maxY = window.innerHeight - rect.height;

        newX = Math.max(0, Math.min(newX, maxX));
        newY = Math.max(0, Math.min(newY, maxY));

        el.style.left = newX + 'px';
        el.style.top = newY + 'px';
      }

      function onEnd() {
        if (!isDragging) return;
        isDragging = false;
        el.classList.remove('dragging');

        localStorage.setItem(storageKey, JSON.stringify({
          x: el.offsetLeft,
          y: el.offsetTop
        }));
      }

      el.addEventListener('mousedown', onStart);
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onEnd);
      el.addEventListener('touchstart', onStart, { passive: false });
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('touchend', onEnd);

      window.addEventListener('resize', () => {
        const rect = el.getBoundingClientRect();
        const maxX = window.innerWidth - rect.width;
        const maxY = window.innerHeight - rect.height;

        if (el.offsetLeft > maxX) el.style.left = Math.max(0, maxX) + 'px';
        if (el.offsetTop > maxY) el.style.top = Math.max(0, maxY) + 'px';
      });
    }

    // Main card - top left
    const mainCard = document.querySelector('.container');
    makeDraggable(mainCard, 'mainCardPos', { left: '2rem', top: '2rem' });

    // Credit card - bottom right
    const creditCard = document.querySelector('.image-credit');
    if (creditCard) {
      const rect = creditCard.getBoundingClientRect();
      makeDraggable(creditCard, 'creditCardPos', {
        left: (window.innerWidth - rect.width - 24) + 'px',
        top: (window.innerHeight - rect.height - 24) + 'px'
      });
    }
  </script>
</body>

</html>
