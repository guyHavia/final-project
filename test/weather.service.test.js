import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';

import { createWeatherService } from '../services/weather.service.js';
import { weatherRoutes } from '../routes/weather.routes.js';
import { errorHandler } from '../middleware/error.js';
import { createLogger } from '../lib/logger.js';

const MIN = 60 * 1000;
const KEY = 'sekrit-key-123';

const okBody = (temp = 21.5) => ({
  name: 'Tel Aviv',
  main: { temp },
  weather: [{ description: 'clear sky', icon: '01d' }],
});

function okResponse(body = okBody()) {
  return { ok: true, status: 200, json: async () => body };
}

function setup({ apiKey = KEY, city = 'Tel Aviv,IL', responses = [okResponse()] } = {}) {
  const clock = { t: 1_000_000 };
  const calls = [];
  const queue = [...responses];
  const fetchFn = async (url, opts) => {
    calls.push({ url: String(url), opts });
    const next = queue.length > 1 ? queue.shift() : queue[0];
    if (next instanceof Error) throw next;
    return next;
  };
  const service = createWeatherService({
    fetchFn,
    now: () => clock.t,
    getConfig: () => ({ apiKey, city }),
  });
  return { service, clock, calls };
}

async function assertUnavailable(promise) {
  await assert.rejects(promise, (err) => {
    assert.equal(err.name, 'AppError');
    assert.equal(err.status, 503);
    assert.equal(err.code, 'service_unavailable');
    assert.ok(!err.message.includes(KEY), 'message must not leak the key');
    return true;
  });
}

describe('weather service', () => {
  test('no API key -> 503 and never fabricates data or calls upstream', async () => {
    const { service, calls } = setup({ apiKey: '' });
    await assertUnavailable(service.getWeather());
    assert.equal(calls.length, 0);
  });

  test('maps upstream payload to { city, tempC, description, icon, observedAt }', async () => {
    const { service, clock } = setup();
    const data = await service.getWeather();
    assert.deepEqual(data, {
      city: 'Tel Aviv',
      tempC: 21.5,
      description: 'clear sky',
      icon: '01d',
      observedAt: new Date(clock.t).toISOString(),
    });
  });

  test('uses WEATHER_CITY, URL-encoded via URLSearchParams', async () => {
    const { service, calls } = setup({ city: 'Haifa,IL' });
    await service.getWeather();
    const url = new URL(calls[0].url);
    assert.equal(url.searchParams.get('q'), 'Haifa,IL');
    assert.equal(url.searchParams.get('units'), 'metric');
    assert.equal(url.searchParams.get('appid'), KEY);
  });

  test('encodes a city containing a space', async () => {
    const { service, calls } = setup({ city: 'Tel Aviv,IL' });
    await service.getWeather();
    assert.ok(!calls[0].url.includes(' '));
    assert.equal(new URL(calls[0].url).searchParams.get('q'), 'Tel Aviv,IL');
  });

  test('passes an AbortSignal timeout to fetch', async () => {
    const { service, calls } = setup();
    await service.getWeather();
    assert.ok(calls[0].opts.signal instanceof AbortSignal);
  });

  test('serves from cache within 15 minutes: one upstream call', async () => {
    const { service, clock, calls } = setup();
    await service.getWeather();
    clock.t += 14 * MIN;
    await service.getWeather();
    assert.equal(calls.length, 1);
  });

  test('concurrent cold requests share one upstream call', async () => {
    const { service, calls } = setup();
    await Promise.all([service.getWeather(), service.getWeather(), service.getWeather()]);
    assert.equal(calls.length, 1);
  });

  test('refetches after 15 minutes', async () => {
    const { service, clock, calls } = setup({
      responses: [okResponse(okBody(20)), okResponse(okBody(22))],
    });
    assert.equal((await service.getWeather()).tempC, 20);
    clock.t += 15 * MIN;
    assert.equal((await service.getWeather()).tempC, 22);
    assert.equal(calls.length, 2);
  });

  test('cold cache + upstream non-2xx -> 503', async () => {
    const { service } = setup({ responses: [{ ok: false, status: 500, json: async () => ({}) }] });
    await assertUnavailable(service.getWeather());
  });

  test('cold cache + network error -> 503, error message not leaked', async () => {
    const { service } = setup({ responses: [new Error(`connect failed for appid=${KEY}`)] });
    await assertUnavailable(service.getWeather());
  });

  test('malformed upstream payload -> 503', async () => {
    const { service } = setup({ responses: [okResponse({ nope: true })] });
    await assertUnavailable(service.getWeather());
  });

  test('failure is backed off: upstream hit at most once per minute, whatever the traffic', async () => {
    const { service, clock, calls } = setup({ responses: [new Error('down')] });
    await assertUnavailable(service.getWeather());
    for (let i = 0; i < 50; i += 1) await assertUnavailable(service.getWeather());
    clock.t += 1 * MIN - 1;
    await assertUnavailable(service.getWeather());
    assert.equal(calls.length, 1);
    clock.t += 1;
    await assertUnavailable(service.getWeather());
    assert.equal(calls.length, 2);
  });

  test('recovers a minute after a failure once upstream is healthy again', async () => {
    const { service, clock } = setup({ responses: [new Error('down'), okResponse()] });
    await assertUnavailable(service.getWeather());
    clock.t += 1 * MIN;
    assert.equal((await service.getWeather()).tempC, 21.5);
  });

  test('never serves data older than 15 minutes when refresh fails (CONTEXT.md)', async () => {
    const { service, clock, calls } = setup({ responses: [okResponse(), new Error('down')] });
    await service.getWeather();
    clock.t += 15 * MIN;
    await assertUnavailable(service.getWeather());
    clock.t += 5 * MIN;
    await assertUnavailable(service.getWeather());
    assert.equal(calls.length, 3);
  });

  test('never logs the API key', async () => {
    const lines = [];
    const logger = createLogger({ write: (l) => lines.push(l) });
    const svc = createWeatherService({
      fetchFn: async () => {
        throw new Error(`boom ${KEY}`);
      },
      now: () => 1,
      getConfig: () => ({ apiKey: KEY, city: 'X' }),
      logger,
    });
    await assertUnavailable(svc.getWeather());
    assert.ok(lines.length > 0, 'failure is logged');
    assert.ok(!lines.join('').includes(KEY));
  });
});

describe('GET /api/weather', () => {
  test('default service without an API key -> 503 client-safe body', async () => {
    const app = express();
    app.use('/api/weather', weatherRoutes);
    app.use(errorHandler);
    const res = await request(app).get('/api/weather');
    assert.equal(res.status, 503);
    assert.equal(res.body.error.code, 'service_unavailable');
    assert.equal(res.body.data, undefined);
  });
});
