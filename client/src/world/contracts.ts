import type { Dest, Tool } from './design';
import type { Level } from './levels';
import { LEVELS } from './levels';

export type ContractKind = 'collect' | 'beacons' | 'rescue' | 'photo';
export interface Contract { id: string; world: Dest; kind: ContractKind; es: string; en: string; descEs: string; descEn: string; n: number; reward: number; tool?: Tool; danger: number }
const C = (id: string, world: Dest, kind: ContractKind, es: string, en: string, descEs: string, descEn: string, n: number, reward: number, danger: number, tool?: Tool): Contract => ({ id, world, kind, es, en, descEs, descEn, n, reward, danger, tool });

export const CONTRACTS: Contract[] = [
  C('m_collect', 'mars', 'collect', 'Recolectar muestras', 'Collect samples', 'Junta muestras y regresa al módulo.', 'Gather samples and return to the lander.', 3, 1, 1),
  C('m_photo', 'mars', 'photo', 'Fotografiar formaciones', 'Photograph formations', 'Necesitas cámara. Acércate a cada formación rocosa, apunta el rover hacia ella hasta encuadrarla en el visor y toma la foto con E.', 'Needs a camera. Get close to each rock formation, point the rover until it is framed in the viewfinder and shoot with E.', 3, 1.3, 1.1, 'camera'),
  C('m_beacons', 'mars', 'beacons', 'Reparar antenas', 'Repair antennas', 'Mantén E junto a cada antena averiada mientras los bichos te rondan.', 'Hold E next to each broken antenna while bugs close in.', 3, 1.25, 1.25),
  C('m_rescue', 'mars', 'rescue', 'Rescatar la sonda', 'Rescue the probe', 'Recoge la sonda varada y llévala al módulo. Vas más lento con ella.', 'Pick up the stranded probe and bring it to the lander. You are slower while carrying it.', 1, 1.4, 1.3),
  C('j_collect', 'jupiter', 'collect', 'Escanear zonas', 'Scan zones', 'Escanea zonas de la atmósfera para armar el mapa.', 'Scan atmosphere zones to build the map.', 3, 1, 1),
  C('j_beacons', 'jupiter', 'beacons', 'Instalar boyas', 'Deploy buoys', 'Mantén E junto a cada boya de medición. La radiación no espera.', 'Hold E next to each measuring buoy. Radiation will not wait.', 3, 1.25, 1.25),
  C('j_rescue', 'jupiter', 'rescue', 'Recuperar el satélite', 'Recover the satellite', 'Recoge el satélite a la deriva y llévalo a la estación.', 'Pick up the drifting satellite and take it to the station.', 1, 1.4, 1.3),
  C('s_collect', 'miller', 'collect', 'Buscar vida', 'Look for life', 'Encuentra señales de vida bajo el océano.', 'Find signs of life under the ocean.', 3, 1, 1),
  C('s_beacons', 'miller', 'beacons', 'Reparar el cable', 'Repair the cable', 'Mantén E junto a cada nodo averiado del fondo marino.', 'Hold E next to each broken seabed node.', 3, 1.25, 1.25),
  C('s_rescue', 'miller', 'rescue', 'Recuperar la cápsula', 'Recover the capsule', 'Sube la cápsula perdida hasta la boya de la superficie.', 'Bring the lost capsule up to the surface buoy.', 1, 1.4, 1.3),
];
export const contractById = (id: string) => CONTRACTS.find(c => c.id === id);
export const defaultContract = (w: Dest) => CONTRACTS.find(c => c.world === w && c.kind === 'collect')!;
/** More choices as the level goes up: this is where decisions start to matter. */
export function contractsFor(world: Dest, level: Level): Contract[] {
  const all = CONTRACTS.filter(c => c.world === world), k = [1, 2, 3, 4][LEVELS.indexOf(level)]!;
  return all.slice(0, Math.min(all.length, k + (level === 'easy' ? 1 : 0)));
}
export const contractN = (c: Contract, required: number) => (c.kind === 'collect' ? required : c.kind === 'rescue' ? 1 : Math.min(c.n + (required >= 5 ? 1 : 0), 4));
