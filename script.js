/**
 * CyberPou - State & Game Logic Engine
 */

// --- STATE MANAGEMENT ---
const state = {
  pet: {
    name: "Pou",
    level: 1,
    xp: 0,
    coins: 100,
    hunger: 80,
    energy: 90,
    hygiene: 70,
    happiness: 85,
    isSleeping: false,
    color: "#b5835a",
    equippedHat: null,
    equippedGlasses: null
  },
  inventory: {
    colors: ["#b5835a"],
    hats: [],
    glasses: []
  },
  currentRoom: "kitchen",
  poopCount: 1,
  activeTool: null // Digunakan di kamar mandi (soap / shower)
};

// --- WEB AUDIO API (SYNTH SOUND GENERATOR) ---
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function initAudio() {
  if (!audioCtx) audioCtx = new AudioCtx();
}

function playSound(type) {
  try {
    initAudio();
    if (!audioCtx) return;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const now = audioCtx.currentTime;

    if (type === "eat") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.1);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
    } else if (type === "clean") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.linearRampToValueAtTime(800, now + 0.2);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (type === "coin") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(987.77, now); // B5
      osc.frequency.setValueAtTime(1318.51, now + 0.08); // E6
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === "click") {
      osc.type = "square";
      osc.frequency.setValueAtTime(400, now);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    }
  } catch (e) {
    console.error("Audio error", e);
  }
}

// --- CATALOG DATA ---
const FOODS = [
  { id: "apple", name: "Apel", hunger: 15, happy: 5, price: 5, icon: "🍎" },
  { id: "burger", name: "Burger", hunger: 35, happy: 10, price: 15, icon: "🍔" },
  { id: "cake", name: "Kue", hunger: 20, happy: 25, price: 20, icon: "🍰" },
  { id: "potion", name: "Obat", hunger: 0, happy: 10, price: 25, icon: "🧪", heal: 40 }
];

const SHOP_ITEMS = {
  colors: [
    { id: "#b5835a", name: "Cokelat Classic", price: 0 },
    { id: "#ef4444", name: "Merah Cabai", price: 50 },
    { id: "#3b82f6", name: "Biru Cerah", price: 50 },
    { id: "#10b981", name: "Hijau Mint", price: 75 },
    { id: "#a855f7", name: "Ungu Magic", price: 100 }
  ],
  hats: [
    { id: "red_hat", name: "Topi Merah", price: 60 }
  ],
  glasses: [
    { id: "cool_glasses", name: "Kacamata Hitam", price: 80 }
  ]
};

// --- DOM ELEMENTS ---
const elements = {
  viewport: document.getElementById("room-viewport"),
  roomTitle: document.getElementById("room-title"),
  actionDock: document.getElementById("action-dock"),
  petBody: document.getElementById("pet-body"),
  petMouth: document.getElementById("pet-mouth"),
  pupilLeft: document.getElementById("pupil-left"),
  pupilRight: document.getElementById("pupil-right"),
  accHat: document.getElementById("acc-hat"),
  accGlasses: document.getElementById("acc-glasses"),
  nightOverlay: document.getElementById("night-overlay"),
  poopContainer: document.getElementById("poop-container"),
  fxLayer: document.getElementById("fx-layer"),
  coinCount: document.getElementById("coin-count"),
  levelBadge: document.getElementById("level-badge"),
  xpBar: document.getElementById("xp-bar"),
  petAvatar: document.getElementById("pet-avatar")
};

// --- INITIALIZATION & EVENT LISTENERS ---
document.addEventListener("DOMContentLoaded", () => {
  loadData();
  setupNavigation();
  setupShop();
  updateUI();
  renderRoom();
  renderPoops();

  // Start Idle Animation
  elements.petAvatar.classList.add("pet-idle-anim");

  // Pet Click Interaction
  elements.petAvatar.addEventListener("click", () => {
    playSound("click");
    triggerPetReaction("happy");
    addXP(2);
    createFloatingText("❤️ +1", event.clientX, event.clientY);
  });

  // Track Mouse Movement for Eye Tracking
  window.addEventListener("mousemove", (e) => {
    const rect = elements.petAvatar.getBoundingClientRect();
    const petCenterX = rect.left + rect.width / 2;
    const petCenterY = rect.top + rect.height / 2;
    
    const angle = Math.atan2(e.clientY - petCenterY, e.clientX - petCenterX);
    const distance = Math.min(4, Math.hypot(e.clientX - petCenterX, e.clientY - petCenterY) / 30);
    
    const offsetX = Math.cos(angle) * distance;
    const offsetY = Math.sin(angle) * distance;

    elements.pupilLeft.setAttribute("cx", 75 + offsetX);
    elements.pupilLeft.setAttribute("cy", 85 + offsetY);
    elements.pupilRight.setAttribute("cx", 125 + offsetX);
    elements.pupilRight.setAttribute("cy", 85 + offsetY);
  });

  // Game Loop Ticks
  setInterval(gameTick, 4000); // Stat Decay
  setInterval(saveData, 10000); // Auto-save
});

