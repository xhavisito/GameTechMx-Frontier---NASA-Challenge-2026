package mx.gametech.frontier.mars.core;

import java.util.ArrayList;
import java.util.List;

/**
 * Stage 1 — drive the rover across Jezero-like terrain, scan rocks, drill samples
 * and bring them back to the Mars Ascent Vehicle (MAV) before the battery runs out.
 */
public final class RoverStage {
    public enum Status { DRIVING, COMPLETE, FAILED }

    /** Educational mineral catalogue (simplified). */
    public enum Mineral {
        BASALT("Basalto volcánico", "Volcanic basalt", 10, "#6b5a55"),
        HEMATITE("Hematita (óxido de hierro)", "Hematite (iron oxide)", 18, "#a8442c"),
        CLAY("Arcillas: rastro de agua antigua", "Clays: trace of ancient water", 30, "#c2a07a"),
        SULFATE("Sulfatos de lagos evaporados", "Sulfates from dried lakes", 24, "#e3d28c"),
        ICE("Hielo de agua enterrado", "Buried water ice", 45, "#bfe8ff");

        public final String es, en, color;
        public final int science;
        Mineral(String es, String en, int science, String color) { this.es = es; this.en = en; this.science = science; this.color = color; }
    }

    public static final class Site {
        public final double x, y;
        public final Mineral mineral;
        /** Ice is buried: only a ground-penetrating radar can reveal it. */
        public final boolean buried;
        public boolean scanned, collected, revealed;
        Site(double x, double y, Mineral m, boolean buried) { this.x = x; this.y = y; this.mineral = m; this.buried = buried; this.revealed = !buried; }
    }

    public static final class Obstacle {
        public final double x, y, r;
        /** Rocks block and damage, craters and dunes only slow the rover. */
        public final boolean solid;
        public final double slow;
        Obstacle(double x, double y, double r, boolean solid, double slow) { this.x = x; this.y = y; this.r = r; this.solid = solid; this.slow = slow; }
    }

    public static final double WORLD_W = 2400, WORLD_H = 1600;
    public static final double SCAN_RANGE = 110, DRILL_RANGE = 42, MAV_RANGE = 70;
    public static final double DRILL_TIME = 1.6;
    public static final int MAX_SAMPLES = 3;
    static final double MAX_SPEED = 170, TURN_RATE = 3.2;

    public final MissionConfig config;
    public final List<Site> sites = new ArrayList<>();
    public final List<Obstacle> obstacles = new ArrayList<>();
    public final List<Mineral> carried = new ArrayList<>();
    public final double mavX, mavY;
    public double x, y, heading, speed;
    public double energy, maxEnergy, hull = 1;
    public double drill;          // drilling progress 0..DRILL_TIME
    public double time;
    public double dustStorm;      // 0..1 intensity, reduces solar recharge and visibility
    public Status status = Status.DRIVING;
    public String message = "";
    public double messageTime;
    private final double stormStart, stormEnd;

    public RoverStage(MissionConfig config) {
        this.config = config;
        Rng rng = new Rng(config.seed + ":rover");
        mavX = 360; mavY = WORLD_H / 2;
        x = mavX + 90; y = mavY; heading = 0;
        maxEnergy = energy = config.roverEnergy();
        hull = Math.max(0.35, config.health);
        stormStart = 35 + rng.range(0, 25);
        stormEnd = stormStart + 18;

        Mineral[] surface = { Mineral.BASALT, Mineral.HEMATITE, Mineral.CLAY, Mineral.SULFATE };
        for (int i = 0; i < surface.length; i++) {
            double sx = 820 + i * 380 + rng.range(-90, 90);
            double sy = 260 + rng.range(0, WORLD_H - 520);
            sites.add(new Site(sx, sy, surface[i], false));
        }
        sites.add(new Site(1500 + rng.range(-200, 300), rng.next() < 0.5 ? 300 : WORLD_H - 300, Mineral.ICE, true));
        if (config.radar) for (Site s : sites) s.revealed = true;

        for (int i = 0; i < 70; i++) {
            double ox = rng.range(0, WORLD_W), oy = rng.range(0, WORLD_H);
            if (Math.hypot(ox - mavX, oy - mavY) < 240) continue;
            boolean nearSite = false;
            for (Site s : sites) if (Math.hypot(ox - s.x, oy - s.y) < 90) nearSite = true;
            if (nearSite) continue;
            double kind = rng.next();
            if (kind < 0.55) obstacles.add(new Obstacle(ox, oy, rng.range(14, 34), true, 1));
            else if (kind < 0.85) obstacles.add(new Obstacle(ox, oy, rng.range(50, 110), false, 0.45));
            else obstacles.add(new Obstacle(ox, oy, rng.range(70, 140), false, 0.65));
        }
    }

    public boolean es() { return config.es(); }

    private void say(String es, String en) { message = es() ? es : en; messageTime = 3.2; }

