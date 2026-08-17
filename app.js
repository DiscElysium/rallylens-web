(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));
  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  const lerp = (a, b, t) => a + (b - a) * t;
  const duration = 45;

  const stateLabels = {
    mutual_flow: "互惠流",
    p2_activation_lead: "P2 激活领先",
    mixed_transition_1: "混合过渡 1",
    mixed_transition_2: "混合过渡 2",
    low_engagement_reset: "低参与重置",
    high_load_misalignment: "高负荷错位",
    p1_activation_lead: "P1 激活领先"
  };

  const stateDescriptions = {
    mutual_flow: "双方活动、匹配和可练性同时较高；这是无监督运动模式，不是心理 flow 诊断。",
    p2_activation_lead: "P2 的运动激活与持续领先；表示运动领先，不等于教学领导。",
    mixed_transition_1: "当前共同参与较低但激活相近，是需要结合视频理解的过渡状态。",
    mixed_transition_2: "活动与可练区处于中间水平；过渡簇名称不承诺训练质量。",
    low_engagement_reset: "共同活动进入低谷；可能是暂停、漏检或真正的低参与。",
    high_load_misalignment: "一方负荷较高而激活匹配较低；系统无法仅凭运动代理判断原因。",
    p1_activation_lead: "P1 的运动激活与持续领先；表示运动领先，不等于因果贡献。"
  };

  const axisAngles = {
    relation_drift: -180,
    effective_opportunity: -145,
    role_fluidity: -112,
    target_matched_exposure: -79,
    response_conversion: -47,
    joint_trainability: -16,
    reciprocity: 16,
    co_regulation: 47,
    mutual_workable_zone: 79,
    tempo_coordination: 112,
    support_cost: 145
  };

  const targetReferenceA = {
    effective_opportunity: 0.66,
    target_matched_exposure: 0.84,
    response_conversion: 0.66,
    support_cost: 0.25,
    joint_trainability: 0.7,
    mutual_workable_zone: 0.65,
    reciprocity: 0.68,
    co_regulation: 0.7,
    role_fluidity: 0.56,
    tempo_coordination: 0.68,
    relation_drift: 0.04
  };

  const targetReferenceB = {
    effective_opportunity: 0.62,
    target_matched_exposure: 0.76,
    response_conversion: 0.8,
    support_cost: 0.28,
    joint_trainability: 0.7,
    mutual_workable_zone: 0.72,
    reciprocity: 0.72,
    co_regulation: 0.74,
    role_fluidity: 0.64,
    tempo_coordination: 0.72,
    relation_drift: 0.04
  };

  const shapeMetricCopy = {
    effective_opportunity: "向外＝双方共同活动窗口更多",
    target_matched_exposure: "向外＝目标匹配暴露更高；缺失时显示内凹缺口",
    response_conversion: "向外＝运动回应转化代理更高",
    support_cost: "反向轴：向外＝配合成本更低",
    joint_trainability: "向外＝共同可训练性更高",
    mutual_workable_zone: "向外＝双方舒适可练区更大",
    reciprocity: "向外＝双方运动回应更互惠",
    co_regulation: "向外＝滞后运动关联更强；不表示因果",
    role_fluidity: "向外＝运动角色切换更充分",
    tempo_coordination: "向外＝双方节奏协同更高",
    relation_drift: "反向轴：向外＝关系漂移更低"
  };

  const stageNames = { A: "自然", B: "目标", C: "协同", D: "小局" };
  const stageLongNames = { A: "自然打", B: "目标练习", C: "协同调整", D: "计分小局" };
  const stageColors = { A: "#f04a18", B: "#ed7952", C: "#55aa9d", D: "#121722" };
  const metricViewGroups = {
    dynamics: ["effective_opportunity", "support_cost", "joint_trainability", "mutual_workable_zone", "tempo_coordination", "relation_drift"],
    stageBars: ["response_conversion", "reciprocity", "co_regulation", "role_fluidity", "resilience"],
    humanEvidence: ["target_matched_exposure", "challenge_fit"],
    special: ["partner_incremental_contribution", "stage_transfer", "repeat_after_error"]
  };
  const dynamicChartColors = {
    effective_opportunity: "#f04a18",
    support_cost: "#d46b47",
    joint_trainability: "#121722",
    mutual_workable_zone: "#55aa9d",
    tempo_coordination: "#2f8f82",
    relation_drift: "#746f69"
  };

  const videoA = $("#videoA");
  const videoB = $("#videoB");
  const playButton = $("#playButton");
  const playLabel = $("#playLabel");
  const muteButton = $("#muteButton");
  const seekBar = $("#seekBar");
  const currentTimeLabel = $("#currentTime");
  const blobA = $("#blobA");
  const blobB = $("#blobB");
  const blobBClipPath = $("#blobBClipPath");
  const overlapRegion = $("#overlapRegion");
  const overlapReadout = $("#overlapReadout");
  const targetUnion = $("#targetUnion");
  const targetUnionHighlight = $("#targetUnionHighlight");
  const metricMarkers = $("#metricMarkers");
  const canvas = $("#sliceCanvas");
  const canvasWrap = $("#sliceCanvasWrap");
  const tooltip = $("#sliceTooltip");
  const ctx = canvas.getContext("2d");

  let metricCatalog = [];
  let metricById = new Map();
  let liveMetrics = [];
  let liveRows = [];
  let stageRows = [];
  let selectedMetricId = "effective_opportunity";
  let selectedShapeMetricId = null;
  let targetUnionSelected = false;
  let targetTime = 0;
  let displayTime = 0;
  let previousFrameTime = performance.now();
  let lastRenderedTime = -1;
  let canvasDirty = true;
  let stageNoticeTimer;
  let activeStageId = "A";

  function parseCsvLine(line) {
    const cells = [];
    let value = "";
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"') {
        if (quoted && line[i + 1] === '"') {
          value += '"';
          i += 1;
        } else {
          quoted = !quoted;
        }
      } else if (char === "," && !quoted) {
        cells.push(value);
        value = "";
      } else {
        value += char;
      }
    }
    cells.push(value);
    return cells;
  }

  function parseCsv(text) {
    const lines = text.replace(/^\uFEFF/, "").trim().split(/\r?\n/);
    const headers = parseCsvLine(lines[0]);
    return lines.slice(1).filter(Boolean).map((line) => {
      const cells = parseCsvLine(line);
      return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
    });
  }

  function numberOrNull(value) {
    if (value == null || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  async function loadFrozenData() {
    const [liveText, stageText, catalog] = await Promise.all([
      fetch("data/live-g01-s1-a-45s.csv").then((response) => response.text()),
      fetch("data/stage-g01-s1.csv").then((response) => response.text()),
      fetch("data/metric-catalog.json").then((response) => response.json())
    ]);

    metricCatalog = catalog.metrics;
    metricById = new Map(metricCatalog.map((metric) => [metric.id, metric]));
    liveMetrics = metricCatalog.filter((metric) => metric.live_available);
    const metricIds = metricCatalog.map((metric) => metric.id);

    liveRows = parseCsv(liveText).map((row) => {
      const parsed = {
        t: Number(row.time_s),
        state: row.state_id,
        confidence: numberOrNull(row.posterior_confidence),
        entropy: numberOrNull(row.posterior_entropy),
        observability: numberOrNull(row.observability),
        p1: numberOrNull(row.p1_movement_intensity),
        p2: numberOrNull(row.p2_movement_intensity)
      };
      liveMetrics.forEach((metric) => {
        parsed[metric.id] = numberOrNull(row[metric.id]);
      });
      return parsed;
    });

    stageRows = parseCsv(stageText).map((row) => {
      const parsed = { stage: row.stage_id };
      metricIds.forEach((id) => {
        parsed[id] = numberOrNull(row[id]);
      });
      return parsed;
    });
  }

  function catmullRom(p0, p1, p2, p3, t) {
    const t2 = t * t;
    const t3 = t2 * t;
    return 0.5 * (
      2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3
    );
  }

  function interpolateSeries(id, index, localT) {
    const p1 = liveRows[index];
    const p2 = liveRows[Math.min(liveRows.length - 1, index + 1)];
    const v1 = p1[id];
    const v2 = p2[id];
    if (v1 == null || v2 == null) return v1 ?? v2 ?? null;
    const p0 = liveRows[Math.max(0, index - 1)][id];
    const p3 = liveRows[Math.min(liveRows.length - 1, index + 2)][id];
    if (p0 == null || p3 == null) return lerp(v1, v2, localT);
    return clamp(catmullRom(p0, v1, v2, p3, localT));
  }

  function metricsAt(time) {
    const safeTime = clamp(time, 0, duration);
    let index = liveRows.findIndex((row) => row.t > safeTime) - 1;
    if (index < 0) index = 0;
    if (index >= liveRows.length - 1) index = liveRows.length - 1;
    const current = liveRows[index];
    const next = liveRows[Math.min(liveRows.length - 1, index + 1)];
    const span = Math.max(0.001, next.t - current.t);
    const localT = clamp((safeTime - current.t) / span);
    const nearest = localT < 0.5 ? current : next;
    const result = {
      time: safeTime,
      state: nearest.state,
      confidence: interpolateSeries("confidence", index, localT),
      entropy: interpolateSeries("entropy", index, localT),
      observability: interpolateSeries("observability", index, localT),
      p1: interpolateSeries("p1", index, localT),
      p2: interpolateSeries("p2", index, localT)
    };
    liveMetrics.forEach((metric) => {
      result[metric.id] = interpolateSeries(metric.id, index, localT);
    });
    return result;
  }

  function formatTime(time) {
    const safe = Math.max(0, time || 0);
    const minutes = Math.floor(safe / 60);
    const seconds = safe - minutes * 60;
    return `${String(minutes).padStart(2, "0")}:${seconds.toFixed(1).padStart(4, "0")}`;
  }

  function formatMetricValue(metric, value, compact = false) {
    if (value == null) return "—";
    if (metric.id === "partner_incremental_contribution") {
      const signed = value > 0 ? "+" : "";
      return `${signed}${(value * 100).toFixed(compact ? 0 : 1)}`;
    }
    return `${(value * 100).toFixed(compact ? 0 : 1)}`;
  }

  function metricStatus(metric) {
    if (metric.id === "repeat_after_error") return { label: "阻断", className: "is-blocked" };
    if (metric.live_available) return { label: "实时 + 阶段", className: "" };
    return { label: "仅阶段", className: "" };
  }

  function averageAvailable(values, fallback = 0) {
    const available = values.filter((value) => value != null && Number.isFinite(value));
    return available.length ? available.reduce((sum, value) => sum + value, 0) / available.length : fallback;
  }

  function relationshipCloseness(metrics) {
    return averageAvailable([
      metrics.joint_trainability,
      metrics.mutual_workable_zone,
      metrics.reciprocity,
      metrics.co_regulation,
      metrics.tempo_coordination
    ], 0.24);
  }

  function shapeScore(metricId, rawValue) {
    if (rawValue == null) return null;
    if (metricId === "support_cost") return clamp(1 - rawValue);
    if (metricId === "relation_drift") return clamp(1 - rawValue / 0.16);
    return clamp(rawValue);
  }

  function polygonPath(points) {
    return points.map((point, index) => `${index ? "L" : "M"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ") + " Z";
  }

  function metricPoints(cx, cy, baseRadius, values, direction = 1) {
    const ordered = [...liveMetrics].sort((a, b) => axisAngles[a.id] - axisAngles[b.id]);
    return ordered.map((metric) => {
      const rawValue = values[metric.id];
      const score = shapeScore(metric.id, rawValue);
      const radius = baseRadius * (score == null ? 0.28 : 0.46 + score * 0.6);
      const angle = (axisAngles[metric.id] * Math.PI) / 180;
      return {
        id: metric.id,
        number: metric.number,
        rawValue,
        score,
        missing: score == null,
        x: cx + Math.cos(angle) * radius * direction,
        y: cy + Math.sin(angle) * radius
      };
    });
  }

  function appendMetricMarker(point) {
    if (point.missing) {
      const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
      group.classList.add("missing-axis-marker");
      [[-6, -6, 6, 6], [-6, 6, 6, -6]].forEach(([x1, y1, x2, y2]) => {
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", (point.x + x1).toFixed(2));
        line.setAttribute("y1", (point.y + y1).toFixed(2));
        line.setAttribute("x2", (point.x + x2).toFixed(2));
        line.setAttribute("y2", (point.y + y2).toFixed(2));
        group.appendChild(line);
      });
      metricMarkers.appendChild(group);
      return;
    }
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", point.x.toFixed(2));
    circle.setAttribute("cy", point.y.toFixed(2));
    circle.setAttribute("r", "9");
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", point.x.toFixed(2));
    text.setAttribute("y", point.y.toFixed(2));
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("dy", "3");
    text.textContent = String(point.number).padStart(2, "0");
    group.append(circle, text);
    metricMarkers.appendChild(group);
  }

  function updateMetricMarkers(pointsA, pointsB) {
    metricMarkers.replaceChildren();
    if (!selectedShapeMetricId) return;
    const pointA = pointsA.find((point) => point.id === selectedShapeMetricId);
    const pointB = pointsB.find((point) => point.id === selectedShapeMetricId);
    if (pointA) appendMetricMarker(pointA);
    if (pointB) appendMetricMarker(pointB);
  }

  function updateRelationship(metrics) {
    const closeness = relationshipCloseness(metrics);
    const gap = lerp(204, 44, closeness);
    const centerA = { x: 310 - gap / 2, y: 258 };
    const centerB = { x: 310 + gap / 2, y: 258 };
    const pointsA = metricPoints(centerA.x, centerA.y, 94, metrics, 1);
    const pointsB = metricPoints(centerB.x, centerB.y, 94, metrics, -1);

    const targetPointsA = metricPoints(252, 258, 122, targetReferenceA, 1);
    const targetPointsB = metricPoints(368, 258, 122, targetReferenceB, -1);
    const targetPath = `${polygonPath(targetPointsA)} ${polygonPath([...targetPointsB].reverse())}`;
    const pathA = polygonPath(pointsA);
    const pathB = polygonPath(pointsB);
    targetUnion.setAttribute("d", targetPath);
    targetUnionHighlight.setAttribute("d", targetPath);
    targetUnionHighlight.style.display = targetUnionSelected ? "block" : "none";
    blobA.setAttribute("d", pathA);
    blobB.setAttribute("d", pathB);
    blobBClipPath.setAttribute("d", pathB);
    overlapRegion.setAttribute("d", pathA);
    overlapReadout.textContent = `OVERLAP DRIVER ${Math.round(closeness * 100)} / 关系靠近代理`;
    updateMetricMarkers(pointsA, pointsB);

    const stateLabel = stateLabels[metrics.state] || metrics.state || "关系状态未知";
    $("#relationKicker").textContent = `OBS ${Math.round((metrics.observability ?? 0) * 100)}% · POSTERIOR ${Math.round((metrics.confidence ?? 0) * 100)}%`;
    $("#relationState").textContent = stateLabel;
    $("#relationSentence").textContent = stateDescriptions[metrics.state] || "当前关系状态来自无监督运动模式。";
    $("#confidenceValue").textContent = `${Math.round((metrics.confidence ?? 0) * 100)}%`;
  }

  function updateReadout(time, metrics) {
    currentTimeLabel.textContent = formatTime(time);
    seekBar.value = String(time);
    seekBar.style.setProperty("--seek-progress", `${(time / duration) * 100}%`);
    $("#metricA").textContent = formatMetricValue(metricById.get("joint_trainability"), metrics.joint_trainability, true);
    $("#metricB").textContent = formatMetricValue(metricById.get("mutual_workable_zone"), metrics.mutual_workable_zone, true);
    $("#metricMutual").textContent = formatMetricValue(metricById.get("co_regulation"), metrics.co_regulation, true);
    $("#metricFlow").textContent = formatMetricValue(metricById.get("tempo_coordination"), metrics.tempo_coordination, true);
    $("#eventIndex").textContent = `${String(Math.min(45, Math.floor(time) + 1)).padStart(2, "0")} / 45`;
    $("#eventTime").textContent = formatTime(time);
    $("#eventTitle").textContent = stateLabels[metrics.state] || "关系状态未知";
    $("#eventEvidence").textContent = `可观察性 ${Math.round((metrics.observability ?? 0) * 100)}% · 状态后验 ${Math.round((metrics.confidence ?? 0) * 100)}% · P1/P2 运动强度 ${Math.round((metrics.p1 ?? 0) * 100)} / ${Math.round((metrics.p2 ?? 0) * 100)}。`;
    updateShapeMetricCards(metrics);
    updateMatrixCurrent(metrics);
    updateMetricStory(time, metrics);
  }

  function buildStageAtlas() {
    const profileGrid = $("#stageProfileGrid");
    profileGrid.replaceChildren();

    ["A", "B", "C", "D"].forEach((stageId, index) => {
      const row = stageRows.find((item) => item.stage === stageId);
      const closeness = relationshipCloseness(row);
      const gap = lerp(96, 22, closeness);
      const pointsA = metricPoints(140 - gap / 2, 86, 48, row, 1);
      const pointsB = metricPoints(140 + gap / 2, 86, 48, row, -1);
      const pathA = polygonPath(pointsA);
      const pathB = polygonPath(pointsB);
      const clipId = `stage-profile-clip-${stageId}`;
      const missingAxes = [...liveMetrics]
        .sort((a, b) => a.number - b.number)
        .filter((metric) => row[metric.id] == null);
      const observedAxes = liveMetrics.length - missingAxes.length;
      const card = document.createElement("button");
      card.type = "button";
      card.className = "stage-profile-card";
      card.dataset.stage = stageId;
      card.style.setProperty("--stage-color", stageColors[stageId]);
      card.setAttribute("aria-label", `${stageId} ${stageNames[stageId]}阶段，${observedAxes} 个可用轮廓轴，关系靠近代理 ${Math.round(closeness * 100)}`);
      card.innerHTML = `
        <span class="stage-profile-head">
          <span>${stageId} / ${String(index + 1).padStart(2, "0")}</span>
          <em>${observedAxes} / ${liveMetrics.length} AXES</em>
        </span>
        <span class="stage-profile-visual" aria-hidden="true">
          <svg viewBox="0 0 280 172">
            <defs><clipPath id="${clipId}"><path d="${pathB}"></path></clipPath></defs>
            <path class="stage-profile-shape-a" d="${pathA}"></path>
            <path class="stage-profile-shape-b" d="${pathB}"></path>
            <path class="stage-profile-overlap" d="${pathA}" clip-path="url(#${clipId})"></path>
          </svg>
        </span>
        <span class="stage-profile-body">
          <strong>${stageNames[stageId]}阶段</strong>
          <small>关系靠近代理 ${Math.round(closeness * 100)} · 两形状距离与真实交集使用同一映射</small>
          <small>${missingAxes.length ? `缺口：${missingAxes.map((metric) => String(metric.number).padStart(2, "0")).join(" / ")}` : "十一轴数据完整"}</small>
        </span>`;
      card.addEventListener("click", () => selectStage(stageId, true));
      profileGrid.appendChild(card);
    });
  }

  function dynamicDomain(metricId) {
    return metricId === "relation_drift" ? { min: 0, max: 0.16, top: "16" } : { min: 0, max: 1, top: "100" };
  }

  function dynamicPath(metricId) {
    const domain = dynamicDomain(metricId);
    const xStart = 38;
    const xEnd = 410;
    const yTop = 12;
    const yBottom = 98;
    let path = "";
    let drawing = false;
    for (let index = 0; index <= 90; index += 1) {
      const time = (index / 90) * duration;
      const value = metricsAt(time)[metricId];
      if (value == null) {
        drawing = false;
        continue;
      }
      const normalized = clamp((value - domain.min) / (domain.max - domain.min));
      const x = lerp(xStart, xEnd, index / 90);
      const y = lerp(yBottom, yTop, normalized);
      path += `${drawing ? " L" : "M"} ${x.toFixed(2)} ${y.toFixed(2)}`;
      drawing = true;
    }
    return path;
  }

  function metricLabelMarkup(metric, valueMarkup = "") {
    return `<span class="metric-viz-label"><b>${String(metric.number).padStart(2, "0")}</b><span><strong>${metric.label}</strong><small>${metric.evidence_status}</small></span>${valueMarkup}</span>`;
  }

  function buildMetricStoryViews() {
    const dynamicGrid = $("#dynamicMetricGrid");
    const stageBarGrid = $("#stageBarGrid");
    const humanGrid = $("#humanEvidenceGrid");
    const specialGrid = $("#specialMetricGrid");
    [dynamicGrid, stageBarGrid, humanGrid, specialGrid].forEach((container) => container.replaceChildren());

    metricViewGroups.dynamics.forEach((metricId) => {
      const metric = metricById.get(metricId);
      const domain = dynamicDomain(metricId);
      const card = document.createElement("button");
      card.type = "button";
      card.className = "metric-viz-card dynamic-metric-card";
      card.dataset.metric = metricId;
      card.setAttribute("aria-label", `${metric.number} ${metric.label}，当前 45 秒片段折线`);
      card.style.setProperty("--chart-color", dynamicChartColors[metricId]);
      card.innerHTML = `
        ${metricLabelMarkup(metric, `<em id="story-live-${metricId}">—</em>`)}
        <span class="dynamic-chart" aria-hidden="true">
          <svg viewBox="0 0 430 118">
            <line class="dynamic-gridline" x1="38" y1="12" x2="410" y2="12"></line>
            <line class="dynamic-gridline" x1="38" y1="55" x2="410" y2="55"></line>
            <line class="dynamic-gridline" x1="38" y1="98" x2="410" y2="98"></line>
            <text class="dynamic-axis-label" x="2" y="15">${domain.top}</text>
            <text class="dynamic-axis-label" x="20" y="101">0</text>
            <text class="dynamic-axis-label" x="38" y="114">00:00</text>
            <text class="dynamic-axis-label" x="410" y="114" text-anchor="end">00:45</text>
            <path class="dynamic-line" d="${dynamicPath(metricId)}"></path>
            <line class="dynamic-playhead" data-metric="${metricId}" data-domain-min="${domain.min}" data-domain-max="${domain.max}" x1="38" y1="8" x2="38" y2="102"></line>
            <circle class="dynamic-playhead-dot" data-metric="${metricId}" data-domain-min="${domain.min}" data-domain-max="${domain.max}" cx="38" cy="98" r="4"></circle>
          </svg>
        </span>`;
      card.addEventListener("click", () => setSelectedMetric(metricId, true));
      dynamicGrid.appendChild(card);
    });

    metricViewGroups.stageBars.forEach((metricId) => {
      const metric = metricById.get(metricId);
      const card = document.createElement("button");
      card.type = "button";
      card.className = "metric-viz-card stage-bar-card";
      card.dataset.metric = metricId;
      card.setAttribute("aria-label", `${metric.number} ${metric.label}，四阶段柱状比较`);
      const bars = ["A", "B", "C", "D"].map((stageId) => {
        const value = stageRows.find((row) => row.stage === stageId)?.[metricId] ?? null;
        return `<span class="stage-bar-row stage-linked-mark" data-stage="${stageId}"><span>${stageId}</span><span class="stage-bar-track"><span class="stage-bar-fill" style="--bar:${value == null ? 0 : clamp(value) * 100}%;--stage-color:${stageColors[stageId]}"></span></span><em>${formatMetricValue(metric, value, true)}</em></span>`;
      }).join("");
      card.innerHTML = `
        ${metricLabelMarkup(metric)}
        <span class="stage-bar-values" aria-hidden="true">${bars}</span>`;
      card.addEventListener("click", () => setSelectedMetric(metricId, metric.live_available));
      stageBarGrid.appendChild(card);
    });

    metricViewGroups.humanEvidence.forEach((metricId) => {
      const metric = metricById.get(metricId);
      const card = document.createElement("button");
      card.type = "button";
      card.className = "metric-viz-card human-evidence-card";
      card.dataset.metric = metricId;
      card.setAttribute("aria-label", `${metric.number} ${metric.label}，B 与 C 阶段柱状比较`);
      const columns = ["B", "C"].map((stageId) => {
        const value = stageRows.find((row) => row.stage === stageId)?.[metricId] ?? null;
        return `<span class="evidence-bar-column stage-linked-mark" data-stage="${stageId}"><span class="evidence-bar-track"><span class="evidence-bar-fill" style="--bar:${value == null ? 0 : clamp(value) * 100}%;--stage-color:${stageColors[stageId]}"></span></span><strong>${formatMetricValue(metric, value, true)}</strong><small>${stageId} / ${stageNames[stageId]}</small></span>`;
      }).join("");
      card.innerHTML = `${metricLabelMarkup(metric)}<span class="evidence-bars" aria-hidden="true">${columns}</span>`;
      card.addEventListener("click", () => setSelectedMetric(metricId, metric.live_available));
      humanGrid.appendChild(card);
    });

    const contributionMetric = metricById.get("partner_incremental_contribution");
    const contributionCard = document.createElement("button");
    contributionCard.type = "button";
    contributionCard.className = "metric-viz-card special-metric-card";
    contributionCard.dataset.metric = contributionMetric.id;
    contributionCard.setAttribute("aria-label", "搭档增量贡献，正负发散图");
    const contributionRows = ["B", "C", "D"].map((stageId) => {
      const value = stageRows.find((row) => row.stage === stageId)?.partner_incremental_contribution ?? null;
      const side = value != null && value >= 0 ? "is-positive" : "is-negative";
      const barWidth = value == null ? 0 : Math.min(50, Math.abs(value) / 0.1 * 50);
      return `<span class="contribution-row stage-linked-mark" data-stage="${stageId}"><span>${stageId}</span><span class="contribution-track"><span class="contribution-fill ${side}" style="--bar:${barWidth}%;--stage-color:${stageColors[stageId]}"></span></span><em>${formatMetricValue(contributionMetric, value, true)}</em></span>`;
    }).join("");
    contributionCard.innerHTML = `${metricLabelMarkup(contributionMetric)}<span class="contribution-chart" aria-hidden="true">${contributionRows}</span>`;
    contributionCard.addEventListener("click", () => setSelectedMetric(contributionMetric.id, false));
    specialGrid.appendChild(contributionCard);

    const transferMetric = metricById.get("stage_transfer");
    const transferValue = stageRows.find((row) => row.stage === "D")?.stage_transfer ?? null;
    const transferCard = document.createElement("button");
    transferCard.type = "button";
    transferCard.className = "metric-viz-card special-metric-card";
    transferCard.dataset.metric = transferMetric.id;
    transferCard.setAttribute("aria-label", "阶段迁移保留，D 阶段单值参照");
    transferCard.innerHTML = `${metricLabelMarkup(transferMetric)}<span class="transfer-readout stage-linked-mark" data-stage="D"><strong>${formatMetricValue(transferMetric, transferValue, false)} <small>/ 100</small></strong><span class="transfer-track"><span style="--bar:${clamp(transferValue ?? 0) * 100}%"></span></span><span class="special-note">D 阶段与 B/C 主练阶段实测中位形的相似度；只表示保留/相似，不证明学习迁移。</span></span>`;
    transferCard.addEventListener("click", () => setSelectedMetric(transferMetric.id, false));
    specialGrid.appendChild(transferCard);

    const blockedMetric = metricById.get("repeat_after_error");
    const blockedCard = document.createElement("button");
    blockedCard.type = "button";
    blockedCard.className = "metric-viz-card special-metric-card";
    blockedCard.dataset.metric = blockedMetric.id;
    blockedCard.setAttribute("aria-label", "失误后重复机会，因缺少事件真值而阻断");
    blockedCard.innerHTML = `${metricLabelMarkup(blockedMetric)}<span class="blocked-readout"><strong>BLOCKED / 不生成数值图</strong><span class="blocked-note">缺少失误类型、击球者、球路相似度和下一次机会标签。空白不是零，也不是没有重复机会。</span></span>`;
    blockedCard.addEventListener("click", () => setSelectedMetric(blockedMetric.id, false));
    specialGrid.appendChild(blockedCard);
  }

  function updateMetricStory(time, metrics) {
    const x = lerp(38, 410, clamp(time / duration));
    metricViewGroups.dynamics.forEach((metricId) => {
      const metric = metricById.get(metricId);
      const value = metrics[metricId];
      const readout = $(`#story-live-${metricId}`);
      if (readout) readout.textContent = formatMetricValue(metric, value, true);
      const line = $(`.dynamic-playhead[data-metric="${metricId}"]`);
      const dot = $(`.dynamic-playhead-dot[data-metric="${metricId}"]`);
      if (!line || !dot) return;
      const min = Number(line.dataset.domainMin);
      const max = Number(line.dataset.domainMax);
      const normalized = value == null ? 0 : clamp((value - min) / (max - min));
      const y = lerp(98, 12, normalized);
      line.setAttribute("x1", x.toFixed(2));
      line.setAttribute("x2", x.toFixed(2));
      dot.setAttribute("cx", x.toFixed(2));
      dot.setAttribute("cy", y.toFixed(2));
      dot.style.display = value == null ? "none" : "block";
    });
  }

  function resizeCanvas() {
    const rect = canvasWrap.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    canvas.dataset.cssWidth = String(rect.width);
    canvas.dataset.cssHeight = String(rect.height);
    canvas.dataset.dpr = String(dpr);
    canvasDirty = true;
  }

  function drawBand(samples, centerY, direction, metricId, startColor, endColor) {
    const width = Number(canvas.dataset.cssWidth || 1);
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, startColor);
    gradient.addColorStop(1, endColor);
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    samples.forEach((sample) => {
      const value = sample.metrics[metricId] ?? 0;
      ctx.lineTo(sample.x, centerY + direction * (18 + value * 54));
    });
    ctx.lineTo(width, centerY);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
  }

  function drawCanvas(time) {
    const width = Number(canvas.dataset.cssWidth || 1);
    const height = Number(canvas.dataset.cssHeight || 1);
    const dpr = Number(canvas.dataset.dpr || 1);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const centerY = height * 0.5;
    const count = Math.max(180, Math.round(width / 2.4));
    const samples = Array.from({ length: count + 1 }, (_, index) => {
      const x = (index / count) * width;
      return { x, metrics: metricsAt((index / count) * duration) };
    });

    ctx.strokeStyle = "rgba(18,23,34,.16)";
    ctx.setLineDash([2, 6]);
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();
    ctx.setLineDash([]);
    drawBand(samples, centerY - 3, -1, "effective_opportunity", "rgba(240,74,24,.18)", "rgba(240,74,24,.86)");
    drawBand(samples, centerY + 3, 1, "mutual_workable_zone", "rgba(112,198,184,.86)", "rgba(112,198,184,.22)");

    ctx.beginPath();
    samples.forEach((sample, index) => {
      const value = sample.metrics[selectedMetricId];
      const y = centerY + ((value == null ? 0.5 : 0.5 - value) * 38);
      if (index === 0) ctx.moveTo(sample.x, y);
      else ctx.lineTo(sample.x, y);
    });
    ctx.strokeStyle = "rgba(18,23,34,.78)";
    ctx.lineWidth = 1.25;
    ctx.stroke();

    const sliceEvery = Math.max(6, Math.round(width / 150));
    for (let x = 0; x < width; x += sliceEvery) {
      const metrics = metricsAt((x / width) * duration);
      const top = centerY - 21 - (metrics.effective_opportunity ?? 0) * 54;
      const bottom = centerY + 21 + (metrics.mutual_workable_zone ?? 0) * 54;
      ctx.strokeStyle = "rgba(247,245,240,.34)";
      ctx.beginPath();
      ctx.moveTo(x + 0.5, top);
      ctx.lineTo(x + 0.5, bottom);
      ctx.stroke();
    }

    let previousState = null;
    liveRows.forEach((row) => {
      if (row.state !== previousState) {
        const x = (row.t / duration) * width;
        ctx.beginPath();
        ctx.arc(x, height - 15, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = row.state === "mutual_flow" ? "#55aa9d" : row.state.includes("lead") ? "#f04a18" : "#121722";
        ctx.fill();
        previousState = row.state;
      }
    });

    const playheadX = (time / duration) * width;
    const glow = ctx.createLinearGradient(playheadX - 46, 0, playheadX + 46, 0);
    glow.addColorStop(0, "rgba(240,74,24,0)");
    glow.addColorStop(0.5, "rgba(240,74,24,.14)");
    glow.addColorStop(1, "rgba(240,74,24,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(playheadX - 46, 0, 92, height);
    ctx.strokeStyle = "#f04a18";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, height);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(playheadX, centerY, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#f04a18";
    ctx.fill();
  }

  function cellBarValue(metric, value) {
    if (value == null) return 0;
    if (metric.id === "partner_incremental_contribution") return Math.min(100, Math.abs(value) * 100);
    return clamp(value) * 100;
  }

  function syncShapeCardSelection() {
    $$(".shape-metric-card").forEach((card) => {
      const active = card.dataset.metric
        ? card.dataset.metric === selectedShapeMetricId
        : card.dataset.target === "union" && targetUnionSelected;
      card.classList.toggle("is-active", active);
      card.setAttribute("aria-pressed", String(active));
    });
  }

  function buildShapeMetricCards() {
    const container = $("#shapeMetricCards");
    container.innerHTML = "";
    [...liveMetrics].sort((a, b) => a.number - b.number).forEach((metric) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "shape-metric-card";
      card.dataset.metric = metric.id;
      card.setAttribute("aria-pressed", "false");
      card.setAttribute("aria-label", `${metric.number} ${metric.label}：${shapeMetricCopy[metric.id]}`);
      card.innerHTML = `<span>${String(metric.number).padStart(2, "0")}</span><span><strong>${metric.label}</strong><small>${shapeMetricCopy[metric.id]}</small></span><em id="shape-live-${metric.id}">—</em>`;
      card.addEventListener("click", () => {
        const nextId = selectedShapeMetricId === metric.id ? null : metric.id;
        selectedShapeMetricId = nextId;
        targetUnionSelected = false;
        if (nextId) setSelectedMetric(nextId, true);
        syncShapeCardSelection();
        updateRelationship(metricsAt(displayTime));
      });
      container.appendChild(card);
    });

    const targetCard = document.createElement("button");
    targetCard.type = "button";
    targetCard.className = "shape-metric-card is-target-card";
    targetCard.dataset.target = "union";
    targetCard.setAttribute("aria-pressed", "false");
    targetCard.setAttribute("aria-label", "两人目标图形并集：视觉参照，不是达标阈值");
    targetCard.innerHTML = `<span>A∪B</span><span><strong>目标图形并集</strong><small>两个人目标轮廓的几何并集；不是达标阈值</small></span><em>REF</em>`;
    targetCard.addEventListener("click", () => {
      targetUnionSelected = !targetUnionSelected;
      selectedShapeMetricId = null;
      syncShapeCardSelection();
      updateRelationship(metricsAt(displayTime));
    });
    container.appendChild(targetCard);
  }

  function updateShapeMetricCards(metrics) {
    liveMetrics.forEach((metric) => {
      const value = $(`#shape-live-${metric.id}`);
      if (!value) return;
      const rawValue = metrics[metric.id];
      value.textContent = formatMetricValue(metric, rawValue, true);
      value.classList.toggle("is-missing", rawValue == null);
    });
  }

  function buildMetricMatrix() {
    const matrix = $("#metricMatrix");
    matrix.innerHTML = "";
    metricCatalog.forEach((metric) => {
      const status = metricStatus(metric);
      const row = document.createElement("button");
      row.type = "button";
      row.className = "metric-row";
      row.dataset.metric = metric.id;
      row.setAttribute("aria-label", `${metric.number} ${metric.label}`);
      const label = document.createElement("span");
      label.className = "metric-label";
      label.innerHTML = `<b>${String(metric.number).padStart(2, "0")}</b><span><strong>${metric.label}</strong><small>${metric.evidence_status}</small></span><em class="metric-status ${status.className}">${status.label}</em>`;
      row.appendChild(label);

      const current = document.createElement("span");
      current.className = "metric-cell is-current";
      current.id = `current-${metric.id}`;
      current.dataset.label = "当前视频点";
      current.textContent = metric.id === "repeat_after_error" ? "阻断" : metric.live_available ? "—" : "阶段";
      row.appendChild(current);

      ["A", "B", "C", "D"].forEach((stageId) => {
        const stageRow = stageRows.find((item) => item.stage === stageId);
        const value = stageRow?.[metric.id] ?? null;
        const cell = document.createElement("span");
        cell.className = `metric-cell stage-${stageId}${value == null ? " is-missing" : ""}`;
        cell.dataset.stage = stageId;
        cell.dataset.label = `${stageId} ${stageLongNames[stageId]}`;
        cell.textContent = formatMetricValue(metric, value, false);
        cell.style.setProperty("--cell-bar", `${cellBarValue(metric, value)}%`);
        cell.style.setProperty("--cell-color", stageColors[stageId]);
        row.appendChild(cell);
      });
      row.addEventListener("click", () => setSelectedMetric(metric.id, metric.live_available));
      matrix.appendChild(row);
    });
  }

  function renderStageFocus(metric) {
    const status = metricStatus(metric);
    $("#focusMetricNo").textContent = String(metric.number).padStart(2, "0");
    $("#focusMetricStatus").textContent = status.label;
    $("#focusMetricName").textContent = metric.label;
    $("#focusMetricQuestion").textContent = metric.question || metric.meaning;
    $("#focusMetricDefinition").textContent = metric.meaning;
    $("#focusMetricReading").textContent = metric.reading || "数值用于比较当前片段与不同阶段的相对变化。";
    $("#focusMetricBoundary").textContent = metric.boundary || "它是运动数据代理，不直接等同于关系质量或因果结论。";
    const values = $("#focusStageValues");
    values.innerHTML = "";
    ["A", "B", "C", "D"].forEach((stageId) => {
      const stageRow = stageRows.find((item) => item.stage === stageId);
      const value = stageRow?.[metric.id] ?? null;
      const cell = document.createElement("div");
      cell.className = "focus-stage-value";
      cell.dataset.stage = stageId;
      cell.style.setProperty("--bar", `${cellBarValue(metric, value)}%`);
      cell.style.setProperty("--accent-color", stageColors[stageId]);
      cell.innerHTML = `<span>${stageId} · ${stageLongNames[stageId]}</span><strong>${formatMetricValue(metric, value, false)}</strong>`;
      values.appendChild(cell);
    });
  }

  function updateMatrixCurrent(metrics) {
    if (!metricCatalog.length) return;
    metricCatalog.forEach((metric) => {
      const cell = $(`#current-${metric.id}`);
      if (!cell) return;
      if (metric.id === "repeat_after_error") {
        cell.textContent = "阻断";
        cell.style.setProperty("--cell-bar", "0%");
      } else if (!metric.live_available) {
        cell.textContent = "阶段";
        cell.style.setProperty("--cell-bar", "0%");
      } else {
        const value = metrics[metric.id];
        cell.textContent = formatMetricValue(metric, value, true);
        cell.style.setProperty("--cell-bar", `${cellBarValue(metric, value)}%`);
      }
    });
  }

  function setSelectedMetric(id, liveAxisRequested = false) {
    const metric = metricById.get(id);
    if (!metric) return;
    if (liveAxisRequested && metric.live_available) selectedMetricId = id;
    $$(".metric-row").forEach((row) => row.classList.toggle("is-selected", row.dataset.metric === id));
    $$(".metric-viz-card").forEach((card) => card.classList.toggle("is-selected", card.dataset.metric === id));
    renderStageFocus(metric);
    $$(".focus-stage-value").forEach((cell) => cell.classList.toggle("is-stage-highlight", cell.dataset.stage === activeStageId));
    canvasDirty = true;
  }

  function selectStage(stageId, showNotice = false) {
    activeStageId = stageId;
    $$(".stage-tab").forEach((tab) => {
      const tabStageId = ["A", "B", "C", "D"][Number(tab.dataset.stage) - 1];
      tab.classList.toggle("is-active", tabStageId === stageId);
    });
    $$(".metric-cell[data-stage]").forEach((cell) => cell.classList.toggle("is-stage-highlight", cell.dataset.stage === stageId));
    $$(".focus-stage-value").forEach((cell) => cell.classList.toggle("is-stage-highlight", cell.dataset.stage === stageId));
    $$(".stage-profile-card").forEach((card) => {
      const active = card.dataset.stage === stageId;
      card.classList.toggle("is-active", active);
      card.setAttribute("aria-pressed", String(active));
    });
    $$(".stage-linked-mark").forEach((mark) => mark.classList.toggle("is-stage-muted", mark.dataset.stage !== stageId));

    if (!showNotice) return;
    clearTimeout(stageNoticeTimer);
    const notice = $("#stageNotice");
    notice.querySelector("span").textContent = stageId === "A"
      ? "已定位到 A 自然阶段；实时视频也来自该阶段。"
      : `已联动高亮 ${stageId} ${stageNames[stageId]}阶段的冻结结果；上方实时视频仍保持 A 阶段前 45 秒。`;
    notice.hidden = false;
    stageNoticeTimer = setTimeout(() => { notice.hidden = true; }, 3200);
  }

  function syncSecondary(force = false) {
    if (!Number.isFinite(videoA.currentTime) || !Number.isFinite(videoB.duration)) return;
    const drift = Math.abs(videoA.currentTime - videoB.currentTime);
    if (force || drift > 0.14) videoB.currentTime = Math.min(videoA.currentTime, videoB.duration || duration);
  }

  async function togglePlayback() {
    if (videoA.paused) {
      if (videoA.currentTime >= duration - 0.05) {
        videoA.currentTime = 0;
        videoB.currentTime = 0;
      }
      syncSecondary(true);
      const results = await Promise.allSettled([videoA.play(), videoB.play()]);
      if (results[0].status === "rejected") return;
      playButton.classList.add("is-playing");
      playLabel.textContent = "暂停";
      playButton.setAttribute("aria-label", "暂停视频");
    } else {
      videoA.pause();
      videoB.pause();
      playButton.classList.remove("is-playing");
      playLabel.textContent = "播放";
      playButton.setAttribute("aria-label", "播放视频");
    }
  }

  function seekTo(time) {
    targetTime = clamp(time, 0, duration);
    videoA.currentTime = targetTime;
    videoB.currentTime = Math.min(targetTime, Number.isFinite(videoB.duration) ? videoB.duration : duration);
    canvasDirty = true;
  }

  function exportData() {
    const payload = {
      exportedAt: new Date().toISOString(),
      source: {
        live: "optimized_relations_v3/realtime_relation_slices.csv · G01-S1-P01-P02-A · 0-45s",
        stages: "relation_metrics_v3/stage_metrics_v3.csv · G01-S1-P01-P02",
        catalog: "rallylens.dyadic-relationship-metrics.v3.catalog",
        auditBoundary: "关系指标为运动代理/阶段报告；第7项阻断；不声称逐拍或因果真值"
      },
      metricCatalog,
      liveRows,
      stageRows
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = "rallylens_g01_s1_16_relation_metrics.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1200);
  }

  function renderLoop(now) {
    const deltaSeconds = Math.min(0.05, (now - previousFrameTime) / 1000);
    previousFrameTime = now;
    if (!videoA.paused && Number.isFinite(videoA.currentTime)) {
      targetTime = Math.min(videoA.currentTime, duration);
      syncSecondary(false);
    }
    const smoothing = 1 - Math.exp(-deltaSeconds * 11);
    displayTime = lerp(displayTime, targetTime, smoothing);
    if (Math.abs(displayTime - targetTime) < 0.002) displayTime = targetTime;
    if (canvasDirty || Math.abs(displayTime - lastRenderedTime) > 0.002) {
      const metrics = metricsAt(displayTime);
      updateRelationship(metrics);
      updateReadout(displayTime, metrics);
      drawCanvas(displayTime);
      lastRenderedTime = displayTime;
      canvasDirty = false;
    }
    requestAnimationFrame(renderLoop);
  }

  function bindInteractions() {
    playButton.addEventListener("click", togglePlayback);
    videoA.addEventListener("click", togglePlayback);
    videoB.addEventListener("click", togglePlayback);
    videoA.addEventListener("pause", () => {
      playButton.classList.remove("is-playing");
      playLabel.textContent = "播放";
    });
    videoA.addEventListener("ended", () => {
      videoB.pause();
      playButton.classList.remove("is-playing");
      playLabel.textContent = "重播";
      playButton.setAttribute("aria-label", "重播视频");
    });
    seekBar.addEventListener("input", (event) => seekTo(Number(event.target.value)));
    muteButton.addEventListener("click", () => {
      videoA.muted = !videoA.muted;
      videoB.muted = true;
      muteButton.setAttribute("aria-pressed", String(videoA.muted));
      muteButton.textContent = videoA.muted ? "静音" : "声音开启";
    });
    canvasWrap.addEventListener("pointermove", (event) => {
      const rect = canvasWrap.getBoundingClientRect();
      const x = clamp(event.clientX - rect.left, 0, rect.width);
      const time = (x / rect.width) * duration;
      const metrics = metricsAt(time);
      const metric = metricById.get(selectedMetricId);
      tooltip.hidden = false;
      tooltip.style.left = `${clamp(x, 68, rect.width - 68)}px`;
      tooltip.textContent = `${formatTime(time)} · ${metric.label} ${formatMetricValue(metric, metrics[selectedMetricId], true)} · ${stateLabels[metrics.state]}`;
    });
    canvasWrap.addEventListener("pointerleave", () => { tooltip.hidden = true; });
    canvasWrap.addEventListener("click", (event) => {
      const rect = canvasWrap.getBoundingClientRect();
      seekTo(((event.clientX - rect.left) / rect.width) * duration);
    });
    $("#methodButton").addEventListener("click", () => $("#methodDialog").showModal());
    $("#exportButton").addEventListener("click", exportData);
    $$(".stage-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        const stageNumber = Number(tab.dataset.stage);
        const stageId = ["A", "B", "C", "D"][stageNumber - 1];
        selectStage(stageId, true);
      });
    });
  }

  async function initialize() {
    try {
      await loadFrozenData();
      buildShapeMetricCards();
      buildMetricMatrix();
      buildStageAtlas();
      buildMetricStoryViews();
      setSelectedMetric(selectedMetricId, true);
      selectStage("A", false);
      bindInteractions();
      const resizeObserver = new ResizeObserver(resizeCanvas);
      resizeObserver.observe(canvasWrap);
      resizeCanvas();
      const initialMetrics = metricsAt(0);
      updateRelationship(initialMetrics);
      updateReadout(0, initialMetrics);
      requestAnimationFrame(renderLoop);
    } catch (error) {
      console.error(error);
      $("#relationState").textContent = "数据载入失败";
      $("#relationSentence").textContent = "请通过 start.ps1 启动本地服务后刷新页面。";
    }
  }

  initialize();
})();

