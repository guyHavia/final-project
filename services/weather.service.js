import { env } from '../config/env.js';

let cache = null;
let lastFetch = 0;
let fetchPromise = null;
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

export async function getWeather() {
    const now = Date.now();
    
    if (cache && (now - lastFetch < CACHE_TTL)) {
        return cache;
    }

    if (fetchPromise) {
        return fetchPromise;
    }

    if (!env.weatherApiKey) {
        // Fallback for missing API key, so tests/dev don't break
        cache = { tempC: 25, description: "Sunny", icon: "01d", observedAt: new Date().toISOString() };
        lastFetch = now;
        return cache;
    }

    fetchPromise = (async () => {
        try {
            const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=Tel Aviv&units=metric&appid=${env.weatherApiKey}`);
            if (!res.ok) {
                throw new Error(`Weather API returned ${res.status}`);
            }
            
            const data = await res.json();
            cache = {
                tempC: data.main.temp,
                description: data.weather[0].description,
                icon: data.weather[0].icon,
                observedAt: new Date().toISOString()
            };
            lastFetch = Date.now();
            return cache;
        } catch (err) {
            if (cache) return cache;
            throw err;
        } finally {
            fetchPromise = null;
        }
    })();
    
    return fetchPromise;
}
