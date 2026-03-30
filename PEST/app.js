// ============================================================
//  PEST SPREAD PREDICTION SYSTEM — app.js
// ============================================================

// ---- DATA ----
const CROPS = [
  { id: "rice",      en: "Rice",      te: "వరి",       icon: "🌾", resistance: 0.2 },
  { id: "cotton",    en: "Cotton",    te: "పత్తి",     icon: "🌿", resistance: 0.3 },
  { id: "chilli",    en: "Chilli",    te: "మిర్చి",    icon: "🌶️", resistance: 0.1 },
  { id: "maize",     en: "Maize",     te: "మొక్కజొన్న", icon: "🌽", resistance: 0.4 },
  { id: "groundnut", en: "Groundnut", te: "వేరుసెనగ",  icon: "🥜", resistance: 0.3 },
  { id: "tomato",    en: "Tomato",    te: "టమాట",      icon: "🍅", resistance: 0.2 },
];

const FIELD_SIZES = [
  { id: "small",  en: "Small (1 Acre)",  te: "చిన్న (1 ఎకరం)",      grid: 8  },
  { id: "medium", en: "Medium (3 Acres)", te: "మధ్యమ (3 ఎకరాలు)",  grid: 10 },
  { id: "large",  en: "Large (5+ Acres)", te: "పెద్ద (5+ ఎకరాలు)", grid: 12 },
];

const DIRECTIONS = [
  { id: "north",  en: "North",  te: "ఉత్తరం",   icon: "⬆️" },
  { id: "south",  en: "South",  te: "దక్షిణం",  icon: "⬇️" },
  { id: "east",   en: "East",   te: "తూర్పు",   icon: "➡️" },
  { id: "west",   en: "West",   te: "పశ్చిమం",  icon: "⬅️" },
  { id: "center", en: "Center", te: "మధ్యలో",   icon: "🎯" },
];

// ---- STATE ----
let state = {
  selectedCrop: null,
  selectedField: null,
  selectedDir: null,
  grid: [],
  gridSize: 10,
  humidity: 60,
  temperature: 30,
  soilMoisture: 50,
  simulating: false,
  steps: 0,
  intervalId: null,
  history: [], // Stores infection counts for the graph
  activeTool: null, // Can be 'spray'
  modalType: 'crop', // 'crop', 'field', 'dir'
};

// ============================================================
//  SETUP PHASE — Build UI
// ============================================================
function buildSetup() {
  // ---- CROPS ----
  const cropContainer = document.getElementById("crop-grid-container");
  cropContainer.innerHTML = ''; // Clear to prevent duplicates on rebuild
  CROPS.forEach(crop => {
    const button = document.createElement("button");
    button.className = "crop-btn";
    button.dataset.id = crop.id;
    button.innerHTML = `
      <span class="btn-emoji">${crop.icon}</span>
      <span class="btn-en">${crop.en}</span>
      <span class="btn-te">${crop.te}</span>
    `;
    button.onclick = () => selectOption('crop', crop.id);
    cropContainer.appendChild(button);
  });

  // Add "Plus" Button for Custom Crop
  const addBtn = document.createElement("button");
  addBtn.className = "crop-btn add-crop-btn";
  addBtn.innerHTML = `
    <span class="btn-emoji">➕</span>
    <span class="btn-en">Add Crop</span>
    <span class="btn-te">కొత్త పంట</span>
  `;
  addBtn.onclick = () => openModal('crop');
  cropContainer.appendChild(addBtn);

  // ---- FIELD SIZES ----
  const fieldContainer = document.getElementById("field-grid-container");
  FIELD_SIZES.forEach(f => {
    const button = document.createElement("button");
    button.className = "field-btn";
    button.dataset.id = f.id;
    button.innerHTML = `
      <span class="btn-en">${f.en}</span>
      <span class="btn-te">${f.te}</span>
    `;
    button.onclick = () => selectOption('field', f.id);
    fieldContainer.appendChild(button);
  });
  
  // Add "Plus" Button for Field
  const addFieldBtn = document.createElement("button");
  addFieldBtn.className = "field-btn add-crop-btn"; // Reuse style
  addFieldBtn.innerHTML = `
    <span class="btn-emoji">➕</span>
    <span class="btn-en">Add Size</span>
    <span class="btn-te">కొత్త పరిమాణం</span>
  `;
  addFieldBtn.onclick = () => openModal('field');
  fieldContainer.appendChild(addFieldBtn);

  // ---- DIRECTIONS ----
  const dirContainer = document.getElementById("dir-grid-container");
  DIRECTIONS.forEach(d => {
    const button = document.createElement("button");
    button.className = "dir-btn";
    button.dataset.id = d.id;
    button.innerHTML = `
      <span class="btn-emoji">${d.icon}</span>
      <span class="btn-en">${d.en}</span>
      <span class="btn-te">${d.te}</span>
    `;
    button.onclick = () => selectOption('dir', d.id);
    dirContainer.appendChild(button);
  });

  // Add "Plus" Button for Direction
  const addDirBtn = document.createElement("button");
  addDirBtn.className = "dir-btn add-crop-btn"; // Reuse style
  addDirBtn.innerHTML = `
    <span class="btn-emoji">➕</span>
    <span class="btn-en">Add Dir</span>
    <span class="btn-te">కొత్త దిశ</span>
  `;
  addDirBtn.onclick = () => openModal('dir');
  dirContainer.appendChild(addDirBtn);
}

