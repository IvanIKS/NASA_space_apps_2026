import { useState, useEffect } from "react";
import {
  querySurface,
  saveObservation,
  getObservations,
  deleteObservation,
  type SurfaceQueryResponse,
  type Observation,
} from "./api";

function formatDeg(v: number | null, suffix = "°") {
  return v == null ? "—" : `${v.toFixed(2)}${suffix}`;
}

export default function App() {
  const [utc, setUtc] = useState("2026-10-18T05:15:00");
  const [lat, setLat] = useState("-89.9");
  const [lon, setLon] = useState("0.0");
  const [alt, setAlt] = useState("0.0");
  const [label, setLabel] = useState("");
  const [result, setResult] = useState<SurfaceQueryResponse | null>(null);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getObservations().then(setObservations).catch(() => {});
  }, []);

  async function handleQuery() {
    setLoading(true);
    setError(null);
    try {
      const r = await querySurface(utc, parseFloat(lat), parseFloat(lon), parseFloat(alt));
      setResult(r);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!result) return;
    const obs = await saveObservation({
      utc,
      lat_deg: parseFloat(lat),
      lon_deg: parseFloat(lon),
      alt_km: parseFloat(alt),
      label: label || null,
      earth_az: result.earth.azimuth_deg,
      earth_el: result.earth.elevation_deg,
      earth_range_km: result.earth.range_km,
      sun_az: result.sun.azimuth_deg,
      sun_el: result.sun.elevation_deg,
      sun_range_km: result.sun.range_km,
    });
    setObservations((prev) => [obs, ...prev]);
  }

  async function handleDelete(id: number) {
    await deleteObservation(id);
    setObservations((prev) => prev.filter((o) => o.id !== id));
  }

  return (
    <div style={{ fontFamily: "monospace", maxWidth: 700, margin: "2rem auto", padding: "0 1rem" }}>
      <h1>🌙 Moon Observer</h1>

      <section style={{ display: "grid", gap: "0.5rem", marginBottom: "1rem" }}>
        <label>UTC&nbsp;<input value={utc} onChange={(e) => setUtc(e.target.value)} style={{ width: 220 }} /></label>
        <label>Latitude (deg)&nbsp;<input value={lat} onChange={(e) => setLat(e.target.value)} style={{ width: 100 }} /></label>
        <label>Longitude (deg)&nbsp;<input value={lon} onChange={(e) => setLon(e.target.value)} style={{ width: 100 }} /></label>
        <label>Altitude (km)&nbsp;<input value={alt} onChange={(e) => setAlt(e.target.value)} style={{ width: 80 }} /></label>
        <button onClick={handleQuery} disabled={loading}>{loading ? "Querying…" : "Query"}</button>
      </section>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {result && (
        <section style={{ background: "#111", color: "#eee", padding: "1rem", borderRadius: 6, marginBottom: "1rem" }}>
          <h2>Results</h2>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Body</th>
                <th>Az</th><th>El</th><th>Range (km)</th><th>Light-time (s)</th>
              </tr>
            </thead>
            <tbody>
              {(["earth", "sun"] as const).map((b) => (
                <tr key={b}>
                  <td>{b.toUpperCase()}</td>
                  <td>{formatDeg(result[b].azimuth_deg)}</td>
                  <td>{formatDeg(result[b].elevation_deg)}</td>
                  <td>{result[b].range_km.toFixed(0)}</td>
                  <td>{result[b].lighttime_s.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem" }}>
            <input placeholder="label (optional)" value={label} onChange={(e) => setLabel(e.target.value)} />
            <button onClick={handleSave}>Save observation</button>
          </div>
        </section>
      )}

      <section>
        <h2>Saved Observations ({observations.length})</h2>
        {observations.length === 0 && <p>None yet.</p>}
        <ul style={{ listStyle: "none", padding: 0 }}>
          {observations.map((o) => (
            <li key={o.id} style={{ borderBottom: "1px solid #333", padding: "0.4rem 0", display: "flex", justifyContent: "space-between" }}>
              <span>
                {o.label ?? "—"} &nbsp;|&nbsp; {o.utc} &nbsp;|&nbsp;
                lat {o.lat_deg} lon {o.lon_deg} &nbsp;|&nbsp;
                Earth el {formatDeg(o.earth_el)} &nbsp; Sun el {formatDeg(o.sun_el)}
              </span>
              <button onClick={() => handleDelete(o.id)}>✕</button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
