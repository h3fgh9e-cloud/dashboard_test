/**
 * Calculates the loading quantity and cost based on user-provided formulas.
 */

function calculateLoadingStats(truck, part) {
  if (!part.용기_장 || !part.용기_폭 || !part.용기_고) return null;

  // 1. 적재단수 산출
  let layers = 1;
  if (part.용기_고 <= 1050) {
    layers = 3;
  } else if (part.용기_고 <= 1380) {
    layers = 2;
  } else {
    layers = 1;
  }

  // 2. 장기준 PLT 산출
  const qtyL_long = Math.floor(truck.적재함_장 / part.용기_장);
  const qtyW_long = Math.floor(truck.적재함_폭 / part.용기_폭);
  const longCriteriaPLT = qtyL_long * qtyW_long * layers;

  // 3. 폭기준 PLT 산출
  const qtyL_wide = Math.floor(truck.적재함_장 / part.용기_폭);
  const qtyW_wide = Math.floor(truck.적재함_폭 / part.용기_장);
  const wideCriteriaPLT = qtyL_wide * qtyW_wide * layers;

  // 4. 상차 PLT 결정
  const finalPLT = Math.max(longCriteriaPLT, wideCriteriaPLT);

  return {
    적재단수: layers,
    장기준_PLT: longCriteriaPLT,
    폭기준_PLT: wideCriteriaPLT,
    상차_PLT: finalPLT,
    비고: layers > 1 ? `${layers}단 적재 적용` : '1단 적재 적용'
  };
}

function calculateOneTimeCost(criteria, distance) {
  let a, b;
  if (distance <= 60) {
    a = criteria.계수_60이하;
    b = criteria.고정_60이하;
  } else {
    a = criteria.계수_60초과;
    b = criteria.고정_60초과;
  }
  return Math.round(a * distance + b);
}

module.exports = {
  calculateLoadingStats,
  calculateOneTimeCost
};
