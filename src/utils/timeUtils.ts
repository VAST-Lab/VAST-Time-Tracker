export function adjustEndTime(startTime: string, endTime: string): string {
  if (!startTime || !endTime) return endTime;

  const [sH, sM] = startTime.split(':').map(Number);
  const [eH, eM] = endTime.split(':').map(Number);

  if (isNaN(sH) || isNaN(eH) || isNaN(sM) || isNaN(eM)) return endTime;

  if (sH < 12 && sH !== 0 && eH === 0) {
    return `12:${String(eM).padStart(2, '0')}`;
  }
  if (sH > 12 && eH === 12) {
    return `00:${String(eM).padStart(2, '0')}`;
  }
  if (sH < 12 && sH >= 7 && eH > 0 && eH < sH && (eH + 12 - sH) <= 12) {
    return `${String(eH + 12).padStart(2, '0')}:${String(eM).padStart(2, '0')}`;
  }
  if (sH > 12 && eH > 12 && (eH - 12) < (sH - 12)) {
    return `${String(eH - 12).padStart(2, '0')}:${String(eM).padStart(2, '0')}`;
  }

  return endTime;
}

export function getEndDateTime(dateStr: string, startTime: string, endTime: string): Date {
  const adjustedEnd = adjustEndTime(startTime, endTime);
  const endDateObj = new Date(`${dateStr}T${adjustedEnd}`);
  if (adjustedEnd < startTime) {
    endDateObj.setDate(endDateObj.getDate() + 1);
  }
  return endDateObj;
}
