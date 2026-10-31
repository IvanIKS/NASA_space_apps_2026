import { useEffect, useState, type FormEvent } from "react";
import { InsolationChart } from "./InsolationChart";
import { nowUtc, type Selection } from "./useSelection";
import type { SurfaceQueryState } from "./useSurfaceQuery";

interface Props {
  selection: Selection;
  onChange: (selection: Selection) => void;
  query: SurfaceQueryState;
}

const deg = (v: number) => `${v.toFixed(2)}°`;

export function AnalyticsPanel({ selection, onChange, query }: Props) {
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [utc, setUtc] = useState(selection.utc);

  // A click on the globe overwrites whatever is being typed.
  useEffect(() => {
    setLat(selection.point ? String(selection.point.lat) : "");
    setLon(selection.point ? String(selection.point.lon) : "");
    setUtc(selection.utc);
  }, [selection]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onChange({
      point: lat && lon ? { lat: parseFloat(lat), lon: parseFloat(lon) } : selection.point,
      // datetime-local drops ":00" seconds; the backend wants the full HH:MM:SS.
      utc: utc.length === 16 ? `${utc}:00` : utc,
    });
  }

  const { data, loading, error } = query;

  return (
    <div className="analytics">
      <h2>Analytics</h2>

      <form className="coords" onSubmit={handleSubmit}>
        <label>
          Latitude
          <input type="number" step="any" min={-90} max={90} required value={lat}
            onChange={(e) => setLat(e.target.value)} />
        </label>
        <label>
          Longitude
          <input type="number" step="any" min={-180} max={180} required value={lon}
            onChange={(e) => setLon(e.target.value)} />
        </label>
        <label className="wide">
          Time (UTC)
          <input type="datetime-local" step={1} required value={utc}
            onChange={(e) => setUtc(e.target.value)} />
        </label>
        <div className="actions">
          <button type="button" onClick={() => setUtc(nowUtc())}>Now</button>
          <button type="submit">Apply</button>
        </div>
      </form>

      {!selection.point && <p className="hint">Click anywhere on the Moon to pick a point.</p>}
      {error && <p className="error">{error}</p>}

      {data && (
        <div className={loading ? "results stale" : "results"}>
          <table className="bodies">
            <thead>
              <tr><th /><th>Azimuth</th><th>Elevation</th></tr>
            </thead>
            <tbody>
              <tr><td>Sun</td><td>{deg(data.sun.azimuth_deg)}</td><td>{deg(data.sun.elevation_deg)}</td></tr>
              <tr><td>Earth</td><td>{deg(data.earth.azimuth_deg)}</td><td>{deg(data.earth.elevation_deg)}</td></tr>
            </tbody>
          </table>

          <h3>Illumination</h3>
          <p className="metric">
            {data.insolation.insolation_watts.toFixed(1)} <span>W/m² now</span>
          </p>
          <InsolationChart data={data.insolation.insolation_graph} currentUtc={selection.utc} />
          <p className="caption">±1 lunar day around the selected time, hourly samples.</p>
        </div>
      )}
      {loading && !data && <p className="hint">Loading…</p>}
    </div>
  );
}