    public Site nearestSite() {
        Site best = null; double bd = Double.MAX_VALUE;
        for (Site s : sites) {
            if (s.collected || !s.revealed) continue;
            double d = Math.hypot(s.x - x, s.y - y);
            if (d < bd) { bd = d; best = s; }
        }
        return best;
    }

    public double distanceToMav() { return Math.hypot(mavX - x, mavY - y); }

    public void update(double dt, Input in) {
        if (status != Status.DRIVING) return;
        time += dt;
        messageTime = Math.max(0, messageTime - dt);
        dustStorm = time > stormStart && time < stormEnd ? Math.min(1, Math.min(time - stormStart, stormEnd - time) / 3) : 0;
        if (time > stormStart && time < stormStart + dt * 1.5) say("Tormenta de polvo: menos energía solar y visibilidad.", "Dust storm: less solar power and visibility.");

        // Steering: the rover turns toward the stick / arrow direction and throttles by its length.
        double mag = in.magnitude();
        double terrainFactor = 1;
        for (Obstacle o : obstacles) if (!o.solid && Math.hypot(o.x - x, o.y - y) < o.r) terrainFactor = Math.min(terrainFactor, o.slow);
        boolean drilling = in.action && nearestDrillable() != null && carried.size() < MAX_SAMPLES;
        if (mag > 0.15 && energy > 0 && !drilling) {
            double target = Math.atan2(in.ay, in.ax);
            double diff = Math.atan2(Math.sin(target - heading), Math.cos(target - heading));
            heading += Math.max(-TURN_RATE * dt, Math.min(TURN_RATE * dt, diff));
            double align = Math.max(0, Math.cos(diff));
            speed += (MAX_SPEED * mag * align * terrainFactor - speed) * Math.min(1, dt * 3);
        } else {
            speed += (0 - speed) * Math.min(1, dt * 5);
        }

        double nx = x + Math.cos(heading) * speed * dt;
        double ny = y + Math.sin(heading) * speed * dt;
        for (Obstacle o : obstacles) {
            if (!o.solid) continue;
            double d = Math.hypot(nx - o.x, ny - o.y);
            if (d < o.r + 14) {
                if (speed > 60) { hull = Math.max(0, hull - 0.06 * speed / MAX_SPEED); say("¡Choque con una roca! Daño en las ruedas.", "Hit a rock! Wheel damage."); }
                double push = (o.r + 14 - d) + 1;
                nx += (nx - o.x) / Math.max(1e-6, d) * push;
                ny += (ny - o.y) / Math.max(1e-6, d) * push;
                speed *= -0.25;
            }
        }
        x = Math.max(20, Math.min(WORLD_W - 20, nx));
        y = Math.max(20, Math.min(WORLD_H - 20, ny));

        // Energy: driving and drilling cost, sunlight recharges a little (less in a dust storm).
        double use = 0.25 + Math.abs(speed) / MAX_SPEED * 1.0 + (drilling ? 2.4 : 0);
        double solar = config.solarW > 0 ? Math.min(0.6, config.solarW / 1800.0 * 0.6) * (1 - dustStorm * 0.85) : 0;
        energy = Math.max(0, Math.min(maxEnergy, energy - (use - solar) * dt));

        // Scanning with the spectrometer.
        if (in.actionPressed) {
            Site s = nearestSite();
            if (s != null && Math.hypot(s.x - x, s.y - y) < SCAN_RANGE && !s.scanned) {
                s.scanned = true;
                if (config.spectrometer) say("Espectrómetro: " + s.mineral.es, "Spectrometer: " + s.mineral.en);
                else say("Sin espectrómetro: composición desconocida.", "No spectrometer: composition unknown.");
            } else if (distanceToMav() < MAV_RANGE) {
                if (!carried.isEmpty()) { status = Status.COMPLETE; say("Muestras cargadas en el vehículo de ascenso.", "Samples loaded into the ascent vehicle."); return; }
                say("Necesitas al menos una muestra.", "You need at least one sample.");
            }
        }

        // Drilling: hold the action button next to a site.
        Site target = drilling ? nearestDrillable() : null;
        if (target != null) {
            drill += dt;
            if (drill >= DRILL_TIME) {
                target.collected = true;
                carried.add(target.mineral);
                drill = 0;
                say("Muestra sellada (" + carried.size() + "/" + MAX_SAMPLES + ").", "Sample sealed (" + carried.size() + "/" + MAX_SAMPLES + ").");
            }
        } else drill = 0;

        if (hull <= 0) { status = Status.FAILED; say("El rover quedó inmovilizado.", "The rover is immobilised."); }
        else if (energy <= 0 && distanceToMav() > MAV_RANGE) { status = Status.FAILED; say("Batería agotada lejos del vehículo de ascenso.", "Battery depleted far from the ascent vehicle."); }
    }

    Site nearestDrillable() {
        for (Site s : sites) if (!s.collected && s.revealed && Math.hypot(s.x - x, s.y - y) < DRILL_RANGE) return s;
        return null;
    }

    public int science() {
        int total = 0;
        for (Mineral m : carried) total += config.spectrometer ? m.science : m.science / 2;
        return total;
    }
}
