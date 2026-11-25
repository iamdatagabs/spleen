import { runTissueOxygenSensitivity } from "./tissue-sensitivity.mjs";

const button = document.getElementById("runTissueSensitivity");
const status = document.getElementById("tissueSensitivityStatus");
const output = document.getElementById("tissueSensitivityResults");
const exportButton = document.getElementById("exportTissueSensitivity");
let latest = null;

const fmt = value => Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
function csvValue(value) {
  const text = String(value ?? "");
  return /[",\n;]/.test(text) ? '"' + text.replaceAll('"', '""') + '"' : text;
}
function render(result) {
  const rows = result.results.map(row => `
    <tr>
      <td><strong>${row.label}</strong><small>${row.unit}</small></td>
      <td>${fmt(row.lowMeanPO2)}</td>
      <td>${fmt(result.baseline.meanPO2)}</td>
      <td>${fmt(row.highMeanPO2)}</td>
      <td>${fmt(row.meanResponsePct)}%</td>
      <td>${fmt(row.normalizedElasticity)}</td>
    </tr>`).join("");
  output.innerHTML = `
    <div class="sensitivity-baseline"><span>pO₂ média basal</span><strong>${fmt(result.baseline.meanPO2)} mmHg</strong><span>Faixa espacial: ${fmt(result.baseline.minPO2)}–${fmt(result.baseline.maxPO2)} mmHg</span></div>
    <div class="table-scroll"><table class="sensitivity-table"><thead><tr><th>Parâmetro</th><th>−25%</th><th>Base</th><th>+25%</th><th>Resposta média</th><th>Elasticidade</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="micro">Resposta média = diferença entre os cenários +25% e −25%, relativa à média basal. Elasticidade = resposta normalizada pela amplitude relativa total (50%).</p>`;
  exportButton.disabled = false;
}
button?.addEventListener("click", () => {
  button.disabled = true;
  exportButton.disabled = true;
  status.textContent = "Calculando cinco varreduras OAT…";
  requestAnimationFrame(() => {
    try {
      const state = window.SPLEEN_MODEL_STATE;
      const dynamic = state?.splenicTerritories;
      const total = Number(state?.regionalFlows?.spleen ?? .156);
      const densityIds = ["capDensitySuperior", "capDensityMiddle", "capDensityInferior"];
      const territories = [0, 1, 2].map(i => ({
        arterialInflow: Number(dynamic?.[i]?.arterialInflow ?? total / 3),
        capillaryDensity: Number(document.getElementById(densityIds[i])?.value ?? 1)
      }));
      latest = runTissueOxygenSensitivity(territories, { durationSeconds: 180, dt: 1 });
      render(latest);
      status.textContent = "Análise concluída · 5 parâmetros · perturbação ±25%";
    } catch (error) {
      status.textContent = "Falha na análise: " + error.message;
      console.error("SPLEEN tissue sensitivity failed", error);
    } finally {
      button.disabled = false;
    }
  });
});
exportButton?.addEventListener("click", () => {
  if (!latest) return;
  const headers = ["parameter", "unit", "base_value", "low_value_minus_25pct", "high_value_plus_25pct", "baseline_mean_pO2_mmhg", "low_mean_pO2_mmhg", "high_mean_pO2_mmhg", "mean_response_pct", "normalized_elasticity"];
  const rows = latest.results.map(r => [r.label, r.unit, r.baseValue, r.lowValue, r.highValue, latest.baseline.meanPO2, r.lowMeanPO2, r.highMeanPO2, r.meanResponsePct, r.normalizedElasticity]);
  const csv = [headers, ...rows].map(row => row.map(csvValue).join(";")).join("\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "spleen-tissue-oxygen-sensitivity.csv";
  anchor.click();
  URL.revokeObjectURL(url);
});
