<?php
$ip = $_SERVER['HTTP_X_REAL_IP'] ?? $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$canonicalUrl = 'https://shdr.ch';
$siteName = 'shdrch';
$description = "Shedrach's personal corner of the internet.";
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

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: "JetBrains Mono", monospace;
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      background: #fafafa;
      color: #171717;
      padding: 2rem;
    }

    .container {
      max-width: 400px;
      width: 100%;
    }

    .greeting {
      font-size: 18px;
      font-weight: 400;
      color: #525252;
      margin-bottom: 2.5rem;
    }

    .greeting span {
      color: #059669;
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
      color: #737373;
      text-decoration: underline;
      text-underline-offset: 3px;
      font-size: 18px;
      transition: color 0.2s;
    }

    nav a:hover {
      color: #171717;
    }

    footer {
      font-size: 13px;
      color: #a3a3a3;
    }
  </style>
</head>

<body>
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
</body>

</html>
