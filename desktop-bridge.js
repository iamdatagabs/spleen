/* SPLEEN Desktop bridge: local API health and SQLite experiment persistence. */
(()=> {
  const API = "http://127.0.0.1:8765/api/v1/desktop";
  const $ = id => document.getElementById(id);
  const status = $("desktopApiStatus");
  const dot = $("desktopApiDot");
  const list = $("experimentList");
  const save = $("saveExperiment");
  if (!status || !dot || !list || !save) return;
  let apiReady = false;
  save.disabled = true;
  const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  })[char]);
  async function request(path, options = {}) {
    const response = await fetch(API + path, {
      ...options,
      headers: { "Content-Type":"application/json", ...(options.headers || {}) }
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(detail.detail || "Falha na API local (" + response.status + ")");
    }
    return response.status === 204 ? null : response.json();
  }
  function setStatus(ready, message) {
    apiReady = ready;
    status.textContent = message;
    dot.dataset.state = ready ? "ready" : "offline";
    save.disabled = !ready;
  }
  function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString("pt-BR");
  }
  async function refreshExperiments() {
    if (!apiReady) return;
    try {
      const data = await request("/experiments?limit=50");
      if (!data.items.length) {
        list.innerHTML = '<p class="empty-state">Nenhum experimento salvo neste computador.</p>';
        return;
      }
      list.innerHTML = data.items.map(item => `
        <details class="experiment-item">
          <summary><span><b>${escapeHtml(item.title)}</b><small>${escapeHtml(formatDate(item.created_at))} · modelo ${escapeHtml(item.model_version)}</small></span><button type="button" class="ghost delete-experiment" data-id="${escapeHtml(item.id)}">Excluir</button></summary>
          <pre>${escapeHtml(JSON.stringify({inputs:item.inputs,results:item.results}, null, 2))}</pre>
        </details>`).join("");
    } catch (error) {
      list.innerHTML = '<p class="empty-state">Não foi possível carregar os experimentos: ' + escapeHtml(error.message) + '</p>';
    }
  }
  async function checkHealth() {
    try {
      await request("/health");
      const wasReady = apiReady;
      setStatus(true, "API local · conectada");
      if (!wasReady) await refreshExperiments();
    } catch {
      setStatus(false, "API local · indisponível");
    }
  }
  save.addEventListener("click", async () => {
    if (!apiReady || !window.SPLEEN_MODEL_STATE) return;
    save.disabled = true;
    const state = window.SPLEEN_MODEL_STATE;
    const title = "Experimento " + new Date().toLocaleString("pt-BR");
    try {
      await request("/experiments", {method:"POST", body:JSON.stringify({
        title, model_version:"0.9.0", inputs:state.inputs || {}, results:state
      })});
      save.textContent = "Salvo ✓";
      await refreshExperiments();
      window.setTimeout(() => { save.textContent = "Salvar estado atual"; save.disabled = !apiReady; }, 1800);
    } catch (error) {
      window.alert("Não foi possível salvar o experimento: " + error.message);
      save.disabled = !apiReady;
    }
  });
  list.addEventListener("click", async event => {
    const button = event.target.closest(".delete-experiment");
    if (!button) return;
    event.preventDefault();
    if (!window.confirm("Excluir este experimento salvo?")) return;
    try {
      await request("/experiments/" + encodeURIComponent(button.dataset.id), {method:"DELETE"});
      await refreshExperiments();
    } catch (error) {
      window.alert("Não foi possível excluir: " + error.message);
    }
  });
  checkHealth();
  window.setInterval(checkHealth, 5000);
})();
