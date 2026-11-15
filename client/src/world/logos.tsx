/** The two project logos. They are dark-on-light, so they always sit on a white card. */
const base = import.meta.env.BASE_URL;
export function FrontierLogo({ height = 96 }: { height?: number }) {
  return <span className="logo-card"><img src={`${base}logos/frontier.png`} alt="Frontier Mission Architect" height={height} style={{ height }} /></span>;
}
export function GameTechLogo({ height = 44 }: { height?: number }) {
  return <span className="logo-card sm"><img src={`${base}logos/gametechmx.png`} alt="Game Tech México" height={height} style={{ height }} /></span>;
}
