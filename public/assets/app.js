function readStoredPosition(storageKey) {
  try {
    return JSON.parse(localStorage.getItem(storageKey));
  } catch {
    return null;
  }
}

function getViewportPadding(options) {
  if (typeof options.padding === "function") return options.padding();
  return options.padding ?? 0;
}

function computePosition(el, edgeAnchored = false) {
  const rect = el.getBoundingClientRect();
  const x = el.offsetLeft;
  const y = el.offsetTop;

  if (!edgeAnchored) return { x, y };

  const horizontalEdge = x + rect.width / 2 > window.innerWidth / 2 ? "right" : "left";
  const verticalEdge = y + rect.height / 2 > window.innerHeight / 2 ? "bottom" : "top";

  return {
    x,
    y,
    horizontalEdge,
    horizontalOffset: horizontalEdge === "right" ? window.innerWidth - x - rect.width : x,
    verticalEdge,
    verticalOffset: verticalEdge === "bottom" ? window.innerHeight - y - rect.height : y,
  };
}

function saveStoredPosition(el, storageKey, edgeAnchored = false) {
  const position = computePosition(el, edgeAnchored);
  localStorage.setItem(storageKey, JSON.stringify(position));
  return position;
}

function applyPosition(el, position, edgeAnchored = false) {
  if (!position) return;

  const rect = el.getBoundingClientRect();
  if (
    edgeAnchored &&
    position.horizontalEdge &&
    position.verticalEdge &&
    Number.isFinite(position.horizontalOffset) &&
    Number.isFinite(position.verticalOffset)
  ) {
    el.style.left = (
      position.horizontalEdge === "right"
        ? window.innerWidth - rect.width - position.horizontalOffset
        : position.horizontalOffset
    ) + "px";
    el.style.top = (
      position.verticalEdge === "bottom"
        ? window.innerHeight - rect.height - position.verticalOffset
        : position.verticalOffset
    ) + "px";
    return;
  }

  if (Number.isFinite(position.x)) el.style.left = position.x + "px";
  if (Number.isFinite(position.y)) el.style.top = position.y + "px";
}

function clampToViewport(el, padding = 0) {
  const rect = el.getBoundingClientRect();
  const maxX = window.innerWidth - rect.width - padding;
  const maxY = window.innerHeight - rect.height - padding;

  if (el.offsetLeft > maxX) el.style.left = Math.max(padding, maxX) + "px";
  if (el.offsetTop > maxY) el.style.top = Math.max(padding, maxY) + "px";
  if (el.offsetLeft < padding) el.style.left = padding + "px";
  if (el.offsetTop < padding) el.style.top = padding + "px";
}

function makeDraggable(el, storageKey, defaultPos, options = {}) {
  let isDragging = false;
  let startX, startY, initialX, initialY, activePointerId;
  let storedPosition = readStoredPosition(storageKey);

  if (storedPosition) {
    applyPosition(el, storedPosition, options.edgeAnchored);
  } else {
    el.style.left = defaultPos.left;
    el.style.top = defaultPos.top;
  }
  requestAnimationFrame(() => {
    clampToViewport(el, getViewportPadding(options));
    if (options.edgeAnchored) storedPosition = saveStoredPosition(el, storageKey, true);
  });

  el.addEventListener("pointerdown", (e) => {
    if (e.target.closest("a, button")) return;
    isDragging = true;
    activePointerId = e.pointerId;
    el.setPointerCapture(e.pointerId);
    el.classList.add("dragging");

    startX = e.clientX;
    startY = e.clientY;
    initialX = el.offsetLeft;
    initialY = el.offsetTop;
  });

  el.addEventListener("pointermove", (e) => {
    if (!isDragging || e.pointerId !== activePointerId) return;
    e.preventDefault();

    const padding = getViewportPadding(options);
    const rect = el.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width - padding;
    const maxY = window.innerHeight - rect.height - padding;

    const newX = Math.max(padding, Math.min(initialX + (e.clientX - startX), maxX));
    const newY = Math.max(padding, Math.min(initialY + (e.clientY - startY), maxY));

    el.style.left = newX + "px";
    el.style.top = newY + "px";
  });

  const endDrag = (e) => {
    if (!isDragging || e.pointerId !== activePointerId) return;
    isDragging = false;
    activePointerId = undefined;
    el.classList.remove("dragging");
    storedPosition = saveStoredPosition(el, storageKey, options.edgeAnchored);
  };
  el.addEventListener("pointerup", endDrag);
  el.addEventListener("pointercancel", endDrag);

  window.addEventListener("resize", () => {
    storedPosition = readStoredPosition(storageKey) || storedPosition;
    if (options.edgeAnchored) applyPosition(el, storedPosition, true);
    clampToViewport(el, getViewportPadding(options));
  });
}

// Responsive default positions
const isMobile = () => window.innerWidth < 640;
const getEdgePadding = () => isMobile() ? 12 : 24;
const getMainCardDefault = () => {
  const padding = isMobile() ? "1rem" : "2rem";
  return { left: padding, top: padding };
};

const getCreditCardDefault = () => {
  const el = document.querySelector(".image-credit");
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  const padding = getEdgePadding();
  return {
    left: Math.max(padding, window.innerWidth - rect.width - padding) + "px",
    top: Math.max(padding, window.innerHeight - rect.height - padding) + "px",
  };
};

function animatePositionReset(el, { left, top }) {
  el.style.transition = "left 0.3s ease, top 0.3s ease";
  el.style.left = left;
  el.style.top = top;
  setTimeout(() => (el.style.transition = ""), 300);
}

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
  makeDraggable(creditCard, creditStorageKey, getCreditCardDefault(), {
    edgeAnchored: true,
    padding: getEdgePadding,
  });

  creditToggle.addEventListener("click", () => {
    const expanded = creditCard.classList.toggle("expanded");
    creditToggleText.textContent = expanded ? "hide prompt" : "see prompt";
    creditToggleIcon.textContent = expanded ? "-" : "+";
    creditToggle.setAttribute("aria-expanded", String(expanded));
    creditToggle.setAttribute("aria-label", expanded ? "Hide prompt" : "See prompt");

    if (expanded) {
      collapsedCreditPos = computePosition(creditCard, true);
      applyPosition(creditCard, collapsedCreditPos, true);
    } else if (collapsedCreditPos) {
      applyPosition(creditCard, collapsedCreditPos, true);
    }

    requestAnimationFrame(() => {
      clampToViewport(creditCard, getEdgePadding());
      if (!expanded) saveStoredPosition(creditCard, creditStorageKey, true);
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
  menuBtn.setAttribute("aria-expanded", String(isOpen));
});

document.addEventListener("click", closeMenu);
menuDropdown.addEventListener("click", (e) => e.stopPropagation());

resetBtn.addEventListener("click", () => {
  localStorage.removeItem("mainCardPos");
  localStorage.removeItem(creditStorageKey);

  animatePositionReset(mainCard, getMainCardDefault());

  if (creditCard) {
    animatePositionReset(creditCard, getCreditCardDefault());
    saveStoredPosition(creditCard, creditStorageKey, true);
  }

  closeMenu();
});

// IP greeting
const ipEl = document.getElementById('ip');
fetch('https://1.1.1.1/cdn-cgi/trace')
  .then(r => r.text())
  .then(t => { ipEl.textContent = t.match(/^ip=(.+)$/m)[1]; })
  .catch(() => { ipEl.textContent = 'visitor'; });

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
  if (!pick) return;

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
