function makeDraggable(el, storageKey, defaultPos) {
  let isDragging = false;
  let startX, startY, initialX, initialY;

  // Load saved position or use default
  const saved = localStorage.getItem(storageKey);
  if (saved) {
    const { x, y } = JSON.parse(saved);
    el.style.left = x + "px";
    el.style.top = y + "px";
  } else {
    el.style.left = defaultPos.left;
    el.style.top = defaultPos.top;
  }

  function onStart(e) {
    if (e.target.closest("a, button")) return;
    isDragging = true;
    el.classList.add("dragging");

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

    el.style.left = newX + "px";
    el.style.top = newY + "px";
  }

  function onEnd() {
    if (!isDragging) return;
    isDragging = false;
    el.classList.remove("dragging");

    localStorage.setItem(
      storageKey,
      JSON.stringify({
        x: el.offsetLeft,
        y: el.offsetTop,
      })
    );
  }

  el.addEventListener("mousedown", onStart);
  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onEnd);
  el.addEventListener("touchstart", onStart, { passive: false });
  document.addEventListener("touchmove", onMove, { passive: false });
  document.addEventListener("touchend", onEnd);

  window.addEventListener("resize", () => {
    clampToViewport(el);
  });
}

function clampToViewport(el) {
    const rect = el.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width;
    const maxY = window.innerHeight - rect.height;

    if (el.offsetLeft > maxX) el.style.left = Math.max(0, maxX) + "px";
    if (el.offsetTop > maxY) el.style.top = Math.max(0, maxY) + "px";
    if (el.offsetLeft < 0) el.style.left = "0px";
    if (el.offsetTop < 0) el.style.top = "0px";
}

// Responsive default positions
const isMobile = () => window.innerWidth < 640;
const getMainCardDefault = () => {
  const padding = isMobile() ? "1rem" : "2rem";
  return { left: padding, top: padding };
};

const getCreditCardDefault = () => {
  const el = document.querySelector(".image-credit");
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  const padding = isMobile() ? 12 : 24;
  return {
    left: Math.max(padding, window.innerWidth - rect.width - padding) + "px",
    top: Math.max(padding, window.innerHeight - rect.height - padding) + "px",
  };
};

// Main card - top left
const mainCard = document.querySelector(".container");
makeDraggable(mainCard, "mainCardPos", getMainCardDefault());

// Credit card - bottom right
const creditCard = document.querySelector(".image-credit");
const creditToggle = document.getElementById("creditToggle");
const creditToggleText = document.getElementById("creditToggleText");
const creditToggleIcon = document.getElementById("creditToggleIcon");
const creditStorageKey = "creditCardPos";
let collapsedCreditPos = null;
if (creditCard) {
  makeDraggable(creditCard, creditStorageKey, getCreditCardDefault());
}

if (creditCard && creditToggle) {
  creditToggle.addEventListener("click", () => {
    const expanded = creditCard.classList.toggle("expanded");
    creditToggleText.textContent = expanded ? "hide prompt" : "see prompt";
    creditToggleIcon.textContent = expanded ? "-" : "+";
    creditToggle.setAttribute("aria-expanded", String(expanded));
    creditToggle.setAttribute("aria-label", expanded ? "Hide prompt" : "See prompt");

    if (expanded) {
      collapsedCreditPos = {
        left: creditCard.style.left,
        top: creditCard.style.top,
      };
      creditCard.style.left = Math.min(
        creditCard.offsetLeft,
        Math.max(0, window.innerWidth - creditCard.getBoundingClientRect().width)
      ) + "px";
    } else if (collapsedCreditPos) {
      creditCard.style.left = collapsedCreditPos.left;
      creditCard.style.top = collapsedCreditPos.top;
    }

    requestAnimationFrame(() => {
      clampToViewport(creditCard);
      if (!expanded) {
        localStorage.setItem(
          creditStorageKey,
          JSON.stringify({
            x: creditCard.offsetLeft,
            y: creditCard.offsetTop,
          })
        );
      }
    });
  });
}

