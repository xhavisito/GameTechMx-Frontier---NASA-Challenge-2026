import { describe, expect, it } from 'vitest';
import { DEST, ROCKETS, TOOLS } from './design';
import { GROUPS, SOURCES, isNasaUrl } from './sources';

describe('Ciencia y fuentes', () => {
  it('ids are unique and every group is used', () => {
    expect(new Set(SOURCES.map(s => s.id)).size).toBe(SOURCES.length);
    for (const g of GROUPS) expect(SOURCES.some(s => s.group === g.id)).toBe(true);
  });
  it('every entry has the four fields in both languages', () => {
    for (const s of SOURCES) for (const l of [s.name, s.fact, s.screen, s.simplification]) {
      expect(l.es.trim().length, s.id).toBeGreaterThan(10);
      expect(l.en.trim().length, s.id).toBeGreaterThan(10);
    }
  });
  it('NASA-backed entries link only to https nasa.gov pages', () => {
    for (const s of SOURCES) {
      if (s.backing === 'nasa' || s.backing === 'mixed') expect(s.links.length, s.id).toBeGreaterThan(0);
      for (const l of s.links) { expect(isNasaUrl(l.url), `${s.id} ${l.url}`).toBe(true); expect(l.title.length).toBeGreaterThan(3); }
    }
  });
  it('anything without full NASA backing lists its game parameters', () => {
    for (const s of SOURCES) if (s.backing !== 'nasa') {
      expect(s.params.length, s.id).toBeGreaterThan(0);
      for (const p of s.params) { expect(p.es.length).toBeGreaterThan(5); expect(p.en.length).toBeGreaterThan(5); }
    }
  });
  it('fiction and pure game entries carry no NASA claim', () => {
    for (const s of SOURCES) if (s.backing === 'fiction' || s.backing === 'game') {
      if (s.backing === 'fiction') expect(s.links).toHaveLength(0);
    }
    expect(SOURCES.find(s => s.id === 'miller')!.backing).toBe('fiction');
  });
  it('parameters follow the real constants in design.ts', () => {
    const all = SOURCES.flatMap(s => s.params.map(p => p.en)).join(' | ');
    for (const r of Object.values(ROCKETS)) expect(all).toContain(`${r.dry}/${r.prop}/${r.maxPayload} kg/${r.cost}`);
    for (const t of Object.values(TOOLS)) expect(all).toContain(`${t.mass} kg, ${t.watts} W, cost ${t.cost}`);
    for (const d of Object.values(DEST)) expect(all).toContain(`${d.dv}`);
  });
  it('rejects non-NASA hosts', () => {
    expect(isNasaUrl('https://evil.com/nasa.gov')).toBe(false);
    expect(isNasaUrl('http://www.nasa.gov/x')).toBe(false);
    expect(isNasaUrl('https://notnasa.gov/x')).toBe(false);
  });
});
