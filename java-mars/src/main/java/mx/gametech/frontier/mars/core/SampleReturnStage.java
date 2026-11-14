package mx.gametech.frontier.mars.core;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;

/**
 * Stage 2 — the MAV launches the sealed samples into Mars orbit. The student remotely
 * pilots the spacecraft they designed to catch the canister and fly it out through the
 * return corridor, dodging asteroids. Commands arrive with the signal delay of the
 * chosen antenna, and thrust spends the fuel bought with the design's Δv.
 */
public final class SampleReturnStage {
    public enum Status { FLYING, COMPLETE, FAILED }

    public static final class Rock {
        public double x, y, vx, vy, r, spin, angle;
        Rock(double x, double y, double vx, double vy, double r, double spin) { this.x = x; this.y = y; this.vx = vx; this.vy = vy; this.r = r; this.spin = spin; }
    }

    private static final class Command {
        final double at; final double ax, ay; final boolean boost;
        Command(double at, double ax, double ay, boolean boost) { this.at = at; this.ax = ax; this.ay = ay; this.boost = boost; }
    }

    public static final double W = 960, H = 540;
    public static final double CAPTURE_RANGE = 34, GATE_X = W - 40, GATE_Y = H / 2, GATE_H = 150;
    static final double THRUST = 260, BOOST = 1.7, DRAG = 0.35, MAX_SPEED = 300, SHIP_R = 16;

    public final MissionConfig config;
    public final double delay;
    public final List<Rock> rocks = new ArrayList<>();
    private final ArrayDeque<Command> queue = new ArrayDeque<>();
    private final Rng rng;
    public double x = 110, y = H / 2, vx, vy, angle;
    public double fuel, maxFuel, hull;
    public double canX = W * 0.55, canY = H + 30, canVx = 0, canVy = -95;
    public boolean captured;
    public double time, spawn, hitFlash, thrusting;
    /** Latest command actually executed by the spacecraft (after the delay). */
    public double execAx, execAy;
    public Status status = Status.FLYING;
    public String message = "";
    public double messageTime;
    public int hits;

    public SampleReturnStage(MissionConfig config, double hull) {
        this.config = config;
        this.delay = config.signalDelay();
        this.rng = new Rng(config.seed + ":return");
        maxFuel = fuel = config.fuel();
        this.hull = Math.max(0.3, hull);
        for (int i = 0; i < 6; i++) spawnRock(rng.range(W * 0.3, W));
        say("Retraso de señal: " + fmt(delay) + " s. Anticipa tus maniobras.", "Signal delay: " + fmt(delay) + " s. Anticipate your manoeuvres.");
    }

    static String fmt(double v) { return String.valueOf(Math.round(v * 100) / 100.0); }

    private void say(String es, String en) { message = config.es() ? es : en; messageTime = 3.5; }

    private void spawnRock(double startX) {
        double r = rng.range(12, 34);
        double speed = rng.range(70, 170) * ("expert".equals(config.difficulty) ? 1.3 : "intermediate".equals(config.difficulty) ? 1.12 : 1);
        rocks.add(new Rock(startX, rng.range(20, H - 20), -speed, rng.range(-30, 30), r, rng.range(-2, 2)));
    }

    public void update(double dt, Input in) {
        if (status != Status.FLYING) return;
        time += dt;
        messageTime = Math.max(0, messageTime - dt);
        hitFlash = Math.max(0, hitFlash - dt);

        // Ground → spacecraft link: commands execute `delay` seconds after they are sent.
        queue.addLast(new Command(time, in.ax, in.ay, in.action));
        Command current = null;
        while (!queue.isEmpty() && queue.peekFirst().at <= time - delay) current = queue.pollFirst();
        if (current != null) { execAx = current.ax; execAy = current.ay; thrusting = current.boost ? 1 : 0; }

        double mag = Math.min(1, Math.hypot(execAx, execAy));
        if (mag > 0.1 && fuel > 0) {
            double power = THRUST * (thrusting > 0 ? BOOST : 1);
            vx += execAx / Math.max(mag, 1) * power * dt;
            vy += execAy / Math.max(mag, 1) * power * dt;
            fuel = Math.max(0, fuel - mag * (thrusting > 0 ? 14 : 7) * dt);
            angle = Math.atan2(execAy, execAx);
            if (fuel == 0) say("¡Sin combustible! Ahora solo flotas.", "Out of fuel! You are drifting.");
        }
        vx -= vx * DRAG * dt; vy -= vy * DRAG * dt;
        double sp = Math.hypot(vx, vy);
        if (sp > MAX_SPEED) { vx *= MAX_SPEED / sp; vy *= MAX_SPEED / sp; }
        x += vx * dt; y += vy * dt;
        if (x < SHIP_R) { x = SHIP_R; vx = Math.abs(vx) * 0.4; }
        if (y < SHIP_R) { y = SHIP_R; vy = Math.abs(vy) * 0.4; }
        if (y > H - SHIP_R) { y = H - SHIP_R; vy = -Math.abs(vy) * 0.4; }
        if (x > W - SHIP_R && !captured) { x = W - SHIP_R; vx = -Math.abs(vx) * 0.4; }

        // Canister: launched from the surface, then coasts on a slow loop until caught.
        if (!captured) {
            canX += canVx * dt; canY += canVy * dt;
            if (canY < H * 0.5) { canVy += 40 * dt; canVx = 35 * Math.sin(time * 0.6); }
            if (canY > H * 0.8 && canVy > 0) canVy = -60;
            if (Math.hypot(canX - x, canY - y) < CAPTURE_RANGE) {
                captured = true;
                say("¡Contenedor capturado! Vuela al corredor de regreso →", "Canister captured! Fly to the return corridor →");
            }
        } else {
            canX = x - Math.cos(angle) * 22; canY = y - Math.sin(angle) * 22;
            if (x > GATE_X - 10 && Math.abs(y - GATE_Y) < GATE_H / 2) { status = Status.COMPLETE; say("Rumbo a la Tierra con las muestras.", "Heading to Earth with the samples."); return; }
        }

        // Asteroids.
        spawn -= dt;
        double rate = "expert".equals(config.difficulty) ? 0.75 : "intermediate".equals(config.difficulty) ? 0.95 : 1.2;
        if (spawn <= 0) { spawnRock(W + 40); spawn = rate; }
        for (int i = rocks.size() - 1; i >= 0; i--) {
            Rock r = rocks.get(i);
            r.x += r.vx * dt; r.y += r.vy * dt; r.angle += r.spin * dt;
            if (r.y < r.r || r.y > H - r.r) r.vy = -r.vy;
            if (r.x < -60) { rocks.remove(i); continue; }
            if (hitFlash == 0 && Math.hypot(r.x - x, r.y - y) < r.r + SHIP_R) {
                hull = Math.max(0, hull - 0.18 - r.r / 200);
                hits++;
                hitFlash = 1.0;
                double d = Math.max(1e-6, Math.hypot(x - r.x, y - r.y));
                vx += (x - r.x) / d * 180; vy += (y - r.y) / d * 180;
                say("¡Impacto de asteroide!", "Asteroid impact!");
            }
        }

        if (hull <= 0) { status = Status.FAILED; say("La nave quedó destruida.", "The spacecraft was destroyed."); }
        else if (time > 120) { status = Status.FAILED; say("Se cerró la ventana de regreso.", "The return window closed."); }
    }
}