function selectOption(type, value) {
  const config = {
    crop: { container: 'crop-grid-container', btn: 'crop-btn', prop: 'selectedCrop' },
    field: { container: 'field-grid-container', btn: 'field-btn', prop: 'selectedField' },
    dir: { container: 'dir-grid-container', btn: 'dir-btn', prop: 'selectedDir' },
  };
  const { container, btn, prop } = config[type];

  state[prop] = state[prop] === value ? null : value;

  document.getElementById(container).querySelectorAll(`.${btn}`).forEach(button => {
    button.classList.toggle('selected', button.dataset.id === state[prop]);
  });

  checkSetupReady();
}

function checkSetupReady() {
  const ready = state.selectedCrop && state.selectedField && state.selectedDir;
  const btn = document.getElementById("btn-start");
  const hint = document.getElementById("setup-hint");
  btn.disabled = !ready;
  hint.style.display = ready ? "none" : "block";
}

// ============================================================
//  TRANSITION TO SIMULATION
// ============================================================
function startSimulation() {
  const fieldDef = FIELD_SIZES.find(f => f.id === state.selectedField);
  state.gridSize = fieldDef ? fieldDef.grid : 10;

  // Create fresh grid
  state.grid = createGrid(state.gridSize);
  state.steps = 0;
  state.simulating = false;
  state.history = [];
  clearInterval(state.intervalId);

  // Place initial infection based on direction
  const s = state.gridSize;
  const mid = Math.floor(s / 2);
  let startCells = [];
  switch (state.selectedDir) {
    case "north":  startCells = [[0, mid]]; break;
    case "south":  startCells = [[s - 1, mid]]; break;
    case "east":   startCells = [[mid, s - 1]]; break;
    case "west":   startCells = [[mid, 0]]; break;
    default:       startCells = [[mid, mid]]; break;
  }
  startCells.forEach(([r, c]) => {
    state.grid[r][c].infected = true;
    state.grid[r][c].probability = 1;
  });

  // Update top bar crop label
  const crop = CROPS.find(c => c.id === state.selectedCrop);
  document.getElementById("top-crop-label").textContent = `${crop.icon} ${crop.en} • ${crop.te}`;

  // Switch phases
  document.getElementById("setup-phase").classList.remove("active");
  document.getElementById("sim-phase").classList.add("active");

  // Build grid DOM
  buildFarmGrid();
  updateDashboard();
  renderTrendChart();
}

function goBack() {
  clearInterval(state.intervalId);
  state.simulating = false;
  document.getElementById("sim-phase").classList.remove("active");
  document.getElementById("setup-phase").classList.add("active");
  updatePlayBtn();
}

// ============================================================
//  GRID CREATION & RENDERING
// ============================================================
function createGrid(size) {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, () => ({ infected: false, probability: 0, age: 0 }))
  );
}

