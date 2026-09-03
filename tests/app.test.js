const test = require("node:test");
const assert = require("node:assert/strict");
const model = require("../air-data-model.js");

test("la pressione ISA al livello del mare è il riferimento P0", () => {
  assert.equal(model.pressureAtAltitudeFt(0), model.CONSTANTS.p0Pa);
});

test("la pressione ISA a 5000 m è circa 54019 Pa", () => {
  const pressure = model.pressureAtAltitudeM(5000);
  assert.ok(Math.abs(pressure - 54019.5) < 35, `pressione ottenuta: ${pressure}`);
});

test("la densità relativa soddisfa delta = sigma * theta", () => {
  const altitudeM = 3000;
  const temperature = model.isaTemperatureK(altitudeM);
  const pressure = model.pressureAtAltitudeM(altitudeM);
  const density = model.densityFromPressureAndTemperature(pressure, temperature);
  const theta = temperature / model.CONSTANTS.t0K;
  const delta = pressure / model.CONSTANTS.p0Pa;
  const sigma = density / model.CONSTANTS.rho0KgM3;
  assert.ok(Math.abs(delta - sigma * theta) < 1e-12);
});

test("l'altimetro con QFE legge zero sulla pista", () => {
  const airportElevationFt = 2000;
  const qnhPa = model.hpaToPa(1005);
  const qfePa = model.pressureAtAltitudeFt(airportElevationFt, qnhPa);
  const reading = model.indicatedAltitudeFt(qfePa, qfePa);
  assert.ok(Math.abs(reading) < 0.001, `lettura ottenuta: ${reading}`);
});

test("QNH restituisce l'elevazione della pista rispetto al MSL", () => {
  const airportElevationFt = 2000;
  const qnhPa = model.hpaToPa(1005);
  const qfePa = model.pressureAtAltitudeFt(airportElevationFt, qnhPa);
  const reading = model.indicatedAltitudeFt(qfePa, qnhPa);
  // The source material describes QNH as an approximately MSL-referenced
  // indication; the ISA altimeter scale introduces a small offset for a
  // non-standard demo QNH.
  assert.ok(Math.abs(reading - airportElevationFt) < 10, `lettura ottenuta: ${reading}`);
});

test("la catena pitot produce EAS minore di TAS e CAS in regime comprimibile", () => {
  const altitudeFt = 3000;
  const qnhPa = model.hpaToPa(1005);
  const staticPressurePa = model.pressureAtAltitudeFt(altitudeFt, qnhPa);
  const temperatureK = model.isaTemperatureAtAltitudeFt(altitudeFt);
  const result = model.calculateAirspeed({ tasKnots: 250, staticPressurePa, temperatureK });
  assert.ok(result.casKnots > result.easKnots, `${result.casKnots} non è maggiore di ${result.easKnots}`);
  assert.ok(result.easKnots < result.tasKnots, `${result.easKnots} non è minore di ${result.tasKnots}`);
  assert.ok(result.mach > 0);
});

test("un blocco statico conserva la pressione catturata", () => {
  const qnhPa = model.hpaToPa(1005);
  const blockedPressurePa = model.pressureAtAltitudeFt(2000, qnhPa);
  const pressureLaterPa = model.pressureAtAltitudeFt(5000, qnhPa);
  const result = model.calculateAirspeed({
    tasKnots: 180,
    staticPressurePa: pressureLaterPa,
    sensorStaticPressurePa: blockedPressurePa,
    temperatureK: model.isaTemperatureAtAltitudeFt(5000)
  });
  assert.equal(result.sensorStaticPressurePa, blockedPressurePa);
  assert.ok(result.measuredDynamicPressurePa < result.totalPressurePa);
});

