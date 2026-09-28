import { apiRequest, me, logout } from './auth-client.js';

const els = {
  userName: document.getElementById('user-display-name'),
  logoutButton: document.getElementById('logout-button'),
  search: document.getElementById('article-search'),
  results: document.getElementById('article-results'),
  selectedTitle: document.getElementById('selected-article-title'),
  bucket: document.getElementById('bucket-select'),
  from: document.getElementById('range-from'),
  to: document.getElementById('range-to'),
  canvas: document.getElementById('views-chart'),
  emptyMessage: document.getElementById('empty-message'),
  chartArea: document.getElementById('chart-area'),
};

const MARKER_COLORS = { publish: '#16a34a', update: '#d97706' };
const MIN_LABEL_SPACING_PX = 70;

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

function formatTick(ms, bucket) {
  const date = new Date(ms);
  return bucket === 'day'
    ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function formatMarkerTime(iso) {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Greedily assigns each marker a stacked row (0, 1, 2, …) so labels close together don't overlap. */
function assignLabelRows(xPositions) {
  const lastXInRow = [];
  return xPositions.map((x) => {
    let row = 0;
    while (lastXInRow[row] !== undefined && Math.abs(x - lastXInRow[row]) < MIN_LABEL_SPACING_PX) {
      row += 1;
    }
    lastXInRow[row] = x;
    return row;
  });
}

/** Draws a labelled vertical rule at each publish/update marker, on top of the line. */
const markerPlugin = {
  id: 'publicationMarkers',
  afterDraw(chartInstance) {
    const markers = chartInstance.$markers || [];
    if (markers.length === 0) return;
    const { ctx, chartArea, scales } = chartInstance;

    const positions = markers.map((marker) => scales.x.getPixelForValue(new Date(marker.t).getTime()));
    const visible = positions
      .map((x, i) => ({ x, marker: markers[i] }))
      .filter(({ x }) => x >= chartArea.left && x <= chartArea.right);
    const rows = assignLabelRows(visible.map((v) => v.x));

    ctx.save();
    visible.forEach(({ x, marker }, i) => {
      const color = MARKER_COLORS[marker.kind] || '#666';
      ctx.strokeStyle = color;
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, chartArea.top);
      ctx.lineTo(x, chartArea.bottom);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.fillStyle = color;
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      const label = `${marker.kind === 'publish' ? 'Published' : 'Updated'} ${formatMarkerTime(marker.t)}`;
      ctx.fillText(label, x, chartArea.top + 12 + rows[i] * 14);
    });
    ctx.restore();
  },
};

function drawChart({ series, markers, bucket }) {
  const points = series.map((p) => ({ x: new Date(p.t).getTime(), y: p.count }));
  const step = bucket === 'day' ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
  const padding = step / 2;

  if (chart) chart.destroy();
  // eslint-disable-next-line no-undef -- Chart is a global from the vendored public/vendor/chart.js
  chart = new Chart(els.canvas, {
    type: 'line',
    data: {
      datasets: [
        {
          label: 'Views',
          data: points,
          borderColor: '#1a56db',
          backgroundColor: 'rgba(26, 86, 219, 0.1)',
          fill: true,
          tension: 0.15,
          pointRadius: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          type: 'linear',
          min: points.length ? points[0].x - padding : undefined,
          max: points.length ? points[points.length - 1].x + padding : undefined,
          ticks: { callback: (value) => formatTick(value, bucket) },
          title: { display: true, text: 'Time' },
        },
        y: { beginAtZero: true, title: { display: true, text: 'Views' } },
      },
      plugins: { legend: { display: false } },
    },
    plugins: [markerPlugin],
  });
  chart.$markers = markers;
}

async function loadStats() {
  if (!selectedArticleId) return;
  const { series, markers } = await apiRequest(`/articles/${selectedArticleId}/stats?${currentRangeQuery()}`);

  const allZero = series.every((p) => p.count === 0);
  if (series.length === 0 || allZero) {
    els.chartArea.hidden = true;
    els.emptyMessage.hidden = false;
    if (chart) {
      chart.destroy();
      chart = null;
    }
    return;
  }
  els.chartArea.hidden = false;
  els.emptyMessage.hidden = true;
  drawChart({ series, markers, bucket: els.bucket.value });
}

async function selectArticle(article) {
  selectedArticleId = article.id;
  els.selectedTitle.textContent = article.title || '(untitled)';
  els.results.innerHTML = '';
  els.search.value = '';
  await loadStats();
}

async function runSearch(query) {
  const params = new URLSearchParams({ state: 'Published', limit: '10' });
  if (query) params.set('q', query);
  const { items } = await apiRequest(`/articles?${params.toString()}`);

  els.results.innerHTML = '';
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
  els.logoutButton.addEventListener('click', async () => {
    await logout();
    window.location.href = '/login';
  });

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
  els.userName.textContent = user.displayName;

  const now = new Date();
  els.to.value = toDatetimeLocalValue(now);
  els.from.value = toDatetimeLocalValue(new Date(now.getTime() - 24 * 60 * 60 * 1000));

  wireControls();
  await preselectFromQueryString();
}

bootstrap();
