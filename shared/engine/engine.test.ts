import { describe, expect, it } from 'vitest';
import { createDefaultDesign, generateReport, scoreMission, scenarios, simulateMission, validateDesign } from '../index.js';

describe('mission engine', () => {
  it('produces identical timelines for identical seeds', () => {
    const design = createDefaultDesign();
    expect(simulateMission(design, 'same-seed')).toEqual(simulateMission(design, 'same-seed'));
    expect(simulateMission(design, 'same-seed').events).not.toEqual(simulateMission(design, 'another-seed').events);
  });

  it('explains an impossible mass and launcher combination', () => {
    const design = createDefaultDesign('mars', 'expert');
    design.launcherId = 'rideshare';
    const issues = validateDesign(design);
    expect(issues.some(issue => issue.code === 'launcher-orbit' || issue.code === 'launch-mass')).toBe(true);
    expect(issues.every(issue => issue.message.es && issue.message.en && issue.suggestion.es && issue.suggestion.en)).toBe(true);
  });

  it('keeps every score category within its documented maximum', () => {
    const design = createDefaultDesign();
    const timeline = simulateMission(design, 2026);
    const score = scoreMission(timeline, scenarios.find(item => item.id === design.scenarioId)!);
    expect(score.total).toBeGreaterThanOrEqual(0);
    expect(score.total).toBeLessThanOrEqual(100);
    for (const category of ['objective', 'science', 'efficiency', 'robustness', 'collaboration'] as const) {
      expect(score[category]).toBeLessThanOrEqual(score.max[category]);
    }
  });

  it('changes consequences when a player responds while preserving event identity', () => {
    const design = createDefaultDesign();
    const first = simulateMission(design, 'response-test');
    const event = first.events[0]!;
    const alternative = event.choices.find(choice => choice.id !== event.selectedChoiceId)!;
    const changed = simulateMission({ ...design, responses: { [event.id]: alternative.id } }, 'response-test');
    expect(changed.events[0]!.id).toBe(event.id);
    expect(changed.events[0]!.selectedChoiceId).toBe(alternative.id);
    expect(changed.events[0]!.responded).toBe(true);
  });

  it('generates a causal bilingual report', () => {
    const design = createDefaultDesign();
    const timeline = simulateMission(design, 'report');
    const score = scoreMission(timeline, scenarios.find(item => item.id === design.scenarioId)!);
    const report = generateReport(timeline, score);
    expect(report.summary.es.length).toBeGreaterThan(20);
    expect(report.summary.en.length).toBeGreaterThan(20);
    expect(report.strengths.length + report.failures.length).toBeGreaterThan(0);
    expect(report.suggestions.length).toBeGreaterThan(0);
  });
});