// --- ROOM NAVIGATION ---
function setupNavigation() {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      playSound("click");
      document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.currentRoom = btn.dataset.room;
      renderRoom();
    });
  });
}

function renderRoom() {
  // Reset room styles
  elements.viewport.className = `relative flex-1 overflow-hidden flex flex-col items-center justify-between p-4 transition-colors duration-700 room-${state.currentRoom}`;
  
  // Close Shop if open
  document.getElementById("shop-modal").classList.add("hidden");
  
  const roomNames = {
    kitchen: "Dapur",
    bathroom: "Kamar Mandi",
    bedroom: "Kamar Tidur",
    playroom: "Ruang Bermain",
    wardrobe: "Lemari Pakaian"
  };
  
  elements.roomTitle.textContent = roomNames[state.currentRoom] || "Ruangan";
  elements.actionDock.innerHTML = "";

  // Render Action Dock per Room
  if (state.currentRoom === "kitchen") {
    FOODS.forEach((food) => {
      const btn = document.createElement("button");
      btn.className = "flex flex-col items-center justify-center p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-600/50 min-w-[60px] transition active:scale-95";
      btn.innerHTML = `
        <span class="text-2xl">${food.icon}</span>
        <span class="text-[10px] font-bold text-amber-300 mt-1">💰${food.price}</span>
      `;
      btn.onclick = () => feedPet(food);
      elements.actionDock.appendChild(btn);
    });
  } else if (state.currentRoom === "bathroom") {
    const soapBtn = document.createElement("button");
    soapBtn.className = "px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg transition";
    soapBtn.innerHTML = `<i class="fa-solid fa-soap text-lg"></i> Mandikan Spon`;
    soapBtn.onclick = () => cleanPet();
    elements.actionDock.appendChild(soapBtn);
  } else if (state.currentRoom === "bedroom") {
    const sleepBtn = document.createElement("button");
    sleepBtn.className = "px-6 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg transition";
    sleepBtn.innerHTML = `<i class="fa-solid fa-moon"></i> ${state.pet.isSleeping ? 'Bangunkan' : 'Matikan Lampu'}`;
    sleepBtn.onclick = () => toggleSleep();
    elements.actionDock.appendChild(sleepBtn);
  } else if (state.currentRoom === "playroom") {
    const playBtn = document.createElement("button");
    playBtn.className = "px-6 py-2 bg-pink-600 hover:bg-pink-500 rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg transition animate-bounce";
    playBtn.innerHTML = `<i class="fa-solid fa-gamepad text-lg"></i> Main Minigame`;
    playBtn.onclick = () => startMinigame();
    elements.actionDock.appendChild(playBtn);
  } else if (state.currentRoom === "wardrobe") {
    const shopBtn = document.createElement("button");
    shopBtn.className = "px-6 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl flex items-center gap-2 shadow-lg transition";
    shopBtn.innerHTML = `<i class="fa-solid fa-store text-lg"></i> Buka Toko`;
    shopBtn.onclick = () => {
      document.getElementById("shop-modal").classList.remove("hidden");
      document.getElementById("shop-modal").classList.add("flex");
    };
    elements.actionDock.appendChild(shopBtn);
  }
}

// --- GAME MECHANICS ---
function feedPet(food) {
  if (state.pet.coins < food.price) {
    alert("Koin tidak cukup!");
    return;
  }
  
  state.pet.coins -= food.price;
  state.pet.hunger = Math.min(100, state.pet.hunger + food.hunger);
  state.pet.happiness = Math.min(100, state.pet.happiness + food.happy);
  if (food.heal) state.pet.hygiene = Math.min(100, state.pet.hygiene + food.heal);

  playSound("eat");
  triggerPetReaction("eat");
  addXP(5);
  updateUI();
}

function cleanPet() {
  if (state.pet.hygiene >= 100 && state.poopCount === 0) return;
  
  state.pet.hygiene = 100;
  state.poopCount = 0;
  playSound("clean");
  triggerPetReaction("happy");
  renderPoops();
  addXP(10);
  updateUI();

  // Create Soap Bubbles Animation
  for (let i = 0; i < 8; i++) {
    const b = document.createElement("div");
    b.className = "bubble";
    b.style.left = `${Math.random() * 80 + 10}%`;
    b.style.top = `${Math.random() * 80 + 10}%`;
    b.style.width = `${Math.random() * 20 + 10}px`;
    b.style.height = b.style.width;
    elements.viewport.appendChild(b);
    setTimeout(() => b.remove(), 800);
  }
}

