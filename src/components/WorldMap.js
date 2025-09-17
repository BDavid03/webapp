import { useEffect, useMemo, useState } from "react";
import { feature } from "topojson-client";
import { geoNaturalEarth1, geoPath, geoCircle } from "d3-geo";
import SunCalc from "suncalc";
import "./WorldMap.css";

const WORLD_TOPO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

function computeTerminatorPoints(date) {
  const points = [];
  for (let lon = -180; lon <= 180; lon += 4) {
    let low = -90;
    let high = 90;
    const altitudeLow = SunCalc.getPosition(date, low, lon).altitude;
    const altitudeHigh = SunCalc.getPosition(date, high, lon).altitude;

    if (altitudeLow > 0 && altitudeHigh > 0) {
      points.push([lon, 90]);
      continue;
    }

    if (altitudeLow < 0 && altitudeHigh < 0) {
      points.push([lon, -90]);
      continue;
    }

    let lat = 0;
    for (let i = 0; i < 16; i += 1) {
      lat = (low + high) / 2;
      const altitude = SunCalc.getPosition(date, lat, lon).altitude;
      if (altitude > 0) {
        high = lat;
      } else {
        low = lat;
      }
    }
    points.push([lon, lat]);
  }
  return points;
}

function estimateSubsolarPoint(date) {
  let best = { latitude: 0, longitude: 0, altitude: -Infinity };
  for (let lat = -60; lat <= 60; lat += 2) {
    for (let lon = -180; lon <= 180; lon += 5) {
      const altitude = SunCalc.getPosition(date, lat, lon).altitude;
      if (altitude > best.altitude) {
        best = { latitude: lat, longitude: lon, altitude };
      }
    }
  }
  return best;
}

function temperatureColor(temp) {
  if (temp == null || Number.isNaN(temp)) return "#9ca3af";
  if (temp <= 0) return "#60a5fa";
  if (temp <= 10) return "#38bdf8";
  if (temp <= 20) return "#34d399";
  if (temp <= 30) return "#facc15";
  return "#fb7185";
}

const DEGREE = String.fromCharCode(176);

function formatLocalTimeLabel(timezone) {
  if (!timezone) return "Time unknown";
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date());
  } catch (_err) {
    return "Time unknown";
  }
}

function formatPopulationShort(population) {
  if (population == null) return "Population unknown";
  if (population >= 1_000_000) {
    return `${(population / 1_000_000).toFixed(1)}M`;
  }
  if (population >= 1_000) {
    return `${(population / 1_000).toFixed(1)}K`;
  }
  return String(population);
}

