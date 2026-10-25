import { useEffect } from 'react';
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Sun,
  type LucideIcon,
} from 'lucide-react';
import { usePanelStore, type WeatherReading } from './panelStore';

/** Clima pelo Open-Meteo: gratuito, sem chave e sem cadastro. */

const REFRESH_MS = 30 * 60 * 1000;

interface OpenMeteo {
  current: { temperature_2m: number; weather_code: number };
  daily: { temperature_2m_max: number[]; temperature_2m_min: number[] };
}

async function fetchWeather(lat: number, lon: number): Promise<WeatherReading> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    '&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&forecast_days=1&timezone=auto';
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error('clima indisponível');
  const data = (await response.json()) as OpenMeteo;
  return {
    temp: data.current.temperature_2m,
    code: data.current.weather_code,
    max: data.daily.temperature_2m_max[0] ?? data.current.temperature_2m,
    min: data.daily.temperature_2m_min[0] ?? data.current.temperature_2m,
    fetchedAt: Date.now(),
  };
}

/** Códigos WMO usados pelo Open-Meteo. */
export function describeWeather(code: number): { label: string; icon: LucideIcon } {
  if (code === 0) return { label: 'Céu limpo', icon: Sun };
  if (code <= 2) return { label: 'Parcialmente nublado', icon: CloudSun };
  if (code === 3) return { label: 'Nublado', icon: Cloud };
  if (code <= 48) return { label: 'Neblina', icon: CloudFog };
  if (code <= 57) return { label: 'Garoa', icon: CloudDrizzle };
  if (code <= 67 || (code >= 80 && code <= 82)) return { label: 'Chuva', icon: CloudRain };
  if (code <= 77 || code === 85 || code === 86) return { label: 'Neve', icon: CloudSnow };
  return { label: 'Tempestade', icon: CloudLightning };
}

/** Atualiza o clima a cada 30 minutos, só com a tela visível. */
export function useWeatherRefresh() {
  const coords = usePanelStore((s) => s.settings.weather);
  const lat = coords?.lat;
  const lon = coords?.lon;

  useEffect(() => {
    if (lat === undefined || lon === undefined) return;
    const refresh = async () => {
      const last = usePanelStore.getState().weather;
      if (document.visibilityState !== 'visible' || !navigator.onLine) return;
      if (last && Date.now() - last.fetchedAt < REFRESH_MS) return;
      try {
        usePanelStore.getState().setWeather(await fetchWeather(lat, lon));
      } catch {
        // Fica a última leitura; tenta de novo no próximo ciclo.
      }
    };
    void refresh();
    const timer = setInterval(refresh, 5 * 60 * 1000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [lat, lon]);
}