function toggleSleep() {
  state.pet.isSleeping = !state.pet.isSleeping;
  elements.nightOverlay.style.opacity = state.pet.isSleeping ? "1" : "0";
  playSound("click");
  renderRoom();
}

function triggerPetReaction(type) {
  if (type === "happy" || type === "eat") {
    elements.petMouth.setAttribute("d", "M 75 115 Q 100 145 125 115 Z"); // Senyum Lebar
    elements.petMouth.setAttribute("fill", "#523218");
    setTimeout(() => {
      elements.petMouth.setAttribute("d", "M 85 120 Q 100 135 115 120");
      elements.petMouth.setAttribute("fill", "none");
    }, 1200);
  }
}

function gameTick() {
  if (state.pet.isSleeping) {
    state.pet.energy = Math.min(100, state.pet.energy + 8);
    if (state.pet.energy >= 100) toggleSleep();
  } else {
    state.pet.hunger = Math.max(0, state.pet.hunger - 2);
    state.pet.energy = Math.max(0, state.pet.energy - 1);
    state.pet.hygiene = Math.max(0, state.pet.hygiene - 1);
    state.pet.happiness = Math.max(0, state.pet.happiness - 2);
  }

  // Random Poop Generation
  if (Math.random() < 0.1 && state.poopCount < 3 && !state.pet.isSleeping) {
    state.poopCount++;
    renderPoops();
  }

  updateUI();
}

function renderPoops() {
  elements.poopContainer.innerHTML = "";
  for (let i = 0; i < state.poopCount; i++) {
    const poop = document.createElement("div");
    poop.className = "text-2xl cursor-pointer hover:scale-125 transition transform";
    poop.innerHTML = "💩";
    poop.onclick = (e) => {
      e.stopPropagation();
      state.poopCount--;
      state.pet.coins += 5;
      playSound("coin");
      renderPoops();
      updateUI();
    };
    elements.poopContainer.appendChild(poop);
  }
}

function addXP(amount) {
  state.pet.xp += amount;
  if (state.pet.xp >= 100) {
    state.pet.level++;
    state.pet.xp = 0;
    state.pet.coins += 50;
    playSound("coin");
    alert(`🎉 Level Up! Pou naik ke level ${state.pet.level}! Hadiah: 50 Koin.`);
  }
  updateUI();
}

function updateUI() {
  document.getElementById("stat-hunger-num").textContent = state.pet.hunger;
  document.getElementById("stat-hunger-bar").style.width = `${state.pet.hunger}%`;

  document.getElementById("stat-energy-num").textContent = state.pet.energy;
  document.getElementById("stat-energy-bar").style.width = `${state.pet.energy}%`;

  document.getElementById("stat-hygiene-num").textContent = state.pet.hygiene;
  document.getElementById("stat-hygiene-bar").style.width = `${state.pet.hygiene}%`;

  document.getElementById("stat-happy-num").textContent = state.pet.happiness;
  document.getElementById("stat-happy-bar").style.width = `${state.pet.happiness}%`;

  elements.coinCount.textContent = state.pet.coins;
  elements.levelBadge.textContent = state.pet.level;
  elements.xpBar.style.width = `${state.pet.xp}%`;

  // Apply Colors & Accessories
  elements.petBody.setAttribute("fill", state.pet.color);

  if (state.pet.equippedHat) elements.accHat.classList.remove("hidden");
  else elements.accHat.classList.add("hidden");

  if (state.pet.equippedGlasses) elements.accGlasses.classList.remove("hidden");
  else elements.accGlasses.classList.add("hidden");
}

