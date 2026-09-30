import { apiRequest, me } from './auth-client.js';
import { initShell } from './shell.js';
import { validateRange, markerKindLabel, tickLimit, buildTicks } from './analytics-helpers.js';

const els = {
  search: document.getElementById('article-search'),
  results: document.getElementById('article-results'),
  selectedTitle: document.getElementById('selected-article-title'),
  bucket: document.getElementById('bucket-select'),
  from: document.getElementById('range-from'),
  to: document.getElementById('range-to'),
  canvas: document.getElementById('views-chart'),
  emptyMessage: document.getElementById('empty-message'),
  chartArea: document.getElementById('chart-area'),
  legend: document.getElementById('marker-legend'),
  rangeError: document.getElementById('range-error'),
  searchStatus: document.getElementById('search-status'),
};

const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const markerColor = (kind) => cssVar(kind === 'publish' ? '--st-pub' : '--st-pend') || '#666';
const BADGE_RADIUS = 9;
const MIN_BADGE_SPACING_PX = BADGE_RADIUS * 2 + 4;
const HINT = 'Search for a published article to see how its views changed over time.';
const NO_VIEWS = 'No views recorded in this range.';

let chart = null;
let selectedArticleId = null;
let searchTimer = null;

function toDatetimeLocalValue(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function currentRangeQuery() {
  const params = new URLSearchParams({ bucket: els.bucket.value });
  if (els.from.value) params.set('from', new Date(els.from.value).toISOString());
  if (els.to.value) params.set('to', new Date(els.to.value).toISOString());
  return params.toString();
}

function formatTick(ms, bucket, spanMs) {
  const date = new Date(ms);
  const day = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const isMidnight = date.getHours() === 0 && date.getMinutes() === 0;
  if (bucket === 'day' || (isMidnight && spanMs > 3 * 24 * 60 * 60 * 1000)) return day;
  const time = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return spanMs > 24 * 60 * 60 * 1000 ? [time, day] : time;
}

function formatMarkerTime(iso) {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Alternates badges between two rows when neighbours would touch, so numbered badges never overlap. */
function assignBadgeRows(xPositions) {
  const lastXInRow = [];
  return xPositions.map((x) => {
    let row = 0;
    while (lastXInRow[row] !== undefined && Math.abs(x - lastXInRow[row]) < MIN_BADGE_SPACING_PX) row += 1;
    lastXInRow[row] = x;
    return row % 2;
  });
}

/**
 * Draws a dashed rule per publish/update marker with a numbered badge in the padded strip above the
 * plot area. Full labels live in the legend list under the chart (see renderLegend), so nothing
 * can clip at the canvas edge or collide with the rules.
 */
const markerPlugin = {
  id: 'publicationMarkers',
  afterDraw(chartInstance) {
    const markers = chartInstance.$markers || [];
    if (markers.length === 0) return;
    const { ctx, chartArea, scales } = chartInstance;

    const positions = markers.map((marker) => scales.x.getPixelForValue(new Date(marker.t).getTime()));
    const visible = positions
      .map((x, i) => ({ x, marker: markers[i], number: i + 1 }))
      .filter(({ x }) => x >= chartArea.left && x <= chartArea.right);
    const rows = assignBadgeRows(visible.map((v) => v.x));

    ctx.save();
    visible.forEach(({ x, marker, number }, i) => {
      const color = markerColor(marker.kind);
      const cy = chartArea.top - BADGE_RADIUS - 2 - rows[i] * (BADGE_RADIUS * 2 + 2);
      ctx.strokeStyle = color;
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, cy + BADGE_RADIUS);
      ctx.lineTo(x, chartArea.bottom);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, cy, BADGE_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = cssVar('--surface') || '#fff';
      ctx.font = '600 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(number), x, cy + 0.5);
    });
    ctx.restore();
  },
};

function renderLegend(markers) {
  els.legend.replaceChildren();
  markers.forEach((marker, i) => {
    const li = document.createElement('li');
    const badge = document.createElement('span');
    badge.className = 'marker-badge';
    badge.style.background = markerColor(marker.kind);
    badge.textContent = String(i + 1);
    li.append(badge, `${markerKindLabel(marker.kind)} ${formatMarkerTime(marker.t)}`);
    els.legend.append(li);
  });
}

function drawChart({ series, markers, bucket }) {
  const points = series.map((p) => ({ x: new Date(p.t).getTime(), y: p.count }));
  const step = bucket === 'day' ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
  const padding = step / 2;
  const spanMs = points.length ? points[points.length - 1].x - points[0].x + step : 0;

  if (chart) chart.destroy();
  const line = cssVar('--st-prep');
  const gridColor = cssVar('--line');
  const textColor = cssVar('--ink-2');
  // eslint-disable-next-line no-undef -- Chart is a global from the vendored public/vendor/chart.js
  chart = new Chart(els.canvas, {
    type: 'line',
    data: {
      datasets: [
        {
          label: 'Views',
          data: points,
          borderColor: line,
          backgroundColor: `${line}26`,
          fill: true,
          tension: 0,
          pointRadius: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 2 * (BADGE_RADIUS * 2 + 2) + 4, right: 12 } },
      // Chart.js defaults to intersect:true, so the tooltip only fires on the dots themselves.
      interaction: { mode: 'nearest', axis: 'x', intersect: false },
      scales: {
        x: {
          type: 'linear',
          min: points.length ? points[0].x - padding : undefined,
          max: points.length ? points[points.length - 1].x + padding : undefined,
          afterBuildTicks: (axis) => {
            axis.ticks = buildTicks(axis.min, axis.max, bucket, tickLimit(axis.chart.width)).map((value) => ({ value }));
          },
          ticks: { color: textColor, maxRotation: 0, autoSkip: false, callback: (value) => formatTick(value, bucket, spanMs) },
          grid: { color: gridColor },
          title: { display: true, text: 'Time', color: textColor },
        },
        y: { beginAtZero: true, min: 0, ticks: { precision: 0, color: textColor }, grid: { color: gridColor }, title: { display: true, text: 'Views', color: textColor } },
      },
      plugins: { legend: { display: false } },
    },
    plugins: [markerPlugin],
  });
  chart.$markers = markers;
}

function showChartState({ message } = {}) {
  els.chartArea.hidden = true;
  els.emptyMessage.hidden = false;
  els.emptyMessage.textContent = message;
  if (chart) {
    chart.destroy();
    chart = null;
  }
}

function setRangeError(message) {
  els.rangeError.hidden = !message;
  els.rangeError.textContent = message || '';
  for (const input of [els.from, els.to]) {
    if (message) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }
}

/** Monotonic token: a slow response for an old selection/range must not overwrite a newer one. */
let loadToken = 0;

async function loadStats() {
  if (!selectedArticleId) return;
  const rangeProblem = validateRange(els.from.value, els.to.value);
  setRangeError(rangeProblem);
  const token = ++loadToken;
  if (rangeProblem) {
    showChartState({ message: 'Fix the date range to see views.' });
    return;
  }
  let stats;
  try {
    stats = await apiRequest(`/articles/${selectedArticleId}/stats?${currentRangeQuery()}`);
  } catch (err) {
    if (token !== loadToken) return;
    // The server rejects ranges that would need too many buckets (400): show its
    // message on the range fields instead of throwing or claiming "no views".
    if (err.status === 400) {
      setRangeError(err.message);
      showChartState({ message: 'Choose a shorter range or a larger bucket.' });
    } else {
      showChartState({ message: 'Could not load views. Try again.' });
    }
    return;
  }
  if (token !== loadToken) return;
  const { series, markers } = stats;

  const allZero = series.every((p) => p.count === 0);
  if (series.length === 0 || allZero) {
    showChartState({ message: NO_VIEWS });
    return;
  }
  els.chartArea.hidden = false;
  els.emptyMessage.hidden = true;
  drawChart({ series, markers, bucket: els.bucket.value });
  renderLegend(markers);
}

function clearSelection() {
  selectedArticleId = null;
  loadToken += 1;
  els.selectedTitle.textContent = 'Pick an article';
  setRangeError(null);
  showChartState({ message: HINT });
}

async function selectArticle(article) {
  selectedArticleId = article.id;
  els.selectedTitle.textContent = article.title || '(untitled)';
  els.results.innerHTML = '';
  els.searchStatus.hidden = true;
  els.search.value = '';
  await loadStats();
}

async function runSearch(query) {
  const params = new URLSearchParams({ state: 'Published', limit: '10' });
  if (query) params.set('q', query);
  const { items } = await apiRequest(`/articles?${params.toString()}`);

  els.results.innerHTML = '';
  if (items.length === 0) {
    els.searchStatus.textContent = query ? `No published articles match \u201c${query}\u201d.` : 'No published articles yet.';
    els.searchStatus.hidden = false;
    clearSelection();
    return;
  }
  els.searchStatus.hidden = true;
  for (const article of items) {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = article.title || '(untitled)';
    button.addEventListener('click', () => selectArticle(article));
    li.append(button);
    els.results.append(li);
  }
}

function wireControls() {
  els.search.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => runSearch(els.search.value.trim()), 300);
  });
  els.search.addEventListener('focus', () => {
    if (els.results.children.length === 0) runSearch('');
  });

  els.bucket.addEventListener('change', loadStats);
  els.from.addEventListener('change', loadStats);
  els.to.addEventListener('change', loadStats);
}

async function preselectFromQueryString() {
  const params = new URLSearchParams(window.location.search);
  const articleId = params.get('articleId');
  if (!articleId) return;
  const article = await apiRequest(`/articles/${articleId}`);
  await selectArticle(article);
}

async function bootstrap() {
  const user = await me();
  if (!user) {
    window.location.href = '/login';
    return;
  }
  initShell(user);

  const now = new Date();
  els.to.value = toDatetimeLocalValue(now);
  els.from.value = toDatetimeLocalValue(new Date(now.getTime() - 24 * 60 * 60 * 1000));

  wireControls();
  await preselectFromQueryString();
}

bootstrap();
