/**
 * Counts how many times a given weekday occurs in a specific month/year.
 * @param weekday - The weekday name in Portuguese (e.g. 'Segunda', 'Terça', 'Sexta')
 * @param month - 0-indexed month (0 = January)
 * @param year - Full year (e.g. 2025)
 * @returns Number of occurrences (typically 4 or 5)
 */
export function countWeekdayOccurrencesInMonth(
  weekday: string,
  month: number,
  year: number
): number {
  const dayMap: Record<string, number> = {
    'Domingo': 0,
    'Segunda': 1,
    'Terça': 2,
    'Quarta': 3,
    'Quinta': 4,
    'Sexta': 5,
    'Sábado': 6,
  };

  const targetDay = dayMap[weekday];
  if (targetDay === undefined) return 4; // fallback

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    if (new Date(year, month, d).getDay() === targetDay) {
      count++;
    }
  }
  return count;
}

/**
 * Calculates the dynamic per-session value for a "Mensal" package.
 * Divides the monthly value by the number of times the patient's therapy day
 * occurs in the given month.
 */
export function getDynamicSessionValue(
  monthlyValue: number,
  weekdays: string[] | undefined,
  month: number,
  year: number
): { perSession: number; occurrences: number; sessionDay: string | null } {
  // 🔒 TRAVA: sem dias da semana definidos NÃO há "valor por sessão" calculável.
  // Retornar `monthlyValue` aqui inflava o faturamento (cada sessão registrada
  // valia uma mensalidade inteira). Devolvemos perSession=0 e occurrences=0
  // para o chamador decidir o fallback seguro.
  if (!weekdays || weekdays.length === 0) {
    return { perSession: 0, occurrences: 0, sessionDay: null };
  }

  // If patient has multiple days, sum occurrences across all days
  let totalOccurrences = 0;
  for (const day of weekdays) {
    totalOccurrences += countWeekdayOccurrencesInMonth(day, month, year);
  }

  if (totalOccurrences === 0) {
    return { perSession: 0, occurrences: 0, sessionDay: weekdays[0] };
  }

  return {
    perSession: monthlyValue / totalOccurrences,
    occurrences: totalOccurrences,
    sessionDay: weekdays.length === 1 ? weekdays[0] : null,
  };
}

/**
 * Calculates the final revenue for a "Mensal" package considering absence deductions.
 * @param monthlyValue - The total monthly package value
 * @param perSessionValue - The dynamic per-session value
 * @param absenceCount - Number of deductible absences ('falta')
 * @returns The adjusted revenue and deduction details
 */
export function calculateMensalRevenueWithDeductions(
  monthlyValue: number,
  perSessionValue: number,
  absenceCount: number
): { finalRevenue: number; deduction: number; hasDeduction: boolean } {
  const deduction = absenceCount * perSessionValue;
  const finalRevenue = Math.max(0, monthlyValue - deduction);
  return {
    finalRevenue,
    deduction,
    hasDeduction: absenceCount > 0,
  };
}
