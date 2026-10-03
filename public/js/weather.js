/*
 * Sidebar weather widget. Reads the current weather from our own server
 * (/api/weather), which caches the external service for up to 15 minutes, so
 * thousands of readers cause at most one upstream call per quarter hour.
 * Everything is built with DOM methods and textContent (no HTML from data).
 */
const widget = document.getElementById('weather-widget');

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function showUnavailable() {
  widget.replaceChildren(el('p', 'weather-unavailable', 'Weather is unavailable right now.'));
}

function show({ tempC, description, icon, observedAt }) {
  const now = el('div', 'weather-now');
  if (icon) {
    const img = el('img', 'weather-icon');
    img.src = `https://openweathermap.org/img/wn/${encodeURIComponent(icon)}@2x.png`;
    img.alt = '';
    img.width = 64;
    img.height = 64;
    now.append(img);
  }
  now.append(el('span', 'weather-temp', `${Math.round(tempC)}°C`));

  const details = el('div', 'weather-details');
  details.append(el('span', 'weather-city', 'Tel Aviv'));
  if (description) details.append(el('span', 'weather-desc', description));
  if (observedAt) {
    const time = new Date(observedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    details.append(el('span', 'weather-updated', `Updated ${time}`));
  }

  widget.replaceChildren(now, details);
}

if (widget) {
  fetch(widget.dataset.endpoint || '/api/weather', { headers: { Accept: 'application/json' } })
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`weather ${res.status}`))))
    .then((body) => show(body.data))
    .catch(showUnavailable);
}