function buildFarmGrid() {
  const container = document.getElementById("farm-grid");
  container.innerHTML = "";
  container.style.gridTemplateColumns = `repeat(${state.gridSize}, 1fr)`;

  for (let r = 0; r < state.gridSize; r++) {
    for (let c = 0; c < state.gridSize; c++) {
      const cell = document.createElement("div");
      cell.className = "farm-cell";
      cell.id = `cell-${r}-${c}`;
      cell.title = `Row ${r + 1}, Col ${c + 1}`;
      cell.addEventListener("click", () => {
        if (state.activeTool === 'spray') {
          applyPesticide(r, c);
          // Deactivate tool after use for better UX
          state.activeTool = null;
          document.getElementById('btn-spray').classList.remove('active');
        } else {
          // Default behavior: manually infect/cure
          if (state.simulating) return;
          const g = state.grid[r][c];
          g.infected = !g.infected;
          g.probability = g.infected ? 1 : 0;
          renderCell(r, c, false);
          updateDashboard();
        }
      });
      container.appendChild(cell);
      renderCell(r, c, false);
    }
  }
}

function renderCell(r, c, animate) {
  const cell = document.getElementById(`cell-${r}-${c}`);
  if (!cell) return;
  const data = state.grid[r][c];

  if (data.infected) {
    const age = data.age || 0;
    const hue = Math.max(0, 8 - age * 1.5);
    const sat = Math.min(95, 82 + age * 2);
    const lit = Math.max(35, 46 - age);
    cell.style.backgroundColor = `hsl(${hue}, ${sat}%, ${lit}%)`;
    cell.style.boxShadow = `0 0 ${6 + age}px rgba(239,68,68,0.55)`;
    cell.classList.add("infected");
    cell.innerHTML = age > 2 ? '<span>🦠</span>' : '';
  } else {
    cell.style.backgroundColor = getProbabilityColor(data.probability);
    cell.style.boxShadow = "none";
    cell.classList.remove("infected");
    cell.innerHTML = '';
  }

  if (animate) {
    cell.classList.remove("newly-infected");
    void cell.offsetWidth; // reflow
    cell.classList.add("newly-infected");
  }
}

function getProbabilityColor(prob) {
  if (prob <= 0) return "#16a34a";

  if (prob < 0.3) {
    const t = prob / 0.3;
    const r = Math.round(22 + t * 200);
    const g = Math.round(163 - t * 60);
    const b = Math.round(74 - t * 50);
    return `rgb(${r},${g},${b})`;
  }
  if (prob < 0.65) {
    const t = (prob - 0.3) / 0.35;
    const r = Math.round(222 + t * 30);
    const g = Math.round(103 + t * 45);
    const b = Math.round(24 - t * 10);
    return `rgb(${r},${g},${b})`;
  }
  const t = (prob - 0.65) / 0.35;
  const r = Math.round(220 + t * 35);
  const g = Math.round(38 - t * 20);
  const b = Math.round(38 - t * 20);
  return `rgb(${r},${g},${b})`;
}

// ============================================================
//  SIMULATION CONTROLS
// ============================================================
function toggleSimulation() {
  state.simulating = !state.simulating;
  if (state.simulating) {
    state.intervalId = setInterval(nextStep, 1500); // Slowed down to 1.5s
  } else {
    clearInterval(state.intervalId);
  }
  updatePlayBtn();
}

function updatePlayBtn() {
  const btn = document.getElementById("btn-play");
  const nextBtn = document.getElementById("btn-next");
  if (state.simulating) {
    btn.textContent = '';
    btn.innerHTML = '⏸️ Pause<br><span>ఆపు</span>';
    btn.classList.add("paused");
    nextBtn.disabled = true;
  } else {
    btn.innerHTML = '▶️ Start<br><span>ప్రారంభం</span>';
    btn.classList.remove("paused");
    nextBtn.disabled = false;
  }
}

function nextStep() {
  const spreadProb = getSpreadProbability(state.humidity, state.temperature, state.soilMoisture);
  
  // Get Crop Resistance
  const crop = CROPS.find(c => c.id === state.selectedCrop) || { resistance: 0.2 };
  const resistance = crop.resistance;

  // Determine Wind Vector based on selected direction (Pests blow WITH the wind)
  // North input means pests came FROM North, so wind blows South (1, 0)
  let windVec = [0, 0];
  if (state.selectedDir === 'north') windVec = [1, 0];
  if (state.selectedDir === 'south') windVec = [-1, 0];
  if (state.selectedDir === 'east')  windVec = [0, -1];
  if (state.selectedDir === 'west')  windVec = [0, 1];

  const newlyInfected = [];

  // Deep copy
  const nextGrid = state.grid.map(row => row.map(cell => ({ ...cell })));

  for (let r = 0; r < state.gridSize; r++) {
    for (let c = 0; c < state.gridSize; c++) {
      if (state.grid[r][c].infected) {
        nextGrid[r][c].age += 1;
        const neighbors = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]];
        neighbors.forEach(([nr, nc]) => {
          if (nr >= 0 && nr < state.gridSize && nc >= 0 && nc < state.gridSize) {
            if (!state.grid[nr][nc].infected) {
              
              // Calculate Wind Influence
              // Vector from Infected(r,c) to Neighbor(nr,nc)
              const dirR = nr - r;
              const dirC = nc - c;
              // Dot product to see if it aligns with wind
              const alignment = (dirR * windVec[0]) + (dirC * windVec[1]);
              const windBonus = alignment > 0 ? 0.15 : 0; // Boost if downwind

              // Formula: Base Spread + Wind Bonus - Crop Resistance
              const effectiveSpread = (spreadProb * 0.4) + windBonus - (resistance * 0.1);
              
              const newProb = Math.min(state.grid[nr][nc].probability + Math.max(effectiveSpread, 0.05), 1);
              nextGrid[nr][nc].probability = newProb;
              
              // Infection Chance
              if (Math.random() < (spreadProb - resistance * 0.3)) {
                nextGrid[nr][nc].infected = true;
                nextGrid[nr][nc].probability = 1;
                newlyInfected.push([nr, nc]);
              }
            }
          }
        });
      }
    }
  }

  state.grid = nextGrid;
  state.steps++;
  state.history.push(state.grid.flat().filter(c => c.infected).length);

  // Render all cells
  for (let r = 0; r < state.gridSize; r++) {
    for (let c = 0; c < state.gridSize; c++) {
      const isNew = newlyInfected.some(([nr, nc]) => nr === r && nc === c);
      renderCell(r, c, isNew);
    }
  }
  updateDashboard();
  renderTrendChart();
}

function resetFarm() {
  clearInterval(state.intervalId);
  state.simulating = false;
  state.steps = 0;
  state.grid = createGrid(state.gridSize);
  state.history = [];
  buildFarmGrid();
  updateDashboard();
  updatePlayBtn();
  renderTrendChart();
}

function toggleSprayTool() {
  const btn = document.getElementById('btn-spray');
  if (state.activeTool === 'spray') {
    state.activeTool = null;
    btn.classList.remove('active');
  } else {
    state.activeTool = 'spray';
    btn.classList.add('active');
  }
}

function applyPesticide(row, col) {
  // Apply to a 3x3 area
  for (let r = row - 1; r <= row + 1; r++) {
    for (let c = col - 1; c <= col + 1; c++) {
      if (r >= 0 && r < state.gridSize && c >= 0 && c < state.gridSize) {
        const cellData = state.grid[r][c];
        cellData.infected = false;
        cellData.probability = 0; // Reset risk
        cellData.age = 0;
        renderCell(r, c, false);
      }
    }
  }
  // Recalculate dashboard stats after applying
  updateDashboard();
  renderTrendChart();
}

// ============================================================
//  SPREAD PROBABILITY
// ============================================================
function getSpreadProbability(h, t, s) {
  const hFactor = h / 100;
  const tFactor = Math.min(Math.max((t - 20) / 20, 0), 1);
  const sFactor = s / 100;
  return Math.min(0.15 + hFactor * 0.35 + tFactor * 0.3 + sFactor * 0.2, 0.95);
}

// ============================================================
//  WEATHER API INTEGRATION (Open-Meteo)
// ============================================================
async function fetchWeather() {
  const cityInput = document.getElementById('weather-city');
  const statusEl = document.getElementById('weather-status');
  const city = cityInput.value.trim();

  if (!city) {
    statusEl.textContent = "Please enter a city name.";
    statusEl.className = "weather-status error";
    return;
  }

  statusEl.textContent = "Fetching weather data...";
  statusEl.className = "weather-status";

  try {
    // 1. Geocoding to get Lat/Lon
    const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
    const geoData = await geoRes.json();

    if (!geoData.results || geoData.results.length === 0) {
      throw new Error("City not found");
    }

    const { latitude, longitude, name } = geoData.results[0];

    // 2. Fetch Weather (Temp, Humidity, Soil Moisture)
    const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,soil_moisture_0_to_1cm`);
    const weatherData = await weatherRes.json();
    const current = weatherData.current;

    // 3. Update State & UI
    updateSlider('humidity', current.relative_humidity_2m);
    updateSlider('temperature', Math.round(current.temperature_2m));
    // Soil moisture comes as 0-1 or similar, mapping roughly to percentage if available, else random
    const soilM = current.soil_moisture_0_to_1cm ? Math.round(current.soil_moisture_0_to_1cm * 100) : 50;
    updateSlider('soilmoisture', Math.min(soilM, 100)); // Cap at 100

    statusEl.textContent = `Updated for ${name}: ${current.temperature_2m}°C, ${current.relative_humidity_2m}% Humidity`;
    statusEl.style.color = "#4ade80";

  } catch (error) {
    console.error(error);
    statusEl.textContent = "Error fetching weather. Try again.";
    statusEl.className = "weather-status error";
  }
}

// ============================================================
//  SLIDERS
// ============================================================
function updateSlider(name) {
  const el = document.getElementById(`sl-${name}`);
  // If valArg is provided (from API), use it, else use slider value
  const val = valArg !== undefined ? Number(valArg) : Number(el.value);
  
  // Update input element visually if changed via API
  if (valArg !== undefined) el.value = val;

  if (name === "humidity")     { state.humidity = val;     document.getElementById("val-humidity").textContent = `${val}%`; }
  if (name === "temperature")  { state.temperature = val;  document.getElementById("val-temperature").textContent = `${val}°C`; }
  if (name === "soilmoisture") { state.soilMoisture = val; document.getElementById("val-soilmoisture").textContent = `${val}%`; }
  updateSpreadDisplay();
}

function updateSpreadDisplay() {
  const prob = getSpreadProbability(state.humidity, state.temperature, state.soilMoisture);
  const pct = Math.round(prob * 100);
  const el = document.getElementById("spread-value");
  const bar = document.getElementById("spread-bar");
  const box = document.getElementById("spread-box");

  el.textContent = `${pct}%`;
  bar.style.width = `${pct}%`;

  let color, borderColor;
  if (prob > 0.6) {
    color = "#ef4444"; borderColor = "rgba(239,68,68,0.3)";
  } else if (prob > 0.35) {
    color = "#f59e0b"; borderColor = "rgba(245,158,11,0.3)";
  } else {
    color = "#22c55e"; borderColor = "rgba(34,197,94,0.3)";
  }
  el.style.color = color;
  bar.style.background = color;
  box.style.borderColor = borderColor;
}

// ============================================================
//  DASHBOARD
// ============================================================
function updateDashboard() {
  const infected = state.grid.flat().filter(c => c.infected).length;
  const total = state.gridSize * state.gridSize;
  const riskPct = Math.round((infected / total) * 100);

  document.getElementById("stat-infected").textContent = infected;
  document.getElementById("stat-risk").textContent = `${riskPct}%`;
  document.getElementById("stat-steps").textContent = state.steps;

  // Risk badge
  const badge = document.getElementById("risk-badge");
  if (riskPct < 20) {
    badge.style.color = "#22c55e";
    badge.textContent = "Low Risk • తక్కువ";
  } else if (riskPct < 50) {
    badge.style.color = "#f59e0b";
    badge.textContent = "Medium Risk • మధ్యమ";
  } else {
    badge.style.color = "#ef4444";
    badge.textContent = "High Risk! • అధిక!";
  }

  updateSpreadDisplay();
  updateRecommendations(infected, riskPct);
}

// ============================================================
//  SMART RECOMMENDATIONS LOGIC
// ============================================================
function updateRecommendations(infected, riskPct) {
  const alertsEl = document.getElementById("rec-alerts");
  const actionsEl = document.getElementById("rec-actions");
  
  // 1. Weather & Early Warning Alerts
  let alertHTML = "";
  
  // Weather Checks
  if (state.humidity > 75) {
    alertHTML += `<div class="alert-item warning">
      ⚠️ <strong>High Humidity Alert</strong><br>
      <span class="te">అధిక తేమ - తెగులు పెరిగే అవకాశం ఉంది</span>
    </div>`;
  }
  if (state.temperature > 38) {
    alertHTML += `<div class="alert-item danger">
      🔥 <strong>Heat Stress Alert</strong><br>
      <span class="te">అధిక వేడి - పంటను కాపాడండి</span>
    </div>`;
  }

  // Early Warning (High Probability Cells)
  const atRiskCount = state.grid.flat().filter(c => !c.infected && c.probability > 0.6).length;
  if (atRiskCount > 5) {
    alertHTML += `<div class="alert-item danger">
      📢 <strong>Spread Likely in 24h</strong><br>
      <span class="te">24 గంటల్లో వ్యాప్తి చెందే అవకాశం ఉంది</span>
    </div>`;
  }
  
  alertsEl.innerHTML = alertHTML;
  alertsEl.style.display = alertHTML ? "block" : "none";

  // 2. Targeted Action Plan
  let actionHTML = "";
  
  if (infected === 0) {
    actionHTML += `<li><span class="rec-icon">✅</span><div><strong>Continue Monitoring</strong><br><span class="te">పచ్చని ప్రాంతాలను గమనించండి</span></div></li>`;
    actionHTML += `<li><span class="rec-icon">💧</span><div><strong>Maintain Irrigation</strong><br><span class="te">నీటి పారుదల సరిగ్గా ఉంచండి</span></div></li>`;
  } else {
    // Targeted vs Blanket
    if (riskPct < 40) {
      actionHTML += `<li><span class="rec-icon">🎯</span><div><strong>Targeted Spray (Spot)</strong><br><span class="te">సోకిన చోట మాత్రమే మందు కొట్టండి</span><div class="sub-text">Saves cost & environment</div></div></li>`;
      actionHTML += `<li><span class="rec-icon">🟡</span><div><strong>Inspect Yellow Zones</strong><br><span class="te">పసుపు ప్రాంతాలను తనిఖీ చేయండి</span></div></li>`;
    } else {
      actionHTML += `<li><span class="rec-icon">🚜</span><div><strong>Full Field Treatment</strong><br><span class="te">మొత్తం పొలంలో మందు కొట్టాలి</span></div></li>`;
      actionHTML += `<li><span class="rec-icon">📞</span><div><strong>Contact Officer</strong><br><span class="te">వ్యవసాయ అధికారిని సంప్రదించండి</span></div></li>`;
    }
  }
  
  actionsEl.innerHTML = actionHTML;
}

// ============================================================
//  TREND CHART
// ============================================================
function renderTrendChart() {
  const container = document.getElementById("trend-chart");
  if (!container) return;
  container.innerHTML = '';

  const data = state.history;
  if (data.length === 0) return;

  const totalCells = state.gridSize * state.gridSize;
  // Show at least 20 steps on X-axis for context, or grow if history is longer
  const xDomain = Math.max(data.length, 20); 
  
  // Generate SVG Path
  let pathD = `M 0,100 `; // Start at bottom-left
  let lastX = 0;
  let lastY = 100;

  data.forEach((val, i) => {
    const x = (i / (xDomain - 1)) * 100;
    const y = 100 - ((val / totalCells) * 100);
    pathD += `L ${x},${y} `;
    lastX = x;
    lastY = y;
  });

  // Close the area shape for the gradient fill
  const areaD = `${pathD} L ${lastX},100 Z`;

  const svg = `
    <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="rgba(239,68,68,0.5)" /><stop offset="100%" stop-color="rgba(239,68,68,0)" /></linearGradient>
      </defs>
      <path d="${areaD}" fill="url(#grad)" />
      <path d="${pathD}" fill="none" stroke="#ef4444" stroke-width="2" vector-effect="non-scaling-stroke" />
      <circle cx="${lastX}" cy="${lastY}" r="3" fill="#fff" stroke="#ef4444" stroke-width="2" vector-effect="non-scaling-stroke" />
    </svg>`;
  
  container.innerHTML = svg;
}

// ============================================================
//  INIT
// ============================================================
buildSetup();
checkSetupReady();

// ============================================================
//  CUSTOM CROP & SPEECH ASSISTANT
// ============================================================
function openModal(type) {
  state.modalType = type;
  const modal = document.getElementById('modal-overlay');
  const title = document.getElementById('modal-title');
  const input = document.getElementById('custom-input');

  if (type === 'crop') {
    title.textContent = "Add New Crop • కొత్త పంట";
    input.placeholder = "Enter crop name...";
  } else if (type === 'field') {
    title.textContent = "Add Field Size • పొలం పరిమాణం";
    input.placeholder = "Enter size name (e.g. Huge)...";
  } else if (type === 'dir') {
    title.textContent = "Add Direction • కొత్త దిశ";
    input.placeholder = "Enter direction name...";
  }

  modal.classList.add('open');
  input.value = '';
  input.focus();
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
}

function saveCustomItem() {
  const input = document.getElementById('custom-input');
  const name = input.value.trim();
  if (!name) return;

  const newId = name.toLowerCase().replace(/\s+/g, '-');

  if (state.modalType === 'crop') {
    CROPS.push({ id: newId, en: name, te: name, icon: "🌱", resistance: 0.25 });
    selectOption('crop', newId);
  } else if (state.modalType === 'field') {
    // Defaulting custom fields to grid size 10 (Medium)
    FIELD_SIZES.push({ id: newId, en: name, te: name, grid: 10 });
    selectOption('field', newId);
  } else if (state.modalType === 'dir') {
    DIRECTIONS.push({ id: newId, en: name, te: name, icon: "🚩" });
    selectOption('dir', newId);
  }

  buildSetup(); // Rebuild grid
  closeModal();
}

function startDictation() {
  if (window.hasOwnProperty('webkitSpeechRecognition') || window.hasOwnProperty('SpeechRecognition')) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US"; // Default to English, could be 'te-IN'

    const micBtn = document.getElementById('btn-mic');
    micBtn.classList.add('listening');

    recognition.onresult = (e) => {
      document.getElementById('custom-input').value = e.results[0][0].transcript;
      micBtn.classList.remove('listening');
    };
    recognition.onerror = () => micBtn.classList.remove('listening');
    recognition.onend = () => micBtn.classList.remove('listening');
    
    recognition.start();
  } else {
    alert("Speech recognition is not supported in this browser.");
  }
}

// ============================================================
//  HELP MODAL
// ============================================================
let helpAudio = null;

function openHelpModal() {
  const modal = document.getElementById('help-modal-overlay');
  modal.classList.add('open');
}

function closeHelpModal() {
  const modal = document.getElementById('help-modal-overlay');
  modal.classList.remove('open');
  
  // Stop Audio if playing
  if (helpAudio) {
    helpAudio.pause();
    helpAudio.currentTime = 0;
  }
  const btn = document.getElementById('btn-speak-help');
  if (btn) btn.innerHTML = '▶️ Play Audio Guide<br><span class="te">ఆడియో గైడ్ వినండి</span>';
}

function toggleHelpAudio() {
  const btn = document.getElementById('btn-speak-help');
  
  if (helpAudio && !helpAudio.paused) {
    helpAudio.pause();
    helpAudio.currentTime = 0;
    btn.innerHTML = '▶️ Play Audio Guide<br><span class="te">ఆడియో గైడ్ వినండి</span>';
    return;
  }

  helpAudio = new Audio('audio.mpeg');

  helpAudio.onended = () => {
    btn.innerHTML = '▶️ Play Audio Guide<br><span class="te">ఆడియో గైడ్ వినండి</span>';
  }; 
  
  helpAudio.onerror = () => {
    alert("Audio file 'padhu audio.mpeg' not found!");
    btn.innerHTML = '▶️ Play Audio Guide<br><span class="te">ఆడియో గైడ్ వినండి</span>';
  };

  helpAudio.play();
  btn.innerHTML = '⏹️ Stop Audio<br><span class="te">ఆడియో ఆపండి</span>';
}
