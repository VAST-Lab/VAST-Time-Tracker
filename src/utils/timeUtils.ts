export function parse12Hour(timeStr: string): { hour12: number; minute: number; meridiem: 'AM' | 'PM' } | null {
  if (!timeStr) return null;
  const [hStr, mStr] = timeStr.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) return null;

  const meridiem: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
  let hour12 = h % 12;
  if (hour12 === 0) hour12 = 12;

  return { hour12, minute: m, meridiem };
}

export function format24Hour(hour12: number, minute: number, meridiem: 'AM' | 'PM'): string {
  let h24 = hour12 % 12;
  if (meridiem === 'PM') h24 += 12;
  return `${String(h24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function adjustEndTimeOnChange(newEndTime: string, prevEndTime: string): string {
  if (!newEndTime) return newEndTime;
  if (!prevEndTime) return newEndTime;

  const prev = parse12Hour(prevEndTime);
  const curr = parse12Hour(newEndTime);
  if (!prev || !curr) return newEndTime;

  const hourChangedTo12 = prev.hour12 !== 12 && curr.hour12 === 12;

  if (hourChangedTo12) {
    const swappedMeridiem: 'AM' | 'PM' = prev.meridiem === 'AM' ? 'PM' : 'AM';
    return format24Hour(12, curr.minute, swappedMeridiem);
  }

  return newEndTime;
}

export function getEndDateTime(dateStr: string, startTime: string, endTime: string): Date {
  const endDateObj = new Date(`${dateStr}T${endTime}`);
  if (endTime < startTime) {
    endDateObj.setDate(endDateObj.getDate() + 1);
  }
  return endDateObj;
}
