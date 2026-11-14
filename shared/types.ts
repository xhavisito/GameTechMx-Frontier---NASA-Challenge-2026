/** All monetary values are USD millions; mass kg, power W, capacity Wh/GB. */
export type LocalizedText = { es: string; en: string };
export type Difficulty = 'beginner' | 'intermediate' | 'expert';
export type GameMode = 'solo' | 'local' | 'online' | 'sandbox';
export type Objective = 'earth' | 'astronomy' | 'lunar' | 'communications' | 'education' | 'mars';
export type OrbitId = 'leo' | 'sso' | 'meo' | 'geo' | 'heo' | 'l2' | 'lunar' | 'mars';
export type Destination = 'LEO' | 'GTO' | 'TLI' | 'escape';
export type ComponentCategory = 'structure' | 'solar' | 'rtg' | 'battery' | 'communications' | 'computer' | 'storage' | 'attitude' | 'propulsion' | 'thermal';
export interface Scenario {
  id: string; name: LocalizedText; description: LocalizedText; objective: Objective;
  budgetM: number; validOrbitIds: OrbitId[]; minCoverage: number; maxResolutionM: number;
  minDurationDays: number; minDataGB: number; maxDevelopmentMonths: number;
  recommendedInstrumentIds: string[]; icon: string;
}
export interface Orbit {
  id: OrbitId; name: LocalizedText; description: LocalizedText; altitudeKm: number;
  periodHours: number; coverage: number; contactMinutesPerDay: number; radiation: number;
  decayDays: number; deltaV: number; eclipseFraction: number; solarFactor: number;
  linkFactor: number; destination: Destination;
}
export interface Launcher {
  id: string; name: LocalizedText; description: LocalizedText; costM: number;
  capacityKg: Partial<Record<Destination, number>>; reliability: number; orbitIds: OrbitId[];
}
export interface Component {
  id: string; category: ComponentCategory; tier: 'simple' | 'advanced';
  name: LocalizedText; description: LocalizedText; massKg: number; powerW: number;
  costM: number; reliability: number; trl: number;
  generationW?: number; batteryWh?: number; linkMbps?: number; storageGB?: number;
  pointing?: number; thermal?: number; deltaV?: number; capacityKg?: number;
}
export interface Instrument {
  id: string; name: LocalizedText; description: LocalizedText; massKg: number;
  powerW: number; costM: number; dataGBPerDay: number; resolutionM: number;
  science: Partial<Record<Objective, number>>; orbitIds: OrbitId[];
  pointing: number; thermal: number; reliability: number; trl: number;
}
export interface GroundStation {
  id: string; name: LocalizedText; description: LocalizedText; contactMultiplier: number;
  operationsCostMPerDay: number; setupCostM: number;
}
export interface CollaborationEvidence {
  participants: number; proposals: number; resolvedConflicts: number;
  approvedChanges: number; roleBalance: number;
}
export interface MissionDesign {
  version: 1; name: string; scenarioId: string; orbitId: OrbitId;
  launcherId: string; instrumentIds: string[]; componentIds: string[];
  groundStationId: string; durationDays: number; developmentMonths: number;
  difficulty: Difficulty; mode: GameMode;
  /** Event ID -> selected response ID. Unknown IDs are ignored by the engine. */
  responses: Record<string, string>;
  collaboration?: CollaborationEvidence;
}
export type IssueSeverity = 'error' | 'warning' | 'info';
export interface Issue {
  code: string; severity: IssueSeverity; message: LocalizedText; suggestion: LocalizedText;
  resource: 'mass' | 'power' | 'budget' | 'data' | 'storage' | 'time' | 'science' | 'orbit' | 'reliability';
}
export interface ResourceBudget {
  massKg: number; launchCapacityKg: number; structureCapacityKg: number;
  generationW: number; averageGenerationW: number; consumptionW: number; safeModeW: number;
  eclipseHours: number; eclipseNeedWh: number; batteryWh: number;
  developmentCostM: number; launchCostM: number; operationsCostM: number;
  totalCostM: number; budgetM: number; budgetMarginM: number;
  generatedGBPerDay: number; downlinkGBPerDay: number; storageGB: number;
  storageMarginGB: number; contactMinutesPerDay: number; linkMbps: number;
  developmentMonths: number; durationDays: number; reliability: number;
  coverage: number; resolutionM: number; sciencePerDay: number; deltaV: number;
  pointing: number; thermal: number; powerRatio: number; dataRatio: number;
}
export type EventType = 'solar-storm' | 'wheel-failure' | 'budget-cut' | 'launch-delay' | 'debris' | 'battery-degradation';
export interface EventChoice {
  id: string; label: LocalizedText; description: LocalizedText;
  /** Educational effect applied once, at this event. */
  costM: number; lostDays: number; healthDelta: number; powerMultiplier: number; scienceMultiplier: number;
}
export interface MissionEvent {
  id: string; type: EventType; day: number; title: LocalizedText; description: LocalizedText;
  choices: EventChoice[]; selectedChoiceId: string; responded: boolean; consequence: LocalizedText;
}
export type MissionPhase = 'launch' | 'insertion' | 'operations' | 'end-of-life';
export interface TimelineDay {
  day: number; phase: MissionPhase; health: number; energyMarginW: number;
  batteryWh: number; storedGB: number; generatedGB: number; downlinkedGB: number;
  lostGB: number; science: number; cumulativeScience: number; cumulativeDataGB: number;
  spentM: number; operating: boolean;
}
export interface MissionTimeline {
  version: 1; design: MissionDesign; seed: string; resources: ResourceBudget; issues: Issue[];
  events: MissionEvent[]; days: TimelineDay[];
  phases: { phase: MissionPhase; day: number; success: boolean; description: LocalizedText }[];
  launched: boolean; success: boolean; completedDays: number; totalDataGB: number;
  totalScience: number; lostDataGB: number; finalHealth: number; finalCostM: number;
  requirementResults: { id: string; label: LocalizedText; passed: boolean; actual: number; required: number }[];
}
export interface ScoreBreakdown {
  total: number; objective: number; science: number; efficiency: number; robustness: number;
  collaboration: number; max: { objective: number; science: number; efficiency: number; robustness: number; collaboration: number };
  grade: 'S' | 'A' | 'B' | 'C' | 'D';
  explanations: { category: string; text: LocalizedText }[];
}
export interface MissionReport {
  title: LocalizedText; summary: LocalizedText; strengths: LocalizedText[];
  failures: LocalizedText[]; suggestions: LocalizedText[]; score: ScoreBreakdown;
  seed: string; success: boolean;
}