// Menu functionality
const menuBtn = document.getElementById("menuBtn");
const menuDropdown = document.getElementById("menuDropdown");
const resetBtn = document.getElementById("resetBtn");
const shuffleBtn = document.getElementById("shuffleBtn");

function closeMenu() {
  menuDropdown.classList.remove("show");
  menuBtn.classList.remove("open");
  menuBtn.setAttribute("aria-expanded", "false");
}

menuBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  const isOpen = menuDropdown.classList.toggle("show");
  menuBtn.classList.toggle("open", isOpen);
  menuBtn.setAttribute("aria-expanded", isOpen);
});

// Close menu when clicking outside
document.addEventListener("click", () => {
  closeMenu();
});

menuDropdown.addEventListener("click", (e) => {
  e.stopPropagation();
});

// Reset positions (no page reload)
resetBtn.addEventListener("click", () => {
  localStorage.removeItem("mainCardPos");
  localStorage.removeItem("creditCardPos");

  // Reset main card
  const mainDefault = getMainCardDefault();
  mainCard.style.transition = "left 0.3s ease, top 0.3s ease";
  mainCard.style.left = mainDefault.left;
  mainCard.style.top = mainDefault.top;
  setTimeout(() => (mainCard.style.transition = ""), 300);

  // Reset credit card
  if (creditCard) {
    const creditDefault = getCreditCardDefault();
    creditCard.style.transition = "left 0.3s ease, top 0.3s ease";
    creditCard.style.left = creditDefault.left;
    creditCard.style.top = creditDefault.top;
    setTimeout(() => (creditCard.style.transition = ""), 300);
  }

  closeMenu();
});

// IP greeting
fetch('https://1.1.1.1/cdn-cgi/trace')
  .then(r => r.text())
  .then(t => { document.getElementById('ip').textContent = t.match(/^ip=(.+)$/m)[1]; })
  .catch(() => { document.getElementById('ip').textContent = 'visitor'; });

// Random background + credit
const siteAssetUrl = path => new URL(path, document.baseURI).toString();
const bg = document.querySelector('.bg');
const promptModelEl = document.getElementById('prompt-model');
const imageModelEl = document.getElementById('image-model');
const promptTextEl = document.getElementById('prompt-text');
let imageManifest = [];
let currentImageFilename = null;
let backgroundLoadId = 0;

function pickRandomImage() {
  if (!imageManifest.length) return null;
  const candidates = imageManifest.length > 1
    ? imageManifest.filter(image => image.filename !== currentImageFilename)
    : imageManifest;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function setBackground(pick) {
  if (!pick || !bg) return;

  const imageUrl = siteAssetUrl(`images/${pick.filename}`);
  const preload = new Image();
  const loadId = ++backgroundLoadId;

  bg.classList.remove('loaded');
  preload.decoding = 'async';
  preload.onload = () => {
    if (loadId !== backgroundLoadId) return;

    currentImageFilename = pick.filename;
    bg.style.setProperty('--bg-image', `url('${imageUrl}')`);
    bg.classList.add('loaded');
    promptModelEl.textContent = pick.llm_model.split('/').pop();
    imageModelEl.textContent = pick.image_model.replace('.safetensors', '');
    promptTextEl.textContent = pick.prompt;
  };
  preload.onerror = () => {
    if (loadId === backgroundLoadId) bg.classList.add('loaded');
  };
  preload.src = imageUrl;
}

shuffleBtn.addEventListener("click", () => {
  setBackground(pickRandomImage());
  closeMenu();
});

fetch(siteAssetUrl('images/manifest.json'))
  .then(r => r.json())
  .then(manifest => {
    imageManifest = manifest;
    setBackground(pickRandomImage());
  })
  .catch(() => { /* manifest not seeded yet — page renders without background */ });
