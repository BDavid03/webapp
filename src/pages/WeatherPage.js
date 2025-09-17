import { useEffect, useMemo, useState } from "react";
import WorldMap from "../components/WorldMap";
import { featuredCities } from "../data/featuredCities";
import "./WeatherPage.css";

const WEATHER_LABEL = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Freezing drizzle",
  57: "Freezing drizzle",
  61: "Light rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Heavy freezing rain",
  71: "Light snow",
  73: "Moderate snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Rain showers",
  81: "Heavy showers",
  82: "Violent rain showers",
  85: "Snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with hail",
  99: "Thunderstorm with heavy hail",
};

const DEGREE = String.fromCharCode(176);

const GEOCODING_ENDPOINT = "https://geocoding-api.open-meteo.com/v1/search";
const WEATHER_ENDPOINT = "https://api.open-meteo.com/v1/forecast";

// Local cache for faster perceived loads on refresh
const FEATURED_CACHE_KEY = "featured_city_conditions_v1";
const FEATURED_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function formatLocalDate(timezone) {
  if (!timezone) return "Local time unavailable";
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      month: "short",
      day: "numeric",
    }).format(new Date());
  } catch (err) {
    return "Local time unavailable";
  }
}

function formatPopulation(population) {
  if (population == null) return "Unknown";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(population);
}

async function geocodeLocation(query) {
  const response = await fetch(
    `${GEOCODING_ENDPOINT}?name=${encodeURIComponent(query)}&count=1&language=en&format=json`
  );
  if (!response.ok) throw new Error("Unable to search for that location.");
  const data = await response.json();
  const place = data?.results?.[0];
  if (!place) throw new Error("No matching location found.");

  return {
    id: `${place.latitude.toFixed(2)}_${place.longitude.toFixed(2)}`,
    name: place.name,
    country: place.country,
    latitude: place.latitude,
    longitude: place.longitude,
    population: place.population ?? null,
    timezone: place.timezone,
  };
}

async function fetchWeatherForLocation(location) {
  const { latitude, longitude, timezone } = location;
  const response = await fetch(
    `${WEATHER_ENDPOINT}?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=${encodeURIComponent(
      timezone || "auto"
    )}`
  );
  if (!response.ok) throw new Error("Weather service unavailable.");
  const data = await response.json();
  const { current } = data;
  if (!current) throw new Error("No weather data returned.");

  return {
    ...location,
    temperature: current.temperature_2m,
    humidity: current.relative_humidity_2m,
    wind: current.wind_speed_10m,
    description: WEATHER_LABEL[current.weather_code] || "Unknown conditions",
    observedAt: current.time ?? new Date().toISOString(),
  };
}

export default function WeatherPage() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const [weather, setWeather] = useState(null);
  const [cityConditions, setCityConditions] = useState({});
  const [activeCityId, setActiveCityId] = useState(null);

  useEffect(() => {
    let cancelled = false;

    // 1) Hydrate from localStorage immediately (best-effort)
    try {
      const raw = localStorage.getItem(FEATURED_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          parsed &&
          typeof parsed === "object" &&
          parsed.timestamp &&
          parsed.data &&
          Date.now() - parsed.timestamp < FEATURED_CACHE_TTL
        ) {
          setCityConditions(parsed.data);
        }
      }
    } catch (_) {
      // ignore cache errors
    }

    const loadFeatured = async () => {
      try {
        const entries = await Promise.all(
          featuredCities.map(async (city) => {
            try {
              const result = await fetchWeatherForLocation(city);
              return [city.id, result];
            } catch (err) {
              console.warn(`Weather fetch failed for ${city.name}:`, err);
              return [city.id, { ...city, temperature: null }];
            }
          })
        );
        if (!cancelled) {
          const next = Object.fromEntries(entries);
          setCityConditions(next);
          // Persist snapshot for next reload
          try {
            localStorage.setItem(
              FEATURED_CACHE_KEY,
              JSON.stringify({ timestamp: Date.now(), data: next })
            );
          } catch (_) {}
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Unable to load featured cities", err);
        }
      }
    };

    loadFeatured();
    const interval = setInterval(loadFeatured, 10 * 60 * 1000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!query.trim()) return;

    setStatus("loading");
    setError(null);
    setActiveCityId(null);

    try {
      const location = await geocodeLocation(query.trim());
      const result = await fetchWeatherForLocation(location);
      setWeather(result);
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setWeather(null);
      setError(err.message);
    }
  };

  const handleCitySelect = async (city) => {
    setActiveCityId(city.id);
    setError(null);

    const cached = cityConditions[city.id];
    if (cached) {
      setWeather(cached);
      setStatus("success");
    } else {
      setStatus("loading-city");
    }

    try {
      const result = await fetchWeatherForLocation(city);
      setCityConditions((prev) => ({ ...prev, [city.id]: result }));
      setWeather(result);
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setError(err.message);
    }
  };

  const infoBlock = useMemo(() => {
    if (!weather) return null;
    const localTime = formatLocalDate(weather.timezone);
    return (
      <div className="weather__result">
        <h2>{`${weather.name}${weather.country ? `, ${weather.country}` : ""}`}</h2>
        <div className="weather__grid">
          <div>
            <span className="weather__metric">
              {weather.temperature != null
                ? `${Math.round(weather.temperature)}${DEGREE}C`
                : "--"}
            </span>
            <span className="weather__metric-label">Temperature</span>
          </div>
          <div>
            <span className="weather__metric">
              {weather.humidity != null ? `${weather.humidity}%` : "--"}
            </span>
            <span className="weather__metric-label">Humidity</span>
          </div>
          <div>
            <span className="weather__metric">
              {weather.wind != null ? `${Math.round(weather.wind)} km/h` : "--"}
            </span>
            <span className="weather__metric-label">Wind</span>
          </div>
        </div>
        <p className="weather__description">{weather.description}</p>
        <div className="weather__meta">
          <div>
            <span className="weather__meta-label">Local time</span>
            <span className="weather__meta-value">{localTime}</span>
          </div>
          <div>
            <span className="weather__meta-label">Population</span>
            <span className="weather__meta-value">{formatPopulation(weather.population)}</span>
          </div>
        </div>
      </div>
    );
  }, [weather]);

  return (
    <section className="weather">
      <WorldMap
        cities={featuredCities}
        cityConditions={cityConditions}
        onSelectCity={handleCitySelect}
        activeCityId={activeCityId}
        width={1400}
        height={720}
        focus={{ longitude: 150, latitude: -25 }}
      />

      <div className="weather__panel">
        <aside className="weather__search weather__card">
          <div className="weather__card-header">
            <h1>Weather Explorer</h1>
            <p>Search for a city or click a marker on the map to view details.</p>
          </div>

          <form className="weather__form" onSubmit={handleSubmit}>
            <input
              type="text"
              placeholder="Try 'Sydney', 'Tokyo', or 'Mexico City'..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button type="submit" disabled={status === "loading" || status === "loading-city"}>
              {status === "loading" || status === "loading-city" ? "Searching..." : "Search"}
            </button>
          </form>

          {status === "error" && <p className="weather__error">{error}</p>}
        </aside>

        <section className="weather__details weather__card">
          {infoBlock || (
            <div className="weather__placeholder">
              <p>No city selected.</p>
              <p className="weather__hint">Use search on the left or click a marker on the map.</p>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
