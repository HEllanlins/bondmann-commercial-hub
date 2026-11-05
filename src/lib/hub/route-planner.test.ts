import { describe, expect, it } from 'vitest';
import { planAppointments, sameProspect } from './route-planner';
describe('scheduled appointments take priority', () => {
  it('does not put a flexible 30 minute visit before the 09:00 appointment when it causes lateness', () => {
    const stops = [{ id: 'A', appointmentSec: 9*3600, durationSec: 1800 }, { id: 'C', appointmentSec: null, durationSec: 1800 }];
    const plan = planAppointments(stops, [[0,1200,300],[1200,0,1200],[300,1200,0]],8.5*3600);
    expect(plan.map(s=>s.id)).toEqual(['A','C']); expect(plan[0]?.lateSec).toBe(0);
  });
  it('preserves 09:00 then 11:00 appointments regardless of geographic proximity', () => {
    const plan=planAppointments([{id:'A',appointmentSec:32400,durationSec:1800},{id:'B',appointmentSec:39600,durationSec:1800}],[[0,1800,60],[1800,0,1200],[60,1200,0]],30000);
    expect(plan.map(s=>s.id)).toEqual(['A','B']); expect(plan[1]?.arrivalSec).toBe(39600);
  });
  it('reports lateness rather than hiding an impossible appointment', () => {
    const plan=planAppointments([{id:'A',appointmentSec:32400,durationSec:1800}],[[0,3600],[3600,0]],32400);
    expect(plan[0]?.lateSec).toBe(3600);
  });
  it('respects opening and closing times', () => {
    const plan=planAppointments([{id:'A',appointmentSec:null,durationSec:1800,opensSec:36000,closesSec:36600}],[[0,60],[60,0]],32400);
    expect(plan[0]?.arrivalSec).toBe(36000); expect(plan[0]?.conflict).toBe(true);
  });
});
it('detects duplicate OSM identifiers or normalized name and address',()=>{
  expect(sameProspect({name:'Oficina A',address:'Rua São José 10'},{name:'OFICINA A',address:'Rua Sao Jose, 10'})).toBe(true);
  expect(sameProspect({name:'Oficina A',address:'Rua 10'},{name:'Oficina A',address:'Rua 20'})).toBe(false);
});