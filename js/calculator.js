/* Ozon Unit-Economics Calculator — MVP */
let RATES = null;

const FALLBACK_RATES = {
  "categories": {
    "clothing": { "name": "Одежда", "commission": 0.20 },
    "electronics": { "name": "Электроника", "commission": 0.075 },
    "appliances": { "name": "Бытовая техника", "commission": 0.10 },
    "beauty": { "name": "Красота и здоровье", "commission": 0.215 },
    "home": { "name": "Дом и сад", "commission": 0.15 }
  },
  "charity": { "threshold": 300, "lte300": 10.00, "gt300": 1.00 },
  "logistics": { "FBS": { "base": 45, "perKg": 15 }, "FBO": { "base": 35, "perKg": 12 } },
  "acquiring": 0.015,
  "processing": 20
};

async function loadRates() {
  if (RATES) return;
  try {
    const res = await fetch('data/rates.json');
    if (res.ok) { RATES = await res.json(); return; }
  } catch (e) { /* file:// или CORS */ }
  RATES = FALLBACK_RATES;
}

function fmt(n) { return n.toLocaleString('ru-RU', {minimumFractionDigits:2, maximumFractionDigits:2}); }
function fmt0(n) { return n.toLocaleString('ru-RU', {maximumFractionDigits:0}); }

function calculateProfit(purchasePrice, salePrice, categoryKey, scheme, weight) {
  if (!RATES) return null;
  const cat = RATES.categories[categoryKey];
  const commission = salePrice * cat.commission;
  const charity = salePrice <= RATES.charity.threshold ? RATES.charity.lte300 : RATES.charity.gt300;
  const log = RATES.logistics[scheme];
  const logistics = log.base + (weight * log.perKg);
  const acquiring = salePrice * RATES.acquiring;
  const processing = RATES.processing;
  const totalCosts = purchasePrice + commission + charity + logistics + acquiring + processing;
  const profit = salePrice - totalCosts;
  const margin = salePrice > 0 ? (profit / salePrice) * 100 : 0;
  return {
    profit, margin,
    breakdown: { purchasePrice, commission, charity, logistics, acquiring, processing, totalCosts }
  };
}

function findOptimal(purchasePrice, categoryKey, scheme, weight) {
  let best = null;
  for (let p = 200; p <= 1200; p += 10) {
    const r = calculateProfit(purchasePrice, p, categoryKey, scheme, weight);
    if (r.profit > 0 && (!best || r.profit > best.profit)) best = { price: p, ...r };
  }
  return best;
}

function render(res) {
  const section = document.getElementById('resultSection');
  section.style.display = 'block';

  const profitEl = document.getElementById('profitValue');
  const marginEl = document.getElementById('marginValue');
  profitEl.textContent = `${fmt(res.profit)} ₽`;
  profitEl.style.color = res.profit < 0 ? 'var(--danger)' : (res.profit > 0 ? 'var(--accent2)' : 'var(--muted)');
  marginEl.textContent = `${fmt(res.margin)} %`;
  marginEl.style.color = profitEl.style.color;

  const b = res.breakdown;
  document.getElementById('bPurchase').textContent = `${fmt(b.purchasePrice)} ₽`;
  document.getElementById('bCommission').textContent = `${fmt(b.commission)} ₽`;
  document.getElementById('bScheme').textContent = res.scheme;
  document.getElementById('bLogistics').textContent = `${fmt(b.logistics)} ₽`;
  document.getElementById('bCharity').textContent = `${fmt(b.charity)} ₽`;
  document.getElementById('bAcquiring').textContent = `${fmt(b.acquiring)} ₽`;
  document.getElementById('bProcessing').textContent = `${fmt(b.processing)} ₽`;
  document.getElementById('bTotal').textContent = `${fmt(b.totalCosts)} ₽`;

  // Recommendation
  const opt = findOptimal(b.purchasePrice, res.categoryKey, res.scheme, res.weight);
  const recEl = document.getElementById('recommendPrice');
  if (opt) {
    recEl.innerHTML = `Оптимальная цена: <strong>${fmt0(opt.price)} ₽</strong> → прибыль <strong>${fmt(opt.profit)} ₽</strong> (${fmt(opt.margin)}% маржи)`;
  } else {
    recEl.textContent = 'При текущих параметрах прибыль невозможна. Попробуйте снизить закупочную цену или выбрать другую схему.';
  }

  // Compare below/above 300
  const below = calculateProfit(b.purchasePrice, 300, res.categoryKey, res.scheme, res.weight);
  const above = calculateProfit(b.purchasePrice, 350, res.categoryKey, res.scheme, res.weight);
  const cBelow = document.getElementById('compareBelow');
  const cAbove = document.getElementById('compareAbove');
  cBelow.innerHTML = `<td>300 ₽</td><td>${fmt(below.profit)} ₽</td><td>${fmt(below.margin)}%</td>`;
  cAbove.innerHTML = `<td>350 ₽</td><td>${fmt(above.profit)} ₽</td><td>${fmt(above.margin)}%</td>`;
}

async function onSubmit(e) {
  e.preventDefault();
  const purchasePrice = parseFloat(document.getElementById('purchasePrice').value) || 0;
  const salePrice = parseFloat(document.getElementById('salePrice').value) || 0;
  const category = document.getElementById('category').value;
  const scheme = document.getElementById('scheme').value;
  const weight = parseFloat(document.getElementById('weight').value) || 0;

  if (!RATES) await loadRates();
  const res = calculateProfit(purchasePrice, salePrice, category, scheme, weight);
  res.categoryKey = category;
  res.scheme = scheme;
  res.weight = weight;
  render(res);
}

(async function init() {
  await loadRates();
  document.getElementById('calcForm').addEventListener('submit', onSubmit);
  // First calculation with defaults
  document.getElementById('calcForm').dispatchEvent(new Event('submit'));
})();
