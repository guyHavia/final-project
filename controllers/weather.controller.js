import { getWeather } from '../services/weather.service.js';
import { sendData } from '../lib/respond.js';

export async function get(req, res) {
    const data = await getWeather();
    sendData(res, data);
}
