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
    mode: "cockpit",
    altitudeFt: 2000,
    tasKnots: 110,
    positionErrorKnots: 0,
    verticalSpeedFpm: 0,
    settingMode: "qnh",
    settingPressureHpa: CONFIG.scenarioQnhHpa,
    staticBlocked: false,
    blockedPressurePa: null,
    theoryStep: "pitot",
    theoryPreviousAltitudeFt: 2000,
    exerciseIndex: 0,
    exerciseScore: 0,
    exerciseGuideStep: 1,
    exerciseAnswered: false,
    flightRunning: false,
    flightTimer: null
  };

  const theoryMotion = {
    capsuleScale: 1,
    needleAngle: 0,
    frameId: null,
    initialized: false
  };

  const THEORY_STEPS = Object.freeze({
    pitot: {
      label: "01 / 03 · PRESSIONI",
      mode: "PITOT-STATIC",
      kicker: "01 · PRESSIONI DI RIFERIMENTO",
      title: "Due prese, due informazioni.",
      copy: "Il tubo di Pitot è orientato verso il flusso e porta la pressione totale Pt. Le prese statiche, invece, sentono la pressione statica Ps del campo circostante.",
      equation: "Pt = Ps + q",
      note: "L’aria entra nel tubo di Pitot e nelle prese statiche."
    },
    speed: {
      label: "02 / 03 · VELOCITÀ",
      mode: "AIRSPEED MEASUREMENT",
      kicker: "02 · PRESSIONE DINAMICA",
      title: "La differenza diventa velocità.",
      copy: "L’anemometro confronta Pt e Ps. La differenza q è la pressione dinamica: dal suo valore si ricava prima la CAS e, dopo le correzioni, la IAS mostrata al pilota.",
      equation: "q = Pt − Ps  →  CAS ≈ √(2q / ρ₀)  →  IAS",
      note: "La pressione dinamica cresce con il quadrato della velocità."
    },
    altimeter: {
      label: "03 / 03 · ALTIMETRO",
      mode: "STATIC PRESSURE",
      kicker: "03 · CAPSULA ANEROIDE",
      title: "La pressione muove la capsula.",
      copy: "La pressione statica entra nell’altimetro e agisce sulla capsula aneroide. Salendo, Ps diminuisce: la capsula si espande e il meccanismo traduce la deformazione in quota indicata.",
      equation: "Ps ↓  →  capsula ↑  →  quota indicata ↑",
      note: "Il setting QNH, QFE o STD definisce il datum della lettura."
    }
  });

  const EXERCISES = Object.freeze([
    {
      type: "01 · DENSITÀ",
      title: "Ricava la density-altitude",
      question: "Un altimetro standard legge 7.000 m e la temperatura esterna è −10 °C. Qual è la density-altitude?",
      data: [["Quota indicata", "7.000", "m"], ["Temperatura", "−10", "°C"], ["Costante gas", "287", "J/(kg K)"]],
      theory: "La density-altitude è la quota ISA alla quale l’aria avrebbe la densità realmente calcolata. Prima si ricava ρ con la legge dei gas perfetti, poi si cerca la quota ISA equivalente.",
      guide: [
        { label: "01 · DATI", title: "Porta la temperatura in kelvin", copy: "La formula p = ρRT richiede la temperatura assoluta. La quota indicata permette di leggere la pressione ISA corrispondente.", formula: "T = −10 + 273,15 = 263,2 K" },
        { label: "02 · PRESSIONE", title: "Usa il riferimento ISA", copy: "Dal materiale, a 7.000 m in atmosfera standard la pressione è circa 41.060 Pa.", formula: "p(7.000 m) ≈ 41.060 Pa" },
        { label: "03 · DENSITÀ", title: "Applica i gas perfetti", copy: "Dividi la pressione per il prodotto tra costante del gas e temperatura assoluta.", formula: "ρ = p / (RT) = 41.060 / (287 · 263,2) = 0,5436 kg/m³" },
        { label: "04 · RISULTATO", title: "Intervalla nella tabella ISA", copy: "La densità 0,5436 kg/m³ cade tra i valori ISA di 7.500 e 8.000 m. L’interpolazione lineare porta al risultato del materiale.", formula: "zDA ≈ 7.707 m" }
      ],
      kind: "number",
      unit: "m",
      expected: 7707,
      tolerance: 15,
      equation: "ρ = 0,5436 kg/m³ → interpolazione ISA → density-altitude ≈ 7.707 m",
      feedback: "La density-altitude non è la quota indicata: è la quota ISA equivalente alla densità calcolata con pressione e temperatura reali."
    },
    {
      type: "02 · ATMOSFERA",
      title: "Dalla quota indicata alla quota vera",
      question: "Un altimetro calibrato in atmosfera standard indica 8.000 m. Al livello dell’aeroporto p₀ = 105.000 Pa e T₀ = 25 °C. Con gradiente 6,5 °C/km, qual è la quota vera?",
      data: [["Pressione aeroporto", "105.000", "Pa"], ["Temperatura aeroporto", "25", "°C"], ["Quota indicata", "8.000", "m"], ["Gradiente", "0,0065", "K/m"]],
      theory: "Un altimetro standard converte la pressione in quota ISA. Se la temperatura reale non è quella standard, bisogna ricavare la temperatura in quota dal rapporto di pressioni e poi usare il gradiente termico reale.",
      guide: [
        { label: "01 · DATI", title: "Metti tutto in unità assolute", copy: "La temperatura al livello dell’aeroporto è T₀ = 25 + 273,15 = 298,2 K; il gradiente vale k = 0,0065 K/m.", formula: "p₀ = 105.000 Pa · T₀ = 298,2 K · k = 0,0065 K/m" },
        { label: "02 · ISA", title: "Trova la pressione associata a 8.000 m", copy: "L’altimetro indica la pressione ISA della quota letta. Dal materiale, a 8.000 m corrisponde p ≈ 35.599 Pa.", formula: "p(8.000 m) ≈ 35.599 Pa" },
        { label: "03 · TEMPERATURA", title: "Inverti la relazione pressione-temperatura", copy: "Il rapporto p/p₀ permette di ricavare la temperatura reale alla quota di volo.", formula: "T = T₀ · (p / p₀)^(1/5,256) = 298,2 · (35.599 / 105.000)^0,1903 = 242,5 K" },
        { label: "04 · RISULTATO", title: "Applica il gradiente reale", copy: "La differenza tra la temperatura al suolo e quella in quota, divisa per k, fornisce la quota vera.", formula: "zvera = (298,2 − 242,5) / 0,0065 ≈ 8.569 m" }
      ],
      kind: "number",
      unit: "m",
      expected: 8569,
      tolerance: 15,
      equation: "T = 242,5 K → zvera = (298,2 − 242,5) / 0,0065 ≈ 8.569 m",
      feedback: "Con un giorno caldo e alta pressione, la quota vera può differire dalla quota indicata dall’altimetro standard."
    },
    {
      type: "03 · QFE",
      title: "QFE: dalla quota indicata alla quota sul MSL",
      question: "La pista è a 1.000 m con p₁ = 85.000 Pa e T₁ = 15 °C. L’altimetro è regolato QFE e indica 9.000 m in crociera. Qual è la quota vera sul livello del mare?",
      data: [["Quota pista", "1.000", "m"], ["Pressione pista", "85.000", "Pa"], ["Temperatura pista", "15", "°C"], ["Quota indicata QFE", "9.000", "m"]],
      theory: "Con QFE l’altimetro legge zero sulla pista. Per ricostruire la quota vera bisogna prima riportare la pressione di 85.000 Pa al datum ISA, poi ricavare pressione e temperatura alla quota indicata e infine aggiungere la quota vera della pista.",
      guide: [
        { label: "01 · QFE", title: "Riconosci il datum", copy: "La lettura zero a 85.000 Pa non corrisponde al livello del mare: la pressione di riferimento va trasformata nella quota ISA equivalente.", formula: "zrif = (288,15 / 0,0065) · [1 − (85.000 / 101.325)^0,1903] ≈ 1.457 m" },
        { label: "02 · PRESSIONE", title: "Ricava p₂ dalla lettura QFE", copy: "La quota indicata di 9.000 m si somma al datum equivalente di 1.457 m nella relazione barometrica standard.", formula: "p₂ = 101.325 · [1 − (0,0065 / 288,15) · (9.000 + 1.457)]^5,256 ≈ 24.637 Pa" },
        { label: "03 · TEMPERATURA", title: "Ricava la temperatura in quota", copy: "Usa il rapporto p₂/p₁, perché il riferimento termico è la temperatura reale della pista.", formula: "T₂ = 288,15 · (24.637 / 85.000)^0,1903 ≈ 227,66 K" },
        { label: "04 · RISULTATO", title: "Calcola quota vera e quota MSL", copy: "La salita vera sopra la pista è (T₁ − T₂)/k. Poi si aggiungono i 1.000 m della pista rispetto al livello del mare.", formula: "zvera,pista ≈ 9.306 m → zvera,MSL ≈ 9.306 + 1.000 = 10.306 m" }
      ],
      kind: "number",
      unit: "m",
      expected: 10306,
      tolerance: 20,
      equation: "zvera,pista ≈ 9.306 m → zvera,MSL ≈ 10.306 m",
      feedback: "Il QFE azzera l’altimetro sulla pista: la quota indicata è riferita al campo, non direttamente al livello medio del mare."
    }
  ]);

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
    altimeterGauge: $("altimeter-gauge"), altimeterTicks: $("altimeter-ticks"), altimeterLongNeedle: $("altimeter-long-needle"), altimeterShortNeedle: $("altimeter-short-needle"),
    altimeterGaugeValue: $("altimeter-gauge-value"), altimeterTag: $("altimeter-tag"), altimeterReading: $("altimeter-reading"), altimeterSettingReadout: $("altimeter-setting-readout"), altimeterNote: $("altimeter-note"),
    airspeedGauge: $("airspeed-gauge"), airspeedTicks: $("airspeed-ticks"), airspeedNeedle: $("airspeed-needle"), airspeedGaugeValue: $("airspeed-gauge-value"), airspeedReading: $("airspeed-reading"), airspeedTasReading: $("airspeed-tas-reading"), machReading: $("mach-reading"), airspeedNote: $("airspeed-note"), airspeedWhiteArc: $("airspeed-white-arc"), airspeedGreenArc: $("airspeed-green-arc"), airspeedYellowArc: $("airspeed-yellow-arc"), airspeedVneLine: $("airspeed-vne-line"),
    vsiTicks: $("vsi-ticks"), vsiNeedle: $("vsi-needle"), vsiGaugeValue: $("vsi-gauge-value"), vsiReading: $("vsi-reading"), vsiGauge: $("vsi-gauge"),
    psReadout: $("ps-readout"), qReadout: $("q-readout"), casReadout: $("cas-readout"), easReadout: $("eas-readout"), tasReadout: $("tas-readout"),
    liveExplanation: $("live-explanation"),
    theoryStage: $("theory-stage"), theoryStageMode: $("theory-stage-mode"), theoryStageNote: $("theory-stage-note"), theoryStepLabel: $("theory-step-label"), theoryKicker: $("theory-kicker"), theoryTitle: $("theory-title"), theoryCopy: $("theory-copy"), theoryEquation: $("theory-equation"), theoryPtReadout: $("theory-pt-readout"), theoryPsReadout: $("theory-ps-readout"), theoryQReadout: $("theory-q-readout"), theoryQFormula: $("theory-q-formula"), theorySpeedFormula: $("theory-speed-formula"), theoryIasFormula: $("theory-ias-formula"), theoryDerivationNote: $("theory-derivation-note"), theoryAneroidMotion: $("theory-aneroid-motion"), theoryCutawayNeedle: $("theory-cutaway-needle"), theoryCutawayPressure: $("theory-cutaway-pressure"), theoryCutawayAltitude: $("theory-cutaway-altitude"), theoryCutawayState: $("theory-cutaway-state"),
    exerciseProgress: $("exercise-progress"), exerciseScore: $("exercise-score"), exerciseType: $("exercise-type"), exerciseState: $("exercise-state"), exerciseTitle: $("exercise-title"), exerciseQuestion: $("exercise-question"), exerciseData: $("exercise-data"), exerciseTheory: $("exercise-theory"), exerciseGuide: $("exercise-guide"), exerciseGuideProgress: $("exercise-guide-progress"), exerciseGuideNext: $("exercise-guide-next"), exerciseAnswerArea: $("exercise-answer-area"), exerciseSubmit: $("exercise-submit"), exerciseFeedback: $("exercise-feedback"), exerciseNext: $("exercise-next")
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

  function setNeedleGeometry(element, angle, length) {
    if (!element) return;
    // Draw the line from the hub to the calculated endpoint. This avoids all
    // CSS/SVG transform-origin differences and guarantees rotation around the
    // instrument centre in every browser.
    const radians = angle * Math.PI / 180;
    const x2 = 120 + length * Math.sin(radians);
    const y2 = 120 - length * Math.cos(radians);
    element.style.removeProperty("transform");
    element.removeAttribute("transform");
    element.setAttribute("x1", "120");
    element.setAttribute("y1", "120");
    element.setAttribute("x2", x2.toFixed(3));
    element.setAttribute("y2", y2.toFixed(3));
  }

  function gaugeArcPath(startValue, endValue, maxValue, radius) {
    const startAngle = -135 + (startValue / maxValue) * 270;
    const endAngle = -135 + (endValue / maxValue) * 270;
    const start = polarPoint(120, 120, radius, startAngle);
    const end = polarPoint(120, 120, radius, endAngle);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return `M${start.x.toFixed(2)} ${start.y.toFixed(2)} A${radius} ${radius} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
  }

  function renderAirspeedBands() {
    const scaleMax = 200;
    if (els.airspeedWhiteArc) els.airspeedWhiteArc.setAttribute("d", gaugeArcPath(40, 85, scaleMax, 94));
    if (els.airspeedGreenArc) els.airspeedGreenArc.setAttribute("d", gaugeArcPath(48, 129, scaleMax, 94));
    if (els.airspeedYellowArc) els.airspeedYellowArc.setAttribute("d", gaugeArcPath(129, 163, scaleMax, 94));
    if (els.airspeedVneLine) {
      const angle = -135 + (163 / scaleMax) * 270;
      const inner = polarPoint(120, 120, 82, angle);
      const outer = polarPoint(120, 120, 98, angle);
      els.airspeedVneLine.setAttribute("x1", inner.x.toFixed(2));
      els.airspeedVneLine.setAttribute("y1", inner.y.toFixed(2));
      els.airspeedVneLine.setAttribute("x2", outer.x.toFixed(2));
      els.airspeedVneLine.setAttribute("y2", outer.y.toFixed(2));
    }
  }

  function renderAltimeter(data) {
    const indication = data.indicatedAltitudeFt;
    const longAngle = ((indication % 10000) + 10000) % 10000 / 10000 * 360;
    const shortAngle = ((indication % 100000) + 100000) % 100000 / 100000 * 360;
    setNeedleGeometry(els.altimeterShortNeedle, shortAngle, 56);
    setText(els.altimeterGaugeValue, formatNumber(Math.round(indication), 0));
    setText(els.altimeterReading, formatFeet(indication));
    setText(els.altimeterSettingReadout, `${formatNumber(state.settingPressureHpa, 2)} hPa`);
    setText(els.altimeterTag, state.settingMode.toUpperCase());
    const labels = { qfe: "altezza rispetto alla pista", qnh: "altitudine rispetto al MSL", std: "quota-pressione / flight level", custom: "quota rispetto al datum manuale" };
    setText(els.altimeterNote, `${labels[state.settingMode]}${state.staticBlocked ? ". Presa statica bloccata: la lettura resta congelata." : "."}`);
    els.altimeterGauge.setAttribute("aria-label", `Altimetro: ${formatFeet(indication)}, setting ${state.settingMode.toUpperCase()} ${formatNumber(state.settingPressureHpa, 2)} hPa`);
  }

  function animateTheoryMechanism(capsuleScale, needleAngle) {
    if (!els.theoryAneroidMotion || !els.theoryCutawayNeedle || !els.altimeterLongNeedle) return;
    if (theoryMotion.frameId !== null) window.cancelAnimationFrame(theoryMotion.frameId);

    const startScale = theoryMotion.initialized ? theoryMotion.capsuleScale : capsuleScale;
    const startAngle = theoryMotion.initialized ? theoryMotion.needleAngle : needleAngle;
    let targetAngle = needleAngle;
    while (targetAngle - startAngle > 180) targetAngle -= 360;
    while (targetAngle - startAngle < -180) targetAngle += 360;
    const duration = theoryMotion.initialized ? 420 : 0;
    const startedAt = window.performance.now();

    const draw = (progress) => {
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      const scale = startScale + (capsuleScale - startScale) * eased;
      const angle = startAngle + (targetAngle - startAngle) * eased;
      theoryMotion.capsuleScale = scale;
      theoryMotion.needleAngle = angle;
      theoryMotion.initialized = true;
      els.theoryAneroidMotion.setAttribute("transform", `translate(220 133) scale(1 ${scale.toFixed(4)}) translate(-220 -133)`);
      els.theoryCutawayNeedle.setAttribute("transform", `rotate(${angle.toFixed(2)} 404 170)`);
      setNeedleGeometry(els.altimeterLongNeedle, angle, 85);
    };

    if (!duration) {
      draw(1);
      theoryMotion.frameId = null;
      return;
    }
    const tick = (now) => {
      const progress = model.clamp((now - startedAt) / duration, 0, 1);
      draw(progress);
      if (progress < 1) theoryMotion.frameId = window.requestAnimationFrame(tick);
      else theoryMotion.frameId = null;
    };
    theoryMotion.frameId = window.requestAnimationFrame(tick);
  }

  function renderAirspeed(data) {
    const airspeed = data.airspeed;
    const speedAngle = -135 + model.clamp(airspeed.iasKnots / 200, 0, 1) * 270;
    setNeedleGeometry(els.airspeedNeedle, speedAngle, 87);
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
    setNeedleGeometry(els.vsiNeedle, vsiAngle, 87);
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
    renderScene(data); renderAltimeter(data); renderAirspeed(data); renderVsi(); renderTheoryPhysics(data); renderExplanation(data);
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
    if (mode === "cockpit") {
      window.requestAnimationFrame(() => $("mode-cockpit")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }

  function renderTheoryStep(step = state.theoryStep) {
    const lesson = THEORY_STEPS[step] || THEORY_STEPS.pitot;
    state.theoryStep = THEORY_STEPS[step] ? step : "pitot";
    els.theoryStage.dataset.theoryStep = state.theoryStep;
    const theoryCard = els.theoryStage.closest(".theory-card");
    if (theoryCard) theoryCard.dataset.theoryStep = state.theoryStep;
    setText(els.theoryStageMode, lesson.mode);
    setText(els.theoryStageNote, lesson.note);
    setText(els.theoryStepLabel, lesson.label);
    const progressBar = document.querySelector(".theory-progress b");
    if (progressBar) progressBar.style.width = `${(Object.keys(THEORY_STEPS).indexOf(state.theoryStep) + 1) / Object.keys(THEORY_STEPS).length * 100}%`;
    setText(els.theoryKicker, lesson.kicker);
    setText(els.theoryTitle, lesson.title);
    els.theoryCopy.innerHTML = lesson.copy
      .replace(/Pₜ/g, "P<sub>t</sub>")
      .replace(/Pₛ/g, "P<sub>s</sub>")
      .replace(/\bPt\b/g, "P<sub>t</sub>")
      .replace(/\bPs\b/g, "P<sub>s</sub>");
    els.theoryEquation.innerHTML = lesson.equation
      .replace(/Pₜ/g, "P<sub>t</sub>")
      .replace(/Pₛ/g, "P<sub>s</sub>")
      .replace(/Pt/g, "P<sub>t</sub>")
      .replace(/Ps/g, "P<sub>s</sub>");
    $$(".theory-step").forEach((button) => {
      const active = button.dataset.theoryStep === state.theoryStep;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function renderTheoryPhysics(data) {
    const airspeed = data.airspeed;
    const staticPressurePa = data.sensorStaticPressurePa;
    const dynamicPressurePa = airspeed.measuredDynamicPressurePa;
    const density = Math.max(airspeed.densityKgM3, 0.001);
    const incompressibleSpeedKnots = model.mpsToKnots(Math.sqrt((2 * dynamicPressurePa) / density));
    const positionErrorLabel = airspeed.positionErrorKnots >= 0
      ? `+${formatNumber(airspeed.positionErrorKnots, 1)}`
      : formatNumber(airspeed.positionErrorKnots, 1);
    const referenceSeaLevelPa = model.hpaToPa(CONFIG.scenarioQnhHpa);
    const pressureDrop = model.clamp(1 - staticPressurePa / referenceSeaLevelPa, 0, 0.7);
    const capsuleScale = 1 + pressureDrop * 0.75;
    const altitudeDelta = state.altitudeFt - state.theoryPreviousAltitudeFt;
    const motionState = state.staticBlocked
      ? "PRESA BLOCCATA"
      : Math.abs(altitudeDelta) < 1
        ? "QUOTA STABILIZZATA"
        : altitudeDelta > 0
          ? "SALITA · Ps ↓"
          : "DISCESA · Ps ↑";

    setText(els.theoryPtReadout, `${formatNumber(airspeed.totalPressurePa, 0)} Pa`);
    setText(els.theoryPsReadout, `${formatNumber(staticPressurePa, 0)} Pa`);
    setText(els.theoryQReadout, `${formatNumber(dynamicPressurePa, 0)} Pa`);
    els.theoryQFormula.innerHTML = `q = P<sub>t</sub> − P<sub>s</sub> = ${formatNumber(dynamicPressurePa, 0)} Pa`;
    els.theorySpeedFormula.innerHTML = `V ≈ √(2q / ρ) = ${formatNumber(incompressibleSpeedKnots, 1)} kt · ρ ${formatNumber(density, 3)} kg/m³`;
    els.theoryIasFormula.innerHTML = `IAS = CAS − e<sub>pos</sub> = ${formatKnots(airspeed.casKnots)} − (${positionErrorLabel} kt) = ${formatKnots(airspeed.iasKnots)}`;
    setText(els.theoryDerivationNote, state.staticBlocked
      ? "La presa statica è bloccata: il sensore conserva Ps, mentre Pt continua a variare. Il differenziale e la lettura possono quindi diventare anomali."
      : "V ≈ √(2q / ρ) è la forma incomprimibile: ρ è la densità dell’aria. Il modello live usa inoltre la relazione comprimibile per Pt e la densità standard ρ₀ per la CAS.");

    const altimeterTurn = (((data.indicatedAltitudeFt % 10000) + 10000) % 10000) / 10000 * 360;
    animateTheoryMechanism(capsuleScale, altimeterTurn);
    setText(els.theoryCutawayPressure, `Ps cassa: ${formatNumber(model.paToHpa(staticPressurePa), 1)} hPa`);
    setText(els.theoryCutawayAltitude, formatFeet(data.indicatedAltitudeFt));
    setText(els.theoryCutawayState, motionState);
    state.theoryPreviousAltitudeFt = state.altitudeFt;
  }

  function exerciseExpected(exercise) {
    return typeof exercise.expected === "function" ? exercise.expected() : exercise.expected;
  }

  function renderExerciseGuide() {
    const exercise = EXERCISES[state.exerciseIndex];
    if (!exercise || !exercise.guide || !els.exerciseGuide) return;
    const totalSteps = exercise.guide.length;
    const visibleSteps = model.clamp(state.exerciseGuideStep, 1, totalSteps);
    state.exerciseGuideStep = visibleSteps;
    if (els.exerciseTheory) {
      els.exerciseTheory.innerHTML = `<strong>Richiamo teorico</strong><p>${exercise.theory}</p>`;
    }
    els.exerciseGuide.innerHTML = exercise.guide.map((step, index) => `
      <article class="exercise-guide-step"${index < visibleSteps ? "" : " hidden"}>
        <div class="exercise-guide-index">${String(index + 1).padStart(2, "0")}</div>
        <div><span>${step.label}</span><h4>${step.title}</h4><p>${step.copy}</p><code>${step.formula}</code></div>
      </article>
    `).join("");
    setText(els.exerciseGuideProgress, `PASSO ${String(visibleSteps).padStart(2, "0")} / ${String(totalSteps).padStart(2, "0")}`);
    const complete = visibleSteps >= totalSteps;
    els.exerciseGuideNext.hidden = complete;
    els.exerciseGuideNext.textContent = complete ? "Svolgimento completo" : `Mostra passo ${String(visibleSteps + 1).padStart(2, "0")} →`;
  }

  function nextExerciseGuideStep() {
    const exercise = EXERCISES[state.exerciseIndex];
    if (!exercise || state.exerciseGuideStep >= exercise.guide.length) return;
    state.exerciseGuideStep += 1;
    renderExerciseGuide();
  }

  function renderExercise() {
    const exercise = EXERCISES[state.exerciseIndex];
    if (!exercise) return;
    state.exerciseAnswered = false;
    state.exerciseGuideStep = 1;
    setText(els.exerciseProgress, `${String(state.exerciseIndex + 1).padStart(2, "0")} / ${String(EXERCISES.length).padStart(2, "0")}`);
    setText(els.exerciseScore, state.exerciseScore);
    setText(els.exerciseType, exercise.type);
    setText(els.exerciseState, "IN ATTESA");
    els.exerciseState.classList.remove("is-correct", "is-wrong");
    setText(els.exerciseTitle, exercise.title);
    setText(els.exerciseQuestion, exercise.question);
    els.exerciseData.innerHTML = exercise.data.map(([label, value, unit]) => `
      <div><span>${label}</span><strong>${value}</strong><small>${unit}</small></div>
    `).join("");
    renderExerciseGuide();

    if (exercise.kind === "choice") {
      els.exerciseAnswerArea.innerHTML = `
        <fieldset class="exercise-options">
          <legend>Scegli una sequenza</legend>
          ${exercise.options.map(([value, label, note]) => `
            <label><input type="radio" name="exercise-answer" value="${value}"><span><b>${value.toUpperCase()}</b><strong>${label}</strong><small>${note}</small></span></label>
          `).join("")}
        </fieldset>
      `;
      $$('input[name="exercise-answer"]').forEach((input) => input.addEventListener("change", () => {
        els.exerciseSubmit.disabled = false;
      }));
    } else {
      els.exerciseAnswerArea.innerHTML = `
        <label class="exercise-number-entry" for="exercise-answer"><span>Risposta</span><div><input id="exercise-answer" type="number" inputmode="decimal" step="any" aria-label="Risposta esercizio"><b>${exercise.unit}</b></div></label>
      `;
      $("exercise-answer").addEventListener("input", (event) => {
        els.exerciseSubmit.disabled = event.target.value.trim() === "";
      });
    }
    els.exerciseFeedback.hidden = true;
    els.exerciseFeedback.className = "exercise-feedback";
    els.exerciseNext.hidden = true;
    els.exerciseNext.textContent = state.exerciseIndex === EXERCISES.length - 1 ? "Ricomincia esercizi ↺" : "Prossimo esercizio →";
    els.exerciseSubmit.disabled = true;
  }

  function checkExercise() {
    if (state.exerciseAnswered) return;
    const exercise = EXERCISES[state.exerciseIndex];
    let answer;
    if (exercise.kind === "choice") {
      answer = document.querySelector('input[name="exercise-answer"]:checked')?.value;
      if (!answer) return;
    } else {
      answer = Number($("exercise-answer")?.value);
      if (!Number.isFinite(answer)) return;
    }

    const expected = exerciseExpected(exercise);
    const correct = exercise.kind === "choice"
      ? answer === expected
      : Math.abs(answer - expected) <= exercise.tolerance;
    state.exerciseAnswered = true;
    state.exerciseGuideStep = exercise.guide.length;
    renderExerciseGuide();
    if (correct) state.exerciseScore += 1;
    setText(els.exerciseScore, state.exerciseScore);
    setText(els.exerciseState, correct ? "CORRETTA" : "DA RIVEDERE");
    els.exerciseState.classList.toggle("is-correct", correct);
    els.exerciseState.classList.toggle("is-wrong", !correct);
    els.exerciseFeedback.hidden = false;
    els.exerciseFeedback.classList.toggle("is-correct", correct);
    els.exerciseFeedback.classList.toggle("is-wrong", !correct);
    const expectedText = exercise.kind === "choice"
      ? ""
      : `<span>Risposta attesa: <strong>${formatNumber(expected, Number.isInteger(expected) ? 0 : 1)} ${exercise.unit}</strong></span><br>`;
    els.exerciseFeedback.innerHTML = correct
      ? `<strong>Corretto.</strong> ${exercise.feedback}<br><code>${exercise.equation}</code>`
      : `<strong>Rivedi il passaggio.</strong> ${exercise.feedback}<br>${expectedText}<code>${exercise.equation}</code>`;
    $$('input[name="exercise-answer"], #exercise-answer').forEach((input) => { input.disabled = true; });
    els.exerciseSubmit.disabled = true;
    els.exerciseNext.hidden = false;
  }

  function nextExercise() {
    const lastExercise = state.exerciseIndex === EXERCISES.length - 1;
    if (lastExercise) {
      state.exerciseIndex = 0;
      state.exerciseScore = 0;
    } else {
      state.exerciseIndex += 1;
    }
    renderExercise();
  }

  function resetLab() {
    stopFlight(); state.altitudeFt = 2000; state.theoryPreviousAltitudeFt = 2000; state.tasKnots = 110; state.positionErrorKnots = 0; state.verticalSpeedFpm = 0; state.staticBlocked = false; state.blockedPressurePa = null; state.settingMode = "qnh"; state.settingPressureHpa = CONFIG.scenarioQnhHpa;
    els.staticBlockage.checked = false; applyPreset("qnh"); render();
  }

  function bindEvents() {
    $$(".mode-tab").forEach((tab) => tab.addEventListener("click", () => onModeChange(tab.dataset.mode)));
    $$(".theory-step").forEach((button) => button.addEventListener("click", () => renderTheoryStep(button.dataset.theoryStep)));
    els.altitudeRange.addEventListener("input", (event) => setNumericState("altitudeFt", event.target.value, 0, 36000, 100));
    els.altitudeNumber.addEventListener("change", (event) => setNumericState("altitudeFt", event.target.value, 0, 36000, 100));
    els.tasRange.addEventListener("input", (event) => setNumericState("tasKnots", event.target.value, 40, 180, 1));
    els.tasNumber.addEventListener("change", (event) => setNumericState("tasKnots", event.target.value, 40, 180, 1));
    els.positionErrorRange.addEventListener("input", (event) => setNumericState("positionErrorKnots", event.target.value, -5, 10, .5));
    els.verticalSpeedRange.addEventListener("input", (event) => setNumericState("verticalSpeedFpm", event.target.value, -3000, 3000, 100));
    els.settingPreset.addEventListener("change", (event) => { applyPreset(event.target.value); render(); });
    els.settingPressure.addEventListener("change", (event) => { const value = Number(event.target.value); if (Number.isFinite(value)) { state.settingMode = "custom"; state.settingPressureHpa = model.clamp(value, 850, 1050); els.settingPreset.value = "custom"; updateSettingHelp(); render(); } });
    els.staticBlockage.addEventListener("change", updateStaticBlockage);
    els.flightToggle.addEventListener("click", toggleFlight);
    els.resetLab.addEventListener("click", resetLab);
    els.exerciseSubmit.addEventListener("click", checkExercise);
    els.exerciseGuideNext.addEventListener("click", nextExerciseGuideStep);
    els.exerciseNext.addEventListener("click", nextExercise);
  }

  createSceneTicks();
  createGaugeTicks(els.altimeterTicks, 10, 1, 1, 0, 324, 1);
  createGaugeTicks(els.airspeedTicks, 200, 10, 20, -135, 135, 20);
  renderAirspeedBands();
  createVsiTicks();
  renderTheoryStep();
  renderExercise();
  updateSettingHelp(); bindEvents(); render();
}());

