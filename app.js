(function () {
  "use strict";

  const model = window.AirDataModel;
  const CONFIG = Object.freeze({
    airportElevationFt: 2000,
    scenarioQnhHpa: 1005,
    sceneMaxAltitudeFt: 36000,
    sceneBottomY: 600,
    sceneTopY: 55
  });

  const state = {
    mode: "guided",
    altitudeFt: 2000,
    tasKnots: 180,
    positionErrorKnots: 0,
    verticalSpeedFpm: 0,
    settingMode: "qnh",
    settingPressureHpa: CONFIG.scenarioQnhHpa,
    staticBlocked: false,
    blockedPressurePa: null,
    challengeChoice: null,
    challengeAnswered: false,
    flightRunning: false,
    flightTimer: null
  };

  const $ = (id) => document.getElementById(id);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  const els = {
    altitudeRange: $("altitude-range"), altitudeNumber: $("altitude-number"), altitudeOutput: $("altitude-output"),
    tasRange: $("tas-range"), tasNumber: $("tas-number"), tasOutput: $("tas-output"),
    settingPreset: $("setting-preset"), settingPressure: $("setting-pressure"), settingHelp: $("setting-help"),
    positionErrorRange: $("position-error-range"), positionErrorOutput: $("position-error-output"), verticalSpeedRange: $("vertical-speed-range"), verticalSpeedOutput: $("vertical-speed-output"),
    flightToggle: $("flight-toggle"), flightToggleLabel: $("flight-toggle-label"), flightStatus: $("flight-status"), flightReadout: $("flight-readout"),
    staticBlockage: $("static-blockage"), resetLab: $("reset-lab"),
    sceneTicks: $("scene-ticks"), aircraft: $("aircraft"), aircraftLine: $("scene-aircraft-line"), aircraftLabel: $("scene-altitude-label"),
    sceneHeightLabel: $("scene-height-label"), sceneReferenceLine: $("scene-reference-line"), sceneReferenceLabel: $("scene-reference-label"),
    scenePressureLabel: $("scene-pressure-label"), sceneSettingNote: $("scene-setting-note"), sceneStatus: $("scene-status"),
    altimeterTicks: $("altimeter-ticks"), altimeterLongNeedle: $("altimeter-long-needle"), altimeterShortNeedle: $("altimeter-short-needle"),
    altimeterGaugeValue: $("altimeter-gauge-value"), altimeterTag: $("altimeter-tag"), altimeterReading: $("altimeter-reading"), altimeterSettingReadout: $("altimeter-setting-readout"), altimeterNote: $("altimeter-note"),
    airspeedTicks: $("airspeed-ticks"), airspeedNeedle: $("airspeed-needle"), airspeedGaugeValue: $("airspeed-gauge-value"), airspeedReading: $("airspeed-reading"), airspeedTasReading: $("airspeed-tas-reading"), machReading: $("mach-reading"), airspeedNote: $("airspeed-note"),
    vsiTicks: $("vsi-ticks"), vsiNeedle: $("vsi-needle"), vsiGaugeValue: $("vsi-gauge-value"), vsiReading: $("vsi-reading"), vsiGauge: $("vsi-gauge"),
    psReadout: $("ps-readout"), qReadout: $("q-readout"), casReadout: $("cas-readout"), easReadout: $("eas-readout"), tasReadout: $("tas-readout"),
    liveExplanation: $("live-explanation"),
    guidedCheck: $("guided-check"), guidedFeedback: $("guided-feedback"),
    challengeCheck: $("challenge-check"), challengeFeedback: $("challenge-feedback"), challengeReset: $("challenge-reset"), challengeStatus: $("challenge-status")
  };

  function formatNumber(value, decimals) {
    return new Intl.NumberFormat("it-IT", { maximumFractionDigits: decimals, minimumFractionDigits: decimals }).format(value);
  }

  function formatFeet(value) {
    return `${formatNumber(Math.round(value), 0)} ft`;
  }

  function formatKnots(value) {
    return `${formatNumber(Math.round(value), 0)} kt`;
  }

  function setText(element, value) {
    if (element) element.textContent = value;
  }

  function sceneY(altitudeFt) {
    const ratio = model.clamp(altitudeFt / CONFIG.sceneMaxAltitudeFt, 0, 1);
    return CONFIG.sceneBottomY - ratio * (CONFIG.sceneBottomY - CONFIG.sceneTopY);
  }

  function polarPoint(cx, cy, radius, angleDegrees) {
    const angle = (angleDegrees - 90) * Math.PI / 180;
    return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
  }

  function createGaugeTicks(container, maxValue, step, majorEvery, startAngle, endAngle, labelStep) {
    if (!container || container.childElementCount) return;
    const fragment = document.createDocumentFragment();
    for (let value = 0; value <= maxValue; value += step) {
      const ratio = value / maxValue;
      const angle = startAngle + (endAngle - startAngle) * ratio;
      const outer = polarPoint(120, 120, 91, angle);
      const inner = polarPoint(120, 120, value % majorEvery === 0 ? 78 : 83, angle);
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", inner.x); line.setAttribute("y1", inner.y); line.setAttribute("x2", outer.x); line.setAttribute("y2", outer.y);
      line.setAttribute("class", value % majorEvery === 0 ? "gauge-tick gauge-tick-major" : "gauge-tick");
      fragment.appendChild(line);
      if (value % labelStep === 0) {
        const labelPoint = polarPoint(120, 120, 66, angle);
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", labelPoint.x); text.setAttribute("y", labelPoint.y + 3); text.setAttribute("text-anchor", "middle"); text.setAttribute("class", "gauge-label"); text.textContent = value;
        fragment.appendChild(text);
      }
    }
    container.appendChild(fragment);
  }

  function createSceneTicks() {
    if (els.sceneTicks.childElementCount) return;
    const fragment = document.createDocumentFragment();
    for (let altitude = 0; altitude <= CONFIG.sceneMaxAltitudeFt; altitude += 2000) {
      const y = sceneY(altitude);
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", 18); line.setAttribute("x2", 69); line.setAttribute("y1", y); line.setAttribute("y2", y); line.setAttribute("class", "scene-tick-line");
      const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
      label.setAttribute("x", 75); label.setAttribute("y", y + 3); label.setAttribute("class", "scene-tick-label"); label.textContent = `${altitude / 1000}k`;
      fragment.appendChild(line); fragment.appendChild(label);
    }
    els.sceneTicks.appendChild(fragment);
  }

  function createVsiTicks() {
    if (!els.vsiTicks || els.vsiTicks.childElementCount) return;
    const fragment = document.createDocumentFragment();
    [-3000, -1500, 0, 1500, 3000].forEach((value) => {
      const ratio = (value + 3000) / 6000;
      const angle = -135 + ratio * 270;
      const outer = polarPoint(120, 120, 91, angle);
      const inner = polarPoint(120, 120, value === 0 ? 77 : 82, angle);
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", inner.x); line.setAttribute("y1", inner.y); line.setAttribute("x2", outer.x); line.setAttribute("y2", outer.y); line.setAttribute("class", value === 0 ? "gauge-tick gauge-tick-major" : "gauge-tick");
      fragment.appendChild(line);
      const labelPoint = polarPoint(120, 120, 65, angle);
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", labelPoint.x); text.setAttribute("y", labelPoint.y + 3); text.setAttribute("text-anchor", "middle"); text.setAttribute("class", "gauge-label"); text.textContent = value === 0 ? "0" : `${value / 1000}k`;
      fragment.appendChild(text);
    });
    els.vsiTicks.appendChild(fragment);
  }

  function getPresetPressure(mode) {
    const qnhPa = model.hpaToPa(CONFIG.scenarioQnhHpa);
    const airportQfePa = model.pressureAtAltitudeFt(CONFIG.airportElevationFt, qnhPa);
    if (mode === "qfe") return airportQfePa;
    if (mode === "std") return model.CONSTANTS.p0Pa;
    return qnhPa;
  }

  function applyPreset(mode) {
    state.settingMode = mode;
    if (mode !== "custom") state.settingPressureHpa = model.paToHpa(getPresetPressure(mode));
    els.settingPressure.value = state.settingPressureHpa.toFixed(2);
    els.settingPreset.value = mode;
    updateSettingHelp();
  }

  function updateSettingHelp() {
    const messages = {
      qfe: "QFE: altezza rispetto alla stazione/pista; sulla pista l’altimetro legge 0 ft.",
      qnh: "QNH: altitudine riferita al livello medio del mare (MSL).",
      std: "STD: riferimento standard 1013,25 hPa; la lettura è usata come quota-pressione / flight level.",
      custom: "Manuale: il valore inserito diventa il datum dello strumento."
    };
    setText(els.settingHelp, messages[state.settingMode]);
  }

  function computeData() {
    const scenarioQnhPa = model.hpaToPa(CONFIG.scenarioQnhHpa);
    const actualStaticPressurePa = model.pressureAtAltitudeFt(state.altitudeFt, scenarioQnhPa);
    const actualTemperatureK = model.isaTemperatureAtAltitudeFt(state.altitudeFt);
    const settingPressurePa = model.hpaToPa(state.settingPressureHpa);
    const sensorStaticPressurePa = state.staticBlocked && state.blockedPressurePa !== null
      ? state.blockedPressurePa
      : actualStaticPressurePa;
    const airspeed = model.calculateAirspeed({
      tasKnots: state.tasKnots,
      staticPressurePa: actualStaticPressurePa,
      temperatureK: actualTemperatureK,
      positionErrorKnots: state.positionErrorKnots,
      sensorStaticPressurePa
    });
    return {
      actualStaticPressurePa,
      actualTemperatureK,
      settingPressurePa,
      sensorStaticPressurePa,
      airspeed,
      indicatedAltitudeFt: model.indicatedAltitudeFt(sensorStaticPressurePa, settingPressurePa),
      pressureAltitudeFt: model.pressureAltitudeFt(actualStaticPressurePa),
      heightAboveRunwayFt: state.altitudeFt - CONFIG.airportElevationFt,
      referenceAltitudeFt: state.settingMode === "qfe"
        ? CONFIG.airportElevationFt
        : model.pressureAltitudeFt(settingPressurePa)
    };
  }

  function renderScene(data) {
    const aircraftY = sceneY(state.altitudeFt);
    const referenceY = sceneY(data.referenceAltitudeFt);
    els.aircraft.setAttribute("transform", `translate(270 ${aircraftY})`);
    els.aircraftLine.setAttribute("y1", aircraftY); els.aircraftLine.setAttribute("y2", aircraftY);
    els.aircraftLabel.setAttribute("y", aircraftY - 5); els.aircraftLabel.textContent = formatFeet(state.altitudeFt);
    els.sceneHeightLabel.setAttribute("y", aircraftY + 10); els.sceneHeightLabel.textContent = `height ${data.heightAboveRunwayFt >= 0 ? "+" : ""}${formatNumber(Math.round(data.heightAboveRunwayFt), 0)} ft`;
    els.sceneReferenceLine.setAttribute("y1", referenceY); els.sceneReferenceLine.setAttribute("y2", referenceY);
    els.sceneReferenceLabel.setAttribute("y", referenceY - 7);
    setText(els.scenePressureLabel, `Ps ${formatNumber(model.paToHpa(data.sensorStaticPressurePa), 1)} hPa`);
    setText(els.sceneSettingNote, `${state.settingMode.toUpperCase()} · ${formatNumber(state.settingPressureHpa, 2)} hPa`);
    els.sceneStatus.textContent = state.staticBlocked ? "STATIC BLOCCATA" : state.flightRunning ? "SIMULAZIONE" : "LIVE";
    els.sceneStatus.classList.toggle("is-warning", state.staticBlocked);
    els.sceneStatus.classList.toggle("is-sim", !state.staticBlocked && state.flightRunning);
  }

  function setSvgNeedleAngle(element, angle) {
    if (!element) return;
    // Keep the rotation in the SVG transform attribute. A CSS transform on an
    // SVG line can override the attribute (and use a different origin) in
    // some browsers, making the needle appear frozen or jump incorrectly.
    element.style.removeProperty("transform");
    element.setAttribute("transform", `rotate(${angle} 120 120)`);
  }

  function renderAltimeter(data) {
    const indication = data.indicatedAltitudeFt;
    const longAngle = ((indication % 10000) + 10000) % 10000 / 10000 * 360;
    const shortAngle = ((indication % 100000) + 100000) % 100000 / 100000 * 360;
    setSvgNeedleAngle(els.altimeterLongNeedle, longAngle);
    setSvgNeedleAngle(els.altimeterShortNeedle, shortAngle);
    setText(els.altimeterGaugeValue, formatNumber(Math.round(indication), 0));
    setText(els.altimeterReading, formatFeet(indication));
    setText(els.altimeterSettingReadout, `${formatNumber(state.settingPressureHpa, 2)} hPa`);
    setText(els.altimeterTag, state.settingMode.toUpperCase());
    const labels = { qfe: "altezza rispetto alla pista", qnh: "altitudine rispetto al MSL", std: "quota-pressione / flight level", custom: "quota rispetto al datum manuale" };
    setText(els.altimeterNote, `${labels[state.settingMode]}${state.staticBlocked ? ". Presa statica bloccata: la lettura resta congelata." : "."}`);
    els.altimeterGauge.setAttribute("aria-label", `Altimetro: ${formatFeet(indication)}, setting ${state.settingMode.toUpperCase()} ${formatNumber(state.settingPressureHpa, 2)} hPa`);
  }

  function renderAirspeed(data) {
    const airspeed = data.airspeed;
    const speedAngle = -135 + model.clamp(airspeed.iasKnots / 400, 0, 1) * 270;
    setSvgNeedleAngle(els.airspeedNeedle, speedAngle);
    setText(els.airspeedGaugeValue, formatNumber(Math.max(0, airspeed.iasKnots), 0));
    setText(els.airspeedReading, formatKnots(airspeed.iasKnots));
    setText(els.airspeedTasReading, formatKnots(airspeed.tasKnots));
    setText(els.machReading, formatNumber(airspeed.mach, 2));
    setText(els.psReadout, `${formatNumber(model.paToHpa(data.sensorStaticPressurePa), 1)} hPa`);
    setText(els.qReadout, `${formatNumber(airspeed.measuredDynamicPressurePa, 0)} Pa`);
    setText(els.casReadout, formatKnots(airspeed.casKnots));
    setText(els.easReadout, formatKnots(airspeed.easKnots));
    setText(els.tasReadout, formatKnots(airspeed.tasKnots));
    setText(els.airspeedNote, state.staticBlocked
      ? "Presa statica bloccata: il differenziale misurato usa il valore statico congelato."
      : "Il differenziale Pₜ − Pₛ alimenta la lettura; CAS − IAS mostra l’errore di posizione.");
    els.airspeedGauge.setAttribute("aria-label", `Anemometro: IAS ${formatKnots(airspeed.iasKnots)}, CAS ${formatKnots(airspeed.casKnots)}`);
  }

  function renderVsi() {
    const verticalSpeed = state.verticalSpeedFpm;
    const vsiAngle = -135 + model.clamp((verticalSpeed + 3000) / 6000, 0, 1) * 270;
    setSvgNeedleAngle(els.vsiNeedle, vsiAngle);
    setText(els.vsiGaugeValue, `${verticalSpeed > 0 ? "+" : ""}${formatNumber(verticalSpeed / 1000, verticalSpeed % 1000 === 0 ? 0 : 1)}k`);
    setText(els.vsiReading, `${verticalSpeed > 0 ? "+" : ""}${formatNumber(verticalSpeed, 0)} fpm`);
    setText(els.flightReadout, state.flightRunning ? "RUN" : "PAUSA");
    els.vsiGauge.setAttribute("aria-label", `Variometro: ${verticalSpeed} piedi al minuto, ${state.flightRunning ? "simulazione attiva" : "in pausa"}`);
  }

  function renderExplanation(data) {
    const settingLabel = state.settingMode === "qfe" ? "QFE" : state.settingMode === "qnh" ? "QNH" : state.settingMode === "std" ? "STD" : "il setting manuale";
    const settingEffect = state.settingMode === "qfe"
      ? "Con QFE, il datum è la pista: sulla pista l’indicazione è 0 ft e in volo leggi la height."
      : state.settingMode === "qnh"
        ? "Con QNH, il datum è il livello medio del mare: sulla pista l’indicazione è circa l’elevazione dell’aeroporto."
        : state.settingMode === "std"
          ? "Con STD, il datum è la pressione standard 1013,25 hPa: la lettura diventa quota-pressione / flight level."
          : "Con un setting manuale, l’altimetro confronta la pressione statica con il datum che hai inserito.";
    const blockage = state.staticBlocked ? " La presa statica è bloccata: l’altimetro mantiene il riferimento di pressione catturato al momento del blocco." : "";
    setText(els.liveExplanation, `${settingLabel}: ${settingEffect} Quota reale: ${formatFeet(state.altitudeFt)}; indicata: ${formatFeet(data.indicatedAltitudeFt)}.${blockage}`);
  }

  function render() {
    const data = computeData();
    renderScene(data); renderAltimeter(data); renderAirspeed(data); renderVsi(); renderExplanation(data);
    setText(els.altitudeOutput, formatFeet(state.altitudeFt)); setText(els.tasOutput, formatKnots(state.tasKnots));
    setText(els.positionErrorOutput, `${state.positionErrorKnots >= 0 ? "+" : ""}${formatNumber(state.positionErrorKnots, 1)} kt`);
    setText(els.verticalSpeedOutput, `${state.verticalSpeedFpm > 0 ? "+" : ""}${formatNumber(state.verticalSpeedFpm, 0)} fpm`);
    setText(els.flightStatus, state.flightRunning ? "RUN" : "PAUSA");
    setText(els.flightToggleLabel, state.flightRunning ? "Metti in pausa" : "Avvia simulazione");
    els.altitudeRange.value = state.altitudeFt; els.altitudeNumber.value = state.altitudeFt;
    els.tasRange.value = state.tasKnots; els.tasNumber.value = state.tasKnots;
    els.positionErrorRange.value = state.positionErrorKnots; els.verticalSpeedRange.value = state.verticalSpeedFpm;
  }

  function setNumericState(key, rawValue, minimum, maximum, integerStep) {
    let value = Number(rawValue);
    if (!Number.isFinite(value)) return;
    value = model.clamp(value, minimum, maximum);
    if (integerStep) value = Math.round(value / integerStep) * integerStep;
    state[key] = value;
    render();
  }

  function updateStaticBlockage() {
    state.staticBlocked = els.staticBlockage.checked;
    const scenarioQnhPa = model.hpaToPa(CONFIG.scenarioQnhHpa);
    state.blockedPressurePa = state.staticBlocked ? model.pressureAtAltitudeFt(state.altitudeFt, scenarioQnhPa) : null;
    render();
  }

  function stopFlight() {
    if (state.flightTimer !== null) window.clearInterval(state.flightTimer);
    state.flightTimer = null;
    state.flightRunning = false;
  }

  function toggleFlight() {
    if (state.flightRunning) {
      stopFlight();
      render();
      return;
    }
    state.flightRunning = true;
    state.flightTimer = window.setInterval(() => {
      const seconds = 0.25;
      const nextAltitude = state.altitudeFt + (state.verticalSpeedFpm / 60) * seconds;
      if (nextAltitude <= 0 || nextAltitude >= CONFIG.sceneMaxAltitudeFt) {
        state.altitudeFt = model.clamp(nextAltitude, 0, CONFIG.sceneMaxAltitudeFt);
        stopFlight();
      } else {
        state.altitudeFt = nextAltitude;
      }
      render();
    }, 250);
    render();
  }

  function onModeChange(mode) {
    state.mode = mode;
    $$(".mode-tab").forEach((tab) => {
      const active = tab.dataset.mode === mode;
      tab.classList.toggle("is-active", active); tab.setAttribute("aria-selected", String(active)); tab.tabIndex = active ? 0 : -1;
    });
    $$(".mode-panel").forEach((panel) => {
      const active = panel.id === `mode-${mode}`;
      panel.hidden = !active; panel.classList.toggle("is-active", active);
    });
  }

  function checkGuided() {
    const choice = document.querySelector("input[name='guided-answer']:checked");
    if (!choice) return;
    els.guidedFeedback.hidden = false;
    els.guidedFeedback.textContent = choice.value === "ps"
      ? "Corretto: l’altimetro legge la pressione statica Pₛ. Il Pitot misura Pₜ; la differenza Pₜ − Pₛ è la pressione dinamica usata dall’anemometro."
      : "Non ancora: l’altimetro è collegato alle prese statiche e usa Pₛ. Pₜ arriva dal Pitot, mentre q è la differenza tra totale e statica.";
    els.guidedFeedback.style.background = choice.value === "ps" ? "#eaf7f5" : "#fff8ec";
  }

  function checkChallenge() {
    const choice = document.querySelector("input[name='challenge-setting']:checked");
    if (!choice) return;
    state.challengeChoice = choice.value; state.challengeAnswered = true;
    applyPreset(choice.value);
    const airportQfeHpa = model.paToHpa(getPresetPressure("qfe"));
    const qfeReading = model.indicatedAltitudeFt(getPresetPressure("qfe"), getPresetPressure("qfe"));
    const qnhReading = model.indicatedAltitudeFt(getPresetPressure("qfe"), getPresetPressure("qnh"));
    const stdReading = model.indicatedAltitudeFt(getPresetPressure("qfe"), getPresetPressure("std"));
    const isCorrect = choice.value === "qfe";
    els.challengeFeedback.hidden = false; els.challengeFeedback.classList.toggle("is-wrong", !isCorrect);
    els.challengeFeedback.innerHTML = isCorrect
      ? `<strong>Scelta corretta: QFE.</strong> Il setting QFE usa la pressione della stazione di riferimento (qui circa ${formatNumber(airportQfeHpa, 2)} hPa), quindi sulla pista l’altimetro indica ${formatFeet(qfeReading)}. Questa è la <strong>height</strong>: distanza verticale dalla pista/stazione. La <strong>altitude</strong> è invece riferita al MSL e sulla pista vale ${formatFeet(qnhReading)}.`
      : `<strong>Rivedi il datum.</strong> ${choice.value.toUpperCase()} non porta la pista a zero in questo scenario: sulla pista indica circa ${formatFeet(choice.value === "qnh" ? qnhReading : stdReading)}. Per leggere 0 ft rispetto alla pista serve QFE, perché QFE misura la <strong>height</strong>; l’altitudine resta riferita al MSL.`;
    els.challengeStatus.textContent = isCorrect ? "VERIFICATO" : "OSSERVA";
    els.challengeStatus.style.background = isCorrect ? "#e8f7f3" : "#fff0da";
    els.challengeCheck.disabled = true; els.challengeReset.hidden = false;
    $$(`#challenge-choices input`).forEach((input) => { input.disabled = true; });
    render();
  }

  function resetChallenge() {
    state.challengeChoice = null; state.challengeAnswered = false; applyPreset("qnh");
    $$(`#challenge-choices input`).forEach((input) => { input.disabled = false; input.checked = false; });
    els.challengeFeedback.hidden = true; els.challengeFeedback.className = "challenge-feedback"; els.challengeReset.hidden = true; els.challengeCheck.disabled = true; els.challengeStatus.textContent = "PREDICI"; els.challengeStatus.style.background = "#fff0da";
  }

  function resetLab() {
    stopFlight(); state.altitudeFt = 2000; state.tasKnots = 180; state.positionErrorKnots = 0; state.verticalSpeedFpm = 0; state.staticBlocked = false; state.blockedPressurePa = null; state.settingMode = "qnh"; state.settingPressureHpa = CONFIG.scenarioQnhHpa;
    els.staticBlockage.checked = false; applyPreset("qnh"); render();
  }

  function bindEvents() {
    $$(".mode-tab").forEach((tab) => tab.addEventListener("click", () => onModeChange(tab.dataset.mode)));
    els.altitudeRange.addEventListener("input", (event) => setNumericState("altitudeFt", event.target.value, 0, 36000, 100));
    els.altitudeNumber.addEventListener("change", (event) => setNumericState("altitudeFt", event.target.value, 0, 36000, 100));
    els.tasRange.addEventListener("input", (event) => setNumericState("tasKnots", event.target.value, 40, 420, 1));
    els.tasNumber.addEventListener("change", (event) => setNumericState("tasKnots", event.target.value, 40, 420, 1));
    els.positionErrorRange.addEventListener("input", (event) => setNumericState("positionErrorKnots", event.target.value, -5, 10, .5));
    els.verticalSpeedRange.addEventListener("input", (event) => setNumericState("verticalSpeedFpm", event.target.value, -3000, 3000, 100));
    els.settingPreset.addEventListener("change", (event) => { applyPreset(event.target.value); render(); });
    els.settingPressure.addEventListener("change", (event) => { const value = Number(event.target.value); if (Number.isFinite(value)) { state.settingMode = "custom"; state.settingPressureHpa = model.clamp(value, 850, 1050); els.settingPreset.value = "custom"; updateSettingHelp(); render(); } });
    els.staticBlockage.addEventListener("change", updateStaticBlockage);
    els.flightToggle.addEventListener("click", toggleFlight);
    els.resetLab.addEventListener("click", resetLab);
    els.guidedCheck.addEventListener("click", checkGuided);
    $$('input[name="guided-answer"]').forEach((input) => input.addEventListener("change", () => { els.guidedCheck.disabled = false; }));
    $$('input[name="challenge-setting"]').forEach((input) => input.addEventListener("change", () => { state.challengeChoice = input.value; els.challengeCheck.disabled = false; }));
    els.challengeCheck.addEventListener("click", checkChallenge); els.challengeReset.addEventListener("click", resetChallenge);
  }

  createSceneTicks();
  createGaugeTicks(els.altimeterTicks, 10, 1, 1, 0, 324, 1);
  createGaugeTicks(els.airspeedTicks, 400, 40, 80, -135, 135, 80);
  createVsiTicks();
  updateSettingHelp(); bindEvents(); render();
}());

