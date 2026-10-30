import { useState } from "react";
import { querySurface, type SurfaceQueryResponse } from "./api";
import { InsolationChart } from "./InsolationChart";

function formatDeg(v: number | null, suffix = "°") {
  return v == null ? "—" : `${v.toFixed(2)}${suffix}`;
}

export default function App() {
  const [utc, setUtc] = useState("2026-10-18T05:15:00");
  const [lat, setLat] = useState("-89.9");
  const [lon, setLon] = useState("0.0");
  const [alt, setAlt] = useState("0.0");
  const [result, setResult] = useState<SurfaceQueryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          <p style={{ marginTop: "0.75rem" }}>
            Insolation: <strong>{result.insolation.insolation_watts.toFixed(1)} W/m²</strong>
          </p>
          <InsolationChart data={result.insolation.insolation_graph} currentUtc={utc} />
        </section>
      )}
    </div>
  );
}
