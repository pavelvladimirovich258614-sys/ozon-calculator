/**
 * Ozon Unit Economics Calculator — MVP
 * Чистая функция расчёта + рендер результатов
 */

let rates = null;

// Загрузка справочника тарифов
async function loadRates() {
  try {
    const res = await fetch('data/rates.json');
    rates = await res.json();
  } catch (e) {
    console.error('Не удалось загрузить rates.json', e);
    alert('Ошибка загрузки тарифов. Проверьте файл data/rates.json');
  }
}

// Получение ставки комиссии по категории
function getCommissionRate(categoryId) {
  if (!rates) return 0;
  const cat = rates.categories.find(c => c.id === categoryId);
  return cat ? cat.commission : 0;
}

// Получение благотворительности по цене (lookup-table)
function getCharity(salePrice) {
  if (!rates || !rates.charity) return 0;
  const row = rates.charity.find(r => salePrice >= r.minPrice && salePrice <= r.maxPrice);
  return row ? row.amount : 0;
}

// Расчёт логистики
function getLogistics(scheme, weightKg) {
  if (!rates || !rates.logistics) return 0;
  const cfg = rates.logistics[scheme];
  if (!cfg) return 0;
  const w = Math.max(0, parseFloat(weightKg) || 0);
  const cost = cfg.base + (w * cfg.perKg);
  return Math.min(Math.max(cost, cfg.min), cfg.max);
}

// === ЧИСТАЯ ФУНКЦИЯ РАСЧЁТА ===
function calculateProfit({ purchasePrice, salePrice, category, scheme, weightKg }) {
  const purchase = Math.max(0, parseFloat(purchasePrice) || 0);
  const sale     = Math.max(0, parseFloat(salePrice) || 0);
  const weight   = Math.max(0, parseFloat(weightKg) || 0);

  const commissionRate = getCommissionRate(category);
  const commission     = sale * commissionRate;
  const charity        = getCharity(sale);
  const logistics      = getLogistics(scheme, weight);
  const acquiring      = sale * (rates ? rates.acquiring : 0.015);
  const processing     = rates ? rates.processing : 20;

  const totalCosts = purchase + commission + charity + logistics + acquiring + processing;
  const profit     = sale - totalCosts;
  const margin     = sale > 0 ? (profit / sale) * 100 : 0;
  const costPrice    = totalCosts;

  return {
    profit:     profit,
    margin:     margin,
    costPrice:  costPrice,
    breakdown: {
      purchase,
      commission,
      charity,
      logistics,
      acquiring,
      processing
    }
  };
}

// Подбор рекомендуемой цены (максимум прибыли в диапазоне закуп+1 .. закуп+1000)
function findRecommendedPrice({ purchasePrice, category, scheme, weightKg }) {
  const purchase = parseFloat(purchasePrice) || 0;
  let bestPrice = purchase + 1;
  let bestProfit = -Infinity;

  for (let price = Math.ceil(purchase + 1); price <= purchase + 1000; price++) {
    const r = calculateProfit({
      purchasePrice: purchase,
      salePrice: price,
      category,
      scheme,
      weightKg
    });
    if (r.profit > bestProfit) {
      bestProfit = r.profit;
      bestPrice = price;
    }
  }
  return { price: bestPrice, profit: bestProfit };
}

// === РЕНДЕР ===
function formatMoney(n) {
  return Math.round(n).toLocaleString('ru-RU') + ' ₽';
}
function formatPercent(n) {
  return n.toFixed(1).replace('.', ',') + '%';
}

function getInputs() {
  return {
    purchasePrice: document.getElementById('purchasePrice').value,
    salePrice:     document.getElementById('salePrice').value,
    category:      document.getElementById('category').value,
    scheme:        document.querySelector('input[name="scheme"]:checked')?.value || 'FBS',
    weightKg:      document.getElementById('weightKg').value
  };
}

function render() {
  const inputs = getInputs();
  const result = calculateProfit(inputs);

  // Основные цифры
  const profitEl = document.getElementById('res-profit');
  const marginEl = document.getElementById('res-margin');
  const costEl   = document.getElementById('res-cost');

  profitEl.textContent = (result.profit >= 0 ? '+' : '') + formatMoney(result.profit);
  profitEl.className = 'big-number ' + (result.profit >= 0 ? 'positive' : 'negative');
  marginEl.textContent = formatPercent(result.margin);
  costEl.textContent   = formatMoney(result.costPrice);

  // Детальный разбор
  const tbody = document.getElementById('breakdown-body');
  tbody.innerHTML = `
    <tr><td>Закупочная цена</td><td>${formatMoney(result.breakdown.purchase)}</td></tr>
    <tr><td>Комиссия Ozon</td><td>${formatMoney(result.breakdown.commission)}</td></tr>
    <tr><td>Логистика (${inputs.scheme})</td><td>${formatMoney(result.breakdown.logistics)}</td></tr>
    <tr><td>Благотворительность</td><td>${formatMoney(result.breakdown.charity)}</td></tr>
    <tr><td>Эквайринг (~1,5%)</td><td>${formatMoney(result.breakdown.acquiring)}</td></tr>
    <tr><td>Обработка отправления</td><td>${formatMoney(result.breakdown.processing)}</td></tr>
  `;

  // Рекомендуемая цена
  const rec = findRecommendedPrice(inputs);
  document.getElementById('res-recommended').textContent =
    `Оптимальная цена: ${formatMoney(rec.price)} (прибыль ${formatMoney(rec.profit)})`;

  // Сравнение: "эффект порога" — 300₽ (сбор 10₽) vs 301₽ (сбор 1₽)
  const at300    = calculateProfit({ ...inputs, salePrice: 300 });
  const at301    = calculateProfit({ ...inputs, salePrice: 301 });
  const current  = result;
  const price    = parseFloat(inputs.salePrice) || 0;
  
  document.getElementById('compare-under').textContent =
    `300 ₽ → прибыль ${formatMoney(at300.profit)} | Сбор: ${formatMoney(at300.breakdown.charity)}`;
  document.getElementById('compare-current').textContent =
    price === 300
      ? `301 ₽ → прибыль ${formatMoney(at301.profit)} | Сбор: ${formatMoney(at301.breakdown.charity)} 💡 Поднимите цену на 1 ₽!`
      : `${price} ₽ → прибыль ${formatMoney(current.profit)} | Сбор: ${formatMoney(current.breakdown.charity)}`;

  // Предупреждение о благотворительности
  const charityWarn = document.getElementById('charity-warning');
  if (parseFloat(inputs.salePrice) <= 300 && parseFloat(inputs.salePrice) > 0) {
    charityWarn.style.display = 'block';
  } else {
    charityWarn.style.display = 'none';
  }
}

// Debounce 300 мс
let debounceTimer;
function debouncedRender() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(render, 300);
}

// Инициализация
async function init() {
  await loadRates();

  // Заполнить select категориями
  const sel = document.getElementById('category');
  if (rates && rates.categories) {
    rates.categories.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      sel.appendChild(opt);
    });
    // Дефолтная категория — первая
    sel.value = rates.categories[0].id;
  }

  // Слушатели
  document.getElementById('purchasePrice').addEventListener('input', debouncedRender);
  document.getElementById('salePrice').addEventListener('input', debouncedRender);
  document.getElementById('category').addEventListener('change', debouncedRender);
  document.getElementById('weightKg').addEventListener('input', debouncedRender);
  document.querySelectorAll('input[name="scheme"]').forEach(el => {
    el.addEventListener('change', debouncedRender);
  });

  // Первый рендер
  render();
}

init();