function createFloatingText(text, x, y) {
  const el = document.createElement("div");
  el.className = "absolute font-black text-pink-400 pointer-events-none z-50 animate-float";
  el.textContent = text;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

// --- SHOP & WARDROBE ---
function setupShop() {
  document.getElementById("close-shop-btn").onclick = () => {
    document.getElementById("shop-modal").classList.add("hidden");
  };

  const grid = document.getElementById("shop-grid");

  const renderShopCategory = (cat) => {
    grid.innerHTML = "";
    SHOP_ITEMS[cat].forEach((item) => {
      const isOwned = cat === "colors" ? state.inventory.colors.includes(item.id) : state.inventory[cat].includes(item.id);
      const isEquipped = state.pet.color === item.id || state.pet.equippedHat === item.id || state.pet.equippedGlasses === item.id;

      const card = document.createElement("div");
      card.className = "bg-slate-800 p-3 rounded-xl border border-slate-700 flex flex-col items-center justify-between text-center";
      card.innerHTML = `
        <div class="w-10 h-10 rounded-full mb-2 border-2 border-slate-600 flex items-center justify-center" style="background:${cat === 'colors' ? item.id : '#334155'}">
          ${cat !== 'colors' ? '👑' : ''}
        </div>
        <div class="text-xs font-bold mb-1">${item.name}</div>
        <button class="w-full py-1 text-[11px] font-bold rounded-lg transition ${
          isEquipped ? 'bg-emerald-600 text-white' : isOwned ? 'bg-blue-600 hover:bg-blue-500' : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
        }">
          ${isEquipped ? 'Pakai' : isOwned ? 'Gunakan' : `Beli 💰${item.price}`}
        </button>
      `;

      card.querySelector("button").onclick = () => {
        if (isOwned) {
          if (cat === "colors") state.pet.color = item.id;
          if (cat === "hats") state.pet.equippedHat = state.pet.equippedHat === item.id ? null : item.id;
          if (cat === "glasses") state.pet.equippedGlasses = state.pet.equippedGlasses === item.id ? null : item.id;
        } else {
          if (state.pet.coins >= item.price) {
            state.pet.coins -= item.price;
            state.inventory[cat].push(item.id);
            playSound("coin");
          } else {
            alert("Koin tidak cukup!");
          }
        }
        updateUI();
        renderShopCategory(cat);
      };

      grid.appendChild(card);
    });
  };

  document.getElementById("tab-colors").onclick = (e) => { switchTab(e, "colors"); };
  document.getElementById("tab-hats").onclick = (e) => { switchTab(e, "hats"); };
  document.getElementById("tab-glasses").onclick = (e) => { switchTab(e, "glasses"); };

  function switchTab(e, cat) {
    document.querySelectorAll(".shop-tab").forEach(t => t.classList.remove("active"));
    e.target.classList.add("active");
    renderShopCategory(cat);
  }

  renderShopCategory("colors");
}

// --- MINIGAME ENGINE (CANVAS 2D) ---
function startMinigame() {
  const modal = document.getElementById("minigame-screen");
  modal.classList.remove("hidden");
  modal.classList.add("flex");

  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");
  
  canvas.width = canvas.parentElement.clientWidth;
  canvas.height = canvas.parentElement.clientHeight;

  let score = 0;
  let gameOver = false;
  let basketX = canvas.width / 2 - 35;
  const items = [];

  document.getElementById("game-score").textContent = score;

  const handleTouch = (e) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    basketX = clientX - rect.left - 35;
  };

  canvas.addEventListener("mousemove", handleTouch);
  canvas.addEventListener("touchmove", handleTouch);

  function spawnItem() {
    items.push({
      x: Math.random() * (canvas.width - 30),
      y: -30,
      speed: 3 + Math.random() * 3,
      icon: ["🍎", "🍔", "🍰"][Math.floor(Math.random() * 3)]
    });
  }

  const spawner = setInterval(spawnItem, 800);

  function gameLoop() {
    if (gameOver) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Basket
    ctx.font = "40px sans-serif";
    ctx.fillText("🧺", basketX, canvas.height - 20);

    // Update & Draw Items
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      it.y += it.speed;
      ctx.fillText(it.icon, it.x, it.y);

      // Collision Check
      if (it.y >= canvas.height - 60 && it.y <= canvas.height - 20 && it.x >= basketX - 20 && it.x <= basketX + 60) {
        score += 10;
        document.getElementById("game-score").textContent = score;
        playSound("coin");
        items.splice(i, 1);
        continue;
      }

      // Missed Item
      if (it.y > canvas.height) {
        items.splice(i, 1);
      }
    }

    requestAnimationFrame(gameLoop);
  }

  requestAnimationFrame(gameLoop);

  document.getElementById("close-game-btn").onclick = () => {
    gameOver = true;
    clearInterval(spawner);
    modal.classList.add("hidden");
    state.pet.coins += score / 2;
    state.pet.happiness = Math.min(100, state.pet.happiness + 20);
    updateUI();
  };
}

// --- LOCAL STORAGE PERSISTENCE ---
function saveData() {
  localStorage.setItem("cyberpou_save", JSON.stringify({ state }));
}

function loadData() {
  const saved = localStorage.getItem("cyberpou_save");
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      Object.assign(state.pet, parsed.state.pet);
      Object.assign(state.inventory, parsed.state.inventory);
    } catch (e) {
      console.error("Failed to load save", e);
    }
  }
}
