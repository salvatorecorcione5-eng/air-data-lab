(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.AirDataModel = factory();
  }
}(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Values used in the supplied course material for the ISA reference.
  const CONSTANTS = Object.freeze({
    p0Pa: 101325,
    t0K: 288.15,
    rho0KgM3: 1.225,
    gasConstant: 287,
    gamma: 1.4,
    gravity: 9.807,
    lapseRateKPerM: 0.0065,
    knotsToMps: 0.514444,
    maxTroposphereM: 11000
  });

  const PRESSURE_EXPONENT = CONSTANTS.gravity /
    (CONSTANTS.lapseRateKPerM * CONSTANTS.gasConstant);

  function clamp(value, minimum, maximum) {
    return Math.min(Math.max(value, minimum), maximum);
  }

  function feetToMeters(feet) {
    return feet * 0.3048;
  }

  function metersToFeet(meters) {
    return meters / 0.3048;
  }

  function knotsToMps(knots) {
    return knots * CONSTANTS.knotsToMps;
  }

  function mpsToKnots(mps) {
    return mps / CONSTANTS.knotsToMps;
  }

  function hpaToPa(hpa) {
    return hpa * 100;
  }

  function paToHpa(pa) {
    return pa / 100;
  }

  function isaTemperatureK(altitudeM) {
    const troposphereAltitude = clamp(altitudeM, -1000, CONSTANTS.maxTroposphereM);
    return CONSTANTS.t0K - CONSTANTS.lapseRateKPerM * troposphereAltitude;
  }

  function isaTemperatureAtAltitudeFt(altitudeFt) {
    return isaTemperatureK(feetToMeters(altitudeFt));
  }

  // Pressure profile in the troposphere. seaLevelPressurePa allows a QNH
  // scenario to be modelled while retaining the ISA vertical gradient.
  function pressureAtAltitudeM(altitudeM, seaLevelPressurePa) {
    const pressureAtSeaLevel = seaLevelPressurePa === undefined
      ? CONSTANTS.p0Pa
      : seaLevelPressurePa;
    const temperature = isaTemperatureK(altitudeM);
    return pressureAtSeaLevel * Math.pow(temperature / CONSTANTS.t0K, PRESSURE_EXPONENT);
  }

  function pressureAtAltitudeFt(altitudeFt, seaLevelPressurePa) {
    return pressureAtAltitudeM(feetToMeters(altitudeFt), seaLevelPressurePa);
  }

  function densityFromPressureAndTemperature(pressurePa, temperatureK) {
    return pressurePa / (CONSTANTS.gasConstant * temperatureK);
  }

  function isaDensityAtAltitudeM(altitudeM, seaLevelPressurePa) {
    const temperature = isaTemperatureK(altitudeM);
    const pressure = pressureAtAltitudeM(altitudeM, seaLevelPressurePa);
    return densityFromPressureAndTemperature(pressure, temperature);
  }

  // Inverse of the ISA pressure relation, expressed as pressure altitude.
  function pressureAltitudeM(pressurePa) {
    const pressureRatio = Math.max(pressurePa, 1) / CONSTANTS.p0Pa;
    return (CONSTANTS.t0K / CONSTANTS.lapseRateKPerM) *
      (1 - Math.pow(pressureRatio, 1 / PRESSURE_EXPONENT));
  }

  function pressureAltitudeFt(pressurePa) {
    return metersToFeet(pressureAltitudeM(pressurePa));
  }

  // The altimeter is calibrated in ISA and compares the sensed pressure with
  // the selected pressure setting.
  function indicatedAltitudeFt(staticPressurePa, settingPressurePa) {
    return pressureAltitudeFt(staticPressurePa) - pressureAltitudeFt(settingPressurePa);
  }

  function speedOfSoundMps(temperatureK) {
    return Math.sqrt(CONSTANTS.gamma * CONSTANTS.gasConstant * temperatureK);
  }

  function totalPressureFromMach(staticPressurePa, mach) {
    return staticPressurePa * Math.pow(
      1 + ((CONSTANTS.gamma - 1) / 2) * mach * mach,
      CONSTANTS.gamma / (CONSTANTS.gamma - 1)
    );
  }

  function calculateAirspeed(options) {
    const tasKnots = Number(options.tasKnots);
    const staticPressurePa = Number(options.staticPressurePa);
    const temperatureK = Number(options.temperatureK);
    const positionErrorKnots = Number(options.positionErrorKnots || 0);
    const sensorStaticPressurePa = options.sensorStaticPressurePa === undefined
      ? staticPressurePa
      : Number(options.sensorStaticPressurePa);
    const tasMps = knotsToMps(tasKnots);
    const densityKgM3 = densityFromPressureAndTemperature(staticPressurePa, temperatureK);
    const soundSpeedMps = speedOfSoundMps(temperatureK);
    const mach = tasMps / soundSpeedMps;
    const totalPressurePa = totalPressureFromMach(staticPressurePa, mach);
    const measuredDynamicPressurePa = Math.max(totalPressurePa - sensorStaticPressurePa, 0);
    const casMps = Math.sqrt((2 * measuredDynamicPressurePa) / CONSTANTS.rho0KgM3);
    const easMps = tasMps * Math.sqrt(densityKgM3 / CONSTANTS.rho0KgM3);
    const incompressibleDynamicPressurePa = 0.5 * densityKgM3 * tasMps * tasMps;

    return {
      tasKnots,
      tasMps,
      mach,
      soundSpeedMps,
      staticPressurePa,
      sensorStaticPressurePa,
      totalPressurePa,
      measuredDynamicPressurePa,
      incompressibleDynamicPressurePa,
      densityKgM3,
      casKnots: mpsToKnots(casMps),
      easKnots: mpsToKnots(easMps),
      iasKnots: mpsToKnots(casMps) - positionErrorKnots,
      positionErrorKnots
    };
  }

  return Object.freeze({
    CONSTANTS,
    PRESSURE_EXPONENT,
    clamp,
    feetToMeters,
    metersToFeet,
    knotsToMps,
    mpsToKnots,
    hpaToPa,
    paToHpa,
    isaTemperatureK,
    isaTemperatureAtAltitudeFt,
    pressureAtAltitudeM,
    pressureAtAltitudeFt,
    densityFromPressureAndTemperature,
    isaDensityAtAltitudeM,
    pressureAltitudeM,
    pressureAltitudeFt,
    indicatedAltitudeFt,
    speedOfSoundMps,
    totalPressureFromMach,
    calculateAirspeed
  });
}));