export default function WorldMap({
  cities,
  cityConditions,
  onSelectCity,
  activeCityId,
  width = 1100,
  height = 620,
  focus = { longitude: 150, latitude: -25 },
  children,
}) {
  const [countries, setCountries] = useState(null);
  const [sunSnapshot, setSunSnapshot] = useState({ date: new Date(), terminator: [], subsolar: null });
  const [geoTools, setGeoTools] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch(WORLD_TOPO_URL);
        const topoJson = await response.json();
        if (cancelled) return;
        const collection = feature(topoJson, topoJson.objects.countries);
        setCountries(collection);
      } catch (error) {
        console.error("Failed to load world map data", error);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const updateSun = () => {
      const date = new Date();
      const terminator = computeTerminatorPoints(date);
      const subsolar = estimateSubsolarPoint(date);
      setSunSnapshot({ date, terminator, subsolar });
    };

    updateSun();
    const interval = setInterval(updateSun, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const projection = geoNaturalEarth1()
      .rotate([-(focus?.longitude ?? 0), 0])
      .center([0, focus?.latitude ?? 0])
      .fitExtent(
        [[20, 20], [width - 20, height - 20]],
        { type: "Sphere" }
      );
    const pathGenerator = geoPath(projection);
    setGeoTools({ projection, pathGenerator, geoCircle });
  }, [focus?.latitude, focus?.longitude, height, width]);

  const pathGenerator = geoTools?.pathGenerator ?? null;
  const projectPoint = geoTools?.projection
    ? (coords) => geoTools.projection(coords)
    : undefined;

  const terminatorFeature = useMemo(() => {
    if (!sunSnapshot.terminator.length) return null;
    return {
      type: "Feature",
      geometry: { type: "LineString", coordinates: sunSnapshot.terminator },
    };
  }, [sunSnapshot.terminator]);

  const daylightFeature = useMemo(() => {
    if (!sunSnapshot.subsolar || !geoTools?.geoCircle) return null;
    return geoTools.geoCircle()
      .center([sunSnapshot.subsolar.longitude, sunSnapshot.subsolar.latitude])
      .radius(90)
      .precision(2)();
  }, [geoTools, sunSnapshot.subsolar]);

  // Equator as a dashed line across latitude 0
  const equatorFeature = useMemo(() => {
    const coords = [];
    for (let lon = -180; lon <= 180; lon += 2) coords.push([lon, 0]);
    return { type: "Feature", geometry: { type: "LineString", coordinates: coords } };
  }, []);

  const handleMarkerKey = (event, city) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelectCity(city);
    }
  };

  const mapReady = Boolean(geoTools && projectPoint);

  const projectedCities = mapReady
    ? cities.map((city) => ({ city, point: projectPoint([city.longitude, city.latitude]) }))
    : [];

  return (
    <div className="world-map" aria-live="polite">
      {mapReady ? (
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Global day night map">
          <defs>
            <radialGradient id="world-map-sunlight" cx="50%" cy="50%" r="65%">
              <stop offset="0%" stopColor="rgba(255, 255, 255, 0.7)" />
              <stop offset="100%" stopColor="rgba(255, 255, 255, 0.05)" />
            </radialGradient>
          </defs>

          <rect width={width} height={height} className="world-map__ocean" />

          {countries?.features?.map((featureItem) => (
            <path key={featureItem.id} d={pathGenerator(featureItem)} className="world-map__country" />
          ))}

          {daylightFeature && <path d={pathGenerator(daylightFeature)} className="world-map__daylight" />}

          {terminatorFeature && <path d={pathGenerator(terminatorFeature)} className="world-map__terminator" />}

          {equatorFeature && <path d={pathGenerator(equatorFeature)} className="world-map__equator" />}

          {projectedCities.map(({ city, point }) => {
            const [x, y] = point || [];
            if (Number.isNaN(x) || Number.isNaN(y)) return null;
            const conditions = cityConditions[city.id] || city;
            const temperature = conditions?.temperature;
            const timezone = conditions?.timezone || city.timezone;
            const localTime = formatLocalTimeLabel(timezone);
            const population = formatPopulationShort(conditions.population ?? city.population);
            const isSelected = activeCityId === city.id;

            return (
              <g
                key={city.id}
                className="world-map__city"
                transform={`translate(${x}, ${y})`}
                onClick={() => onSelectCity(city)}
                onKeyDown={(event) => handleMarkerKey(event, city)}
                role="button"
                tabIndex={0}
              >
                <circle
                  r={isSelected ? 6 : 4.5}
                  fill={temperatureColor(temperature)}
                  stroke={isSelected ? "#111827" : "white"}
                  strokeWidth={isSelected ? 2 : 1}
                />
                {temperature != null && (
                  <text className="world-map__temp" x={0} y={-10} textAnchor="middle">
                    {`${Math.round(temperature)}${DEGREE}`}
                  </text>
                )}
                <text className="world-map__label" x={0} y={16} textAnchor="middle">
                  {localTime}
                </text>
                <text className="world-map__label" x={0} y={30} textAnchor="middle">
                  {population}
                </text>
                <title>
                  {`${city.name}, ${city.country}
Temperature: ${temperature != null ? Math.round(temperature) + DEGREE + "C" : "--"}
Local: ${localTime}
Population: ${population}`}
                </title>
              </g>
            );
          })}
        </svg>
      ) : (
        <div className="world-map__loading">Loading globe...</div>
      )}
      <div className="world-map__footer">
        <div className="world-map__timestamp">Snapshot: {sunSnapshot.date.toUTCString()}</div>
        {children && <div className="world-map__details">{children}</div>}
      </div>
    </div>
  );
}
