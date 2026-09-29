/**
 * Helper para cálculo consistente del ciclo de nómina (Sábado a Viernes)
 */

export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Devuelve el ciclo de nómina (sábado a viernes) en curso que incluye la fecha actual.
 */
export function getCurrentPayrollCycle(referenceDate: Date = new Date()) {
  const d = new Date(referenceDate);
  const shiftedDay = (d.getDay() + 1) % 7; // Sábado es 0, Domingo 1, ..., Viernes 6
  
  const currentSat = new Date(d);
  currentSat.setDate(d.getDate() - shiftedDay);
  
  const currentFri = new Date(currentSat);
  currentFri.setDate(currentSat.getDate() + 6);

  return {
    start: toLocalDateString(currentSat),
    end: toLocalDateString(currentFri),
  };
}

/**
 * Devuelve el ciclo de nómina anterior (semana cerrada).
 */
export function getPreviousPayrollCycle(referenceDate: Date = new Date()) {
  const current = getCurrentPayrollCycle(referenceDate);
  const start = new Date(current.start + "T12:00:00");
  start.setDate(start.getDate() - 7);
  const end = new Date(current.end + "T12:00:00");
  end.setDate(end.getDate() - 7);

  return {
    start: toLocalDateString(start),
    end: toLocalDateString(end),
  };
}

/**
 * Devuelve la clave ISO-Week para el selector de semanas.
 */
export function getPayrollWeekString(referenceDate: Date = new Date()): string {
  const cycle = getCurrentPayrollCycle(referenceDate);
  const sat = new Date(cycle.start + "T12:00:00");
  sat.setHours(0, 0, 0, 0);
  sat.setDate(sat.getDate() + 3 - ((sat.getDay() + 6) % 7));
  const week1 = new Date(sat.getFullYear(), 0, 4);
  const weekNumber = 1 + Math.round(((sat.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${sat.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`;
}
