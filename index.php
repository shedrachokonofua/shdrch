<?php
$ip = $_SERVER['HTTP_X_REAL_IP'] ?? $_SERVER['REMOTE_ADDR'] ?? 'unknown';
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>shdr.ch</title>
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
  <div class="container">
    <p class="greeting">$ hello <span><?php echo htmlspecialchars($ip, ENT_QUOTES, 'UTF-8'); ?></span></p>
    <nav>
      <ul>
        <li><a href="https://github.com/shedrachokonofua">github</a></li>
        <li><a href="https://linkedin.com/in/shdrch">linkedin</a></li>
        <li><a href="mailto:s@shdr.ch">email</a></li>
      </ul>
    </nav>
    <footer>served by aether</footer>
  </div>
</body>
</html>
