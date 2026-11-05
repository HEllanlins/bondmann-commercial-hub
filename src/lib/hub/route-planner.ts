export type Coordinate = { lat: number; lng: number };
export type PlannedStop = { id: string; appointmentSec: number | null; durationSec: number; opensSec?: number | null; closesSec?: number | null };
export type Arrival = { id: string; arrivalSec: number; departureSec: number; lateSec: number; conflict: boolean };

/** Matrix index 0 is the origin, indices 1..n follow the supplied stops. */
export function planAppointments(stops: PlannedStop[], durations: (number | null)[][], startSec: number): Arrival[] {
  const pending = stops.map((stop, i) => ({ ...stop, index: i + 1 }));
  const result: Arrival[] = []; let time = startSec, current = 0;
  const travel = (a: number, b: number) => durations[a]?.[b] ?? Infinity;
  while (pending.length) {
    const fixed = pending.filter(s => s.appointmentSec !== null).sort((a, b) => Number(a.appointmentSec) - Number(b.appointmentSec))[0];
    const flexible = pending.filter(s => s.appointmentSec === null).sort((a, b) => travel(current, a.index) - travel(current, b.index));
    const candidate = flexible.find(s => {
      const arrive = Math.max(time + travel(current, s.index), s.opensSec ?? 0);
      const finish = arrive + s.durationSec;
      return (!s.closesSec || finish <= s.closesSec) && (!fixed || finish + travel(s.index, fixed.index) <= Number(fixed.appointmentSec));
    });
    const next = candidate ?? fixed ?? flexible[0];
    if (!next) break;
    const raw = time + travel(current, next.index);
    const arrival = Math.max(raw, next.appointmentSec ?? 0, next.opensSec ?? 0);
    const departure = arrival + next.durationSec;
    result.push({ id: next.id, arrivalSec: arrival, departureSec: departure, lateSec: next.appointmentSec === null ? 0 : Math.max(0, raw - next.appointmentSec), conflict: !Number.isFinite(raw) || Boolean(next.closesSec && departure > next.closesSec) });
    time = departure; current = next.index; pending.splice(pending.findIndex(s => s.id === next.id), 1);
  }
  return result;
}

export const normalizeIdentity = (value: string | null | undefined) => (value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
export function sameProspect(a: { name: string; address: string | null; place_id?: string | null }, b: { name: string; address: string | null; place_id?: string | null }) {
  if (a.place_id && b.place_id && a.place_id === b.place_id) return true;
  return Boolean(a.address && b.address && normalizeIdentity(a.name) === normalizeIdentity(b.name) && normalizeIdentity(a.address) === normalizeIdentity(b.address));
}