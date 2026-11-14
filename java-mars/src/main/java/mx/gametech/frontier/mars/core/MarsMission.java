package mx.gametech.frontier.mars.core;

import java.util.ArrayList;
import java.util.List;

/**
 * Mars surface mission: briefing → rover → ascent → sample return → results.
 * Pure Java (no browser APIs): {@link #update} advances the game, {@link #render} draws it on any {@link Gfx}.
 */
public final class MarsMission {
    public enum Phase { BRIEFING, ROVER, ASCENT, RETURN, RESULTS }

    public static final double VIEW_W = 960, VIEW_H = 540;
    static final String SAND = "#b65f3c", SAND_DARK = "#8e4630", SAND_LIGHT = "#cf7a52", SPACE = "#05080f", CYAN = "#5be4e8", ORANGE = "#ff9f5b", RED = "#ff5d6e", GREEN = "#62dda5", WHITE = "#eef5fb", MUTED = "#a7b8c8";

    public final MissionConfig config;
    public Phase phase = Phase.BRIEFING;
    public RoverStage rover;
    public SampleReturnStage ret;
    public boolean paused;
    public double phaseTime;
    private double ascentTime;
    private Result result;
    /** Touch UI state, filled by the web layer so the virtual stick is drawn under the thumb. */
    public boolean touchUi;
    public double joyBaseX = 120, joyBaseY = VIEW_H - 120, joyKnobX = 120, joyKnobY = VIEW_H - 120;
    public boolean touchAction;
    private final double[][] specks, stars;

    public MarsMission(MissionConfig config) {
        this.config = config;
        this.rover = new RoverStage(config);
        Rng rng = new Rng(config.seed + ":decor");
        specks = new double[260][];
        for (int i = 0; i < specks.length; i++) specks[i] = new double[] { rng.range(0, RoverStage.WORLD_W), rng.range(0, RoverStage.WORLD_H), rng.range(1, 4), rng.next() };
        stars = new double[160][];
        for (int i = 0; i < stars.length; i++) stars[i] = new double[] { rng.range(0, VIEW_W), rng.range(0, VIEW_H), rng.range(0.5, 1.8), rng.range(20, 90) };
    }

    private String t(String es, String en) { return config.es() ? es : en; }

    public void update(double dt, Input in) {
        dt = Math.min(dt, 0.05);
        if (in.pausePressed && phase != Phase.RESULTS && phase != Phase.BRIEFING) paused = !paused;
        if (paused) { if (in.actionPressed) paused = false; return; }
        phaseTime += dt;
        switch (phase) {
            case BRIEFING:
                if (in.actionPressed && phaseTime > 0.3) go(Phase.ROVER);
                break;
            case ROVER:
                rover.update(dt, in);
                if (rover.status == RoverStage.Status.COMPLETE) { go(Phase.ASCENT); ascentTime = 0; }
                else if (rover.status == RoverStage.Status.FAILED && phaseTime > 0) { result = Result.of(this); go(Phase.RESULTS); }
                break;
            case ASCENT:
                ascentTime += dt;
                if (ascentTime > 3.2 || (in.actionPressed && ascentTime > 0.6)) { ret = new SampleReturnStage(config, rover.hull); go(Phase.RETURN); }
                break;
            case RETURN:
                ret.update(dt, in);
                if (ret.status != SampleReturnStage.Status.FLYING) { result = Result.of(this); go(Phase.RESULTS); }
                break;
            case RESULTS:
                break;
        }
    }

    private void go(Phase p) { phase = p; phaseTime = 0; }

    public boolean finished() { return phase == Phase.RESULTS; }

    /** On the results screen, the action button returns the player to mission control. */
    public boolean wantsExit(Input in) { return phase == Phase.RESULTS && in.actionPressed && phaseTime > 0.8; }

    public Result result() { return result; }

    // ── Results ───────────────────────────────────────────────────────────────
    public static final class Result {
        public int score, science;
        public boolean returned;
        public String grade;
        public final List<String> lines = new ArrayList<>();
        public final List<String> samples = new ArrayList<>();

        static Result of(MarsMission m) {
            Result r = new Result();
            RoverStage rv = m.rover;
            SampleReturnStage rs = m.ret;
            r.returned = rs != null && rs.status == SampleReturnStage.Status.COMPLETE;
            r.science = rv.science() + (r.returned ? 40 : 0);
            for (RoverStage.Mineral min : rv.carried) r.samples.add(m.config.spectrometer ? (m.config.es() ? min.es : min.en) : m.t("Muestra sin identificar", "Unidentified sample"));
            double fuelLeft = rs == null ? 0 : rs.fuel / rs.maxFuel;
            double hull = rs == null ? rv.hull : rs.hull;
            double raw = Math.min(60, rv.science() * 0.6) + (r.returned ? 25 : 0) + fuelLeft * 8 + hull * 7;
            if (!r.returned && rv.carried.isEmpty()) raw = Math.min(raw, 15);
            r.score = (int) Math.max(0, Math.min(100, Math.round(raw)));
            r.grade = r.score >= 90 ? "S" : r.score >= 75 ? "A" : r.score >= 60 ? "B" : r.score >= 40 ? "C" : "D";
            MissionConfig c = m.config;
            boolean hasIce = false;
            for (RoverStage.Mineral min : rv.carried) if (min == RoverStage.Mineral.ICE) hasIce = true;
            r.lines.add(c.radar ? (hasIce ? m.t("Tu radar de subsuelo reveló y recuperaste hielo de agua: clave para futuras misiones tripuladas.", "Your subsurface radar revealed water ice and you recovered it: key for future crewed missions.")
                                          : m.t("Tu radar reveló hielo enterrado, pero no lo recolectaste.", "Your radar revealed buried ice, but you did not collect it."))
                                : m.t("Sin radar de subsuelo el hielo enterrado quedó invisible.", "Without a subsurface radar the buried ice stayed invisible."));
            r.lines.add(c.spectrometer ? m.t("El espectrómetro identificó cada muestra: ciencia completa.", "The spectrometer identified every sample: full science.")
                                       : m.t("Sin espectrómetro las muestras valen la mitad de ciencia.", "Without a spectrometer samples are worth half the science."));
            r.lines.add(m.t("Batería de " + Math.round(c.batteryWh) + " Wh: energía del rover.", Math.round(c.batteryWh) + " Wh battery: rover energy."));
            r.lines.add(m.t("Antena " + c.comm.toUpperCase() + ": retraso de control de " + SampleReturnStage.fmt(c.signalDelay()) + " s (en Marte real son de 4 a 24 minutos).",
                            c.comm.toUpperCase() + " antenna: " + SampleReturnStage.fmt(c.signalDelay()) + " s control delay (real Mars delays are 4–24 minutes)."));
            if (rs != null) r.lines.add(m.t("Δv de " + Math.round(c.deltaV) + " m/s → " + Math.round(rs.maxFuel) + " unidades de combustible; te quedó " + Math.round(fuelLeft * 100) + " %.",
                                            Math.round(c.deltaV) + " m/s of Δv → " + Math.round(rs.maxFuel) + " fuel units; " + Math.round(fuelLeft * 100) + "% left."));
            return r;
        }

        /** Compact payload for the web game: key=value;key=value */
        public String encode() {
            return "score=" + score + ";science=" + science + ";returned=" + (returned ? 1 : 0) + ";grade=" + grade + ";samples=" + String.join("|", samples);
        }
    }

    // ── Rendering ─────────────────────────────────────────────────────────────
    public void render(Gfx g) {
        switch (phase) {
            case BRIEFING: renderBriefing(g); break;
            case ROVER: renderRover(g); break;
            case ASCENT: renderAscent(g); break;
            case RETURN: renderReturn(g); break;
            case RESULTS: renderResults(g); break;
        }
        if (touchUi && (phase == Phase.ROVER || phase == Phase.RETURN) && !paused) renderTouch(g);
        if (paused) renderPause(g);
    }

    private void panel(Gfx g, double x, double y, double w, double h) {
        g.alpha(0.82); g.fillRect(x, y, w, h, "#07101b"); g.alpha(1);
        g.strokeRect(x, y, w, h, "#2b4a63", 1);
    }

    private void bar(Gfx g, double x, double y, double w, String label, double value, String color) {
        g.text(label, x, y - 6, MUTED, 11, "left", true);
        g.fillRect(x, y, w, 8, "#22364a");
        g.fillRect(x, y, w * Math.max(0, Math.min(1, value)), 8, value < 0.25 ? RED : value < 0.5 ? ORANGE : color);
    }

    private void hint(Gfx g, String text) {
        g.alpha(0.85); g.fillRect(0, VIEW_H - 30, VIEW_W, 30, "#07101b"); g.alpha(1);
        g.text(text, VIEW_W / 2, VIEW_H - 10, MUTED, 12, "center", false);
    }

    private void renderBriefing(Gfx g) {
        g.clear(SPACE);
        for (double[] s : stars) g.fillCircle(s[0], s[1], s[2] * 0.7, "#9fb8cc");
        g.fillCircle(VIEW_W * 0.78, VIEW_H * 0.52, 190, SAND_DARK);
        g.fillCircle(VIEW_W * 0.78 - 18, VIEW_H * 0.52 - 18, 172, SAND);
        g.fillCircle(VIEW_W * 0.78 + 40, VIEW_H * 0.52 - 70, 26, SAND_DARK);
        g.fillCircle(VIEW_W * 0.78 - 70, VIEW_H * 0.52 + 50, 18, SAND_DARK);
        g.text(t("MISIÓN MARTE · OPERACIONES EN SUPERFICIE", "MARS MISSION · SURFACE OPERATIONS"), 50, 70, CYAN, 13, "left", true);
        g.text(t("Recupera muestras de Marte", "Bring back Mars samples"), 50, 115, WHITE, 34, "left", true);
        String[] steps = config.es()
            ? new String[] { "1. Conduce el rover, escanea rocas y perfora hasta 3 muestras.", "2. Regresa al vehículo de ascenso antes de agotar la batería.", "3. Pilota a distancia tu nave para atrapar el contenedor.", "4. Esquiva asteroides y sal por el corredor de regreso." }
            : new String[] { "1. Drive the rover, scan rocks and drill up to 3 samples.", "2. Return to the ascent vehicle before the battery runs out.", "3. Remotely pilot your spacecraft to catch the canister.", "4. Dodge asteroids and exit through the return corridor." };
        for (int i = 0; i < steps.length; i++) g.text(steps[i], 50, 170 + i * 30, WHITE, 16, "left", false);
        g.text(t("Tu nave aporta:", "Your spacecraft brings:"), 50, 315, MUTED, 13, "left", true);
        String[] kit = {
            t("Batería ", "Battery ") + Math.round(config.batteryWh) + " Wh",
            (config.spectrometer ? "✓ " : "✗ ") + t("Espectrómetro", "Spectrometer"),
            (config.camera ? "✓ " : "✗ ") + t("Cámara (más visibilidad)", "Camera (more visibility)"),
            (config.radar ? "✓ " : "✗ ") + t("Radar de subsuelo (hielo)", "Subsurface radar (ice)"),
            "Δv " + Math.round(config.deltaV) + " m/s · " + t("antena ", "antenna ") + config.comm.toUpperCase(),
        };
        for (int i = 0; i < kit.length; i++) g.text(kit[i], 50 + (i % 2) * 260, 345 + (i / 2) * 26, i == 0 || i == 4 ? CYAN : kit[i].startsWith("✓") ? GREEN : ORANGE, 14, "left", false);
        boolean blink = ((int) (phaseTime * 2)) % 2 == 0;
        g.text(t("Pulsa Espacio / A / ● para comenzar", "Press Space / A / ● to start"), 50, 470, blink ? WHITE : MUTED, 16, "left", true);
    }

    private void renderRover(Gfx g) {
        RoverStage r = rover;
        double camX = Math.max(VIEW_W / 2, Math.min(RoverStage.WORLD_W - VIEW_W / 2, r.x));
        double camY = Math.max(VIEW_H / 2, Math.min(RoverStage.WORLD_H - VIEW_H / 2, r.y));
        g.clear(SAND);
        g.save();
        g.translate(VIEW_W / 2 - camX, VIEW_H / 2 - camY);
        for (double[] s : specks) g.fillCircle(s[0], s[1], s[2], s[3] < 0.5 ? SAND_DARK : SAND_LIGHT);
        for (RoverStage.Obstacle o : r.obstacles) {
            if (o.solid) continue;
            if (o.slow < 0.5) { g.fillCircle(o.x, o.y, o.r, SAND_DARK); g.fillCircle(o.x + o.r * 0.12, o.y + o.r * 0.12, o.r * 0.82, "#9c5035"); g.strokeCircle(o.x, o.y, o.r, "#d98a62", 3); }
            else { g.alpha(0.6); g.fillCircle(o.x, o.y, o.r, SAND_LIGHT); g.alpha(1); }
        }
        for (RoverStage.Obstacle o : r.obstacles) {
            if (!o.solid) continue;
            double[] xs = new double[7], ys = new double[7];
            for (int i = 0; i < 7; i++) { double a = i * Math.PI * 2 / 7; double k = 0.75 + 0.25 * Math.sin(o.x * 0.1 + i * 1.7); xs[i] = o.x + Math.cos(a) * o.r * k; ys[i] = o.y + Math.sin(a) * o.r * k; }
            g.fillCircle(o.x + 5, o.y + 6, o.r * 0.95, "#6d3424");
            g.fillPoly(xs, ys, "#4a2c25");
        }
        // Sample sites.
        for (RoverStage.Site s : r.sites) {
            if (s.collected) { g.strokeCircle(s.x, s.y, 14, "#5a2a1c", 3); continue; }
            if (!s.revealed) continue;
            double pulse = 6 * Math.sin(phaseTime * 4);
            String col = s.scanned && config.spectrometer ? s.mineral.color : s.buried ? "#9fdcff" : "#ffd27a";
            g.alpha(0.35); g.fillCircle(s.x, s.y, 30 + pulse, col); g.alpha(1);
            g.fillCircle(s.x, s.y, 12, col);
            g.strokeCircle(s.x, s.y, 12, WHITE, 2);
            if (s.scanned) g.text(config.spectrometer ? (config.es() ? s.mineral.es : s.mineral.en) : "?", s.x, s.y - 26, WHITE, 12, "center", true);
            else g.text("?", s.x, s.y + 5, "#2a1408", 14, "center", true);
        }
        // Ascent vehicle.
        g.fillCircle(r.mavX, r.mavY, 44, "#7b3a26");
        g.strokeCircle(r.mavX, r.mavY, RoverStage.MAV_RANGE, r.carried.isEmpty() ? "#ffffff44" : GREEN, 2);
        g.fillRect(r.mavX - 9, r.mavY - 34, 18, 52, WHITE);
        g.fillPoly(new double[] { r.mavX - 9, r.mavX + 9, r.mavX }, new double[] { r.mavY - 34, r.mavY - 34, r.mavY - 54 }, "#d8dee5");
        g.text("MAV", r.mavX, r.mavY + 36, WHITE, 11, "center", true);
        // Rover.
        g.save();
        g.translate(r.x, r.y);
        g.rotate(r.heading);
        g.fillRect(-18, -15, 36, 30, "#e7ecef");
        for (int i = -1; i <= 1; i++) { g.fillRect(i * 13 - 5, -21, 10, 6, "#20262c"); g.fillRect(i * 13 - 5, 15, 10, 6, "#20262c"); }
        g.fillRect(-10, -10, 16, 20, "#244a78");
        g.fillCircle(12, 0, 5, "#59616b");
        g.line(12, 0, 22, 0, "#59616b", 2);
        if (r.drill > 0) g.strokeCircle(0, 0, 26, ORANGE, 3);
        g.restore();
        // Fog of war: what the cameras can see (less in a dust storm).
        double vis = config.visibility() * (1 - r.dustStorm * 0.4);
        g.alpha(0.55); g.strokeCircle(r.x, r.y, vis + 700, "#1d0d08", 1400); g.alpha(1);
        g.alpha(0.25); g.strokeCircle(r.x, r.y, vis + 25, "#1d0d08", 50); g.alpha(1);
        g.restore();
        if (r.dustStorm > 0) { g.alpha(r.dustStorm * 0.35); g.fillRect(0, 0, VIEW_W, VIEW_H, "#d9905e"); g.alpha(1); }

        // HUD.
        panel(g, 14, 14, 250, 92);
        bar(g, 28, 40, 220, t("ENERGÍA", "ENERGY"), r.energy / r.maxEnergy, GREEN);
        bar(g, 28, 72, 220, t("CHASIS", "HULL"), r.hull, GREEN);
        g.text(t("MUESTRAS ", "SAMPLES ") + r.carried.size() + "/" + RoverStage.MAX_SAMPLES, 28, 98, WHITE, 12, "left", true);
        for (int i = 0; i < r.carried.size(); i++) g.fillCircle(165 + i * 22, 94, 7, r.carried.get(i).color);
        // Minimap.
        double mw = 180, mh = 120, mx = VIEW_W - mw - 14, my = 14;
        panel(g, mx, my, mw, mh);
        double sx = mw / RoverStage.WORLD_W, sy = mh / RoverStage.WORLD_H;
        for (RoverStage.Site s : r.sites) if (s.revealed && !s.collected) g.fillCircle(mx + s.x * sx, my + s.y * sy, 3, s.buried ? "#9fdcff" : "#ffd27a");
        g.fillCircle(mx + r.mavX * sx, my + r.mavY * sy, 4, WHITE);
        g.fillCircle(mx + r.x * sx, my + r.y * sy, 4, CYAN);
        // Context prompt.
        RoverStage.Site near = r.nearestSite();
        String prompt;
        if (near != null && Math.hypot(near.x - r.x, near.y - r.y) < RoverStage.DRILL_RANGE && r.carried.size() < RoverStage.MAX_SAMPLES) prompt = t("Mantén Espacio / A / ● para perforar", "Hold Space / A / ● to drill");
        else if (near != null && !near.scanned && Math.hypot(near.x - r.x, near.y - r.y) < RoverStage.SCAN_RANGE) prompt = t("Pulsa Espacio / A / ● para escanear", "Press Space / A / ● to scan");
        else if (r.distanceToMav() < RoverStage.MAV_RANGE && !r.carried.isEmpty()) prompt = t("Pulsa Espacio / A / ● para cargar las muestras y despegar", "Press Space / A / ● to load samples and launch");
        else prompt = t("Mover: WASD / flechas / stick / joystick · Pausa: P / Start", "Move: WASD / arrows / stick / joystick · Pause: P / Start");
        hint(g, prompt);
        if (r.drill > 0) { g.fillRect(VIEW_W / 2 - 80, VIEW_H / 2 + 40, 160, 8, "#22364a"); g.fillRect(VIEW_W / 2 - 80, VIEW_H / 2 + 40, 160 * r.drill / RoverStage.DRILL_TIME, 8, ORANGE); }
        toast(g, r.message, r.messageTime);
    }

    private void toast(Gfx g, String msg, double time) {
        if (time <= 0 || msg.isEmpty()) return;
        g.alpha(Math.min(1, time));
        panel(g, VIEW_W / 2 - 250, 120, 500, 38);
        g.text(msg, VIEW_W / 2, 145, WHITE, 15, "center", true);
        g.alpha(1);
    }

    private void renderAscent(Gfx g) {
        g.clear("#2a1610");
        double k = Math.min(1, ascentTime / 3.2);
        g.fillRect(0, VIEW_H * 0.72, VIEW_W, VIEW_H * 0.28, SAND);
        double rx = VIEW_W / 2, ry = VIEW_H * 0.72 - 40 - k * k * 520;
        g.fillRect(rx - 10, ry - 40, 20, 60, WHITE);
        g.fillPoly(new double[] { rx - 10, rx + 10, rx }, new double[] { ry - 40, ry - 40, ry - 64 }, "#d8dee5");
        g.alpha(0.9); g.fillPoly(new double[] { rx - 9, rx + 9, rx }, new double[] { ry + 20, ry + 20, ry + 60 + 20 * Math.sin(ascentTime * 40) }, ORANGE); g.alpha(1);
        for (int i = 0; i < 14; i++) { g.alpha(Math.max(0, 0.5 - k * 0.4)); g.fillCircle(rx + Math.sin(i * 2.1) * (30 + k * 120), VIEW_H * 0.72 + Math.cos(i) * 10, 18 + i, "#c98a68"); }
        g.alpha(1);
        g.text(t("Despega el vehículo de ascenso con las muestras", "The ascent vehicle lifts off with the samples"), VIEW_W / 2, 70, WHITE, 22, "center", true);
        g.text(t("Prepárate para pilotar tu nave a distancia…", "Get ready to remotely pilot your spacecraft…"), VIEW_W / 2, 100, MUTED, 15, "center", false);
    }

    private void renderReturn(Gfx g) {
        SampleReturnStage s = ret;
        g.clear(SPACE);
        for (double[] st : stars) { double x = (st[0] - s.time * st[3] * 0.4) % VIEW_W; if (x < 0) x += VIEW_W; g.fillCircle(x, st[1], st[2], "#9fb8cc"); }
        g.fillCircle(VIEW_W * 0.45, VIEW_H + 520, 600, SAND_DARK);
        g.fillCircle(VIEW_W * 0.45, VIEW_H + 528, 592, SAND);
        // Return corridor.
        String gate = s.captured ? GREEN : "#3b5a73";
        g.line(SampleReturnStage.GATE_X, SampleReturnStage.GATE_Y - SampleReturnStage.GATE_H / 2, SampleReturnStage.GATE_X, SampleReturnStage.GATE_Y + SampleReturnStage.GATE_H / 2, gate, 4);
        g.text(t("REGRESO →", "RETURN →"), SampleReturnStage.GATE_X - 8, SampleReturnStage.GATE_Y - SampleReturnStage.GATE_H / 2 - 10, gate, 12, "right", true);
        // Canister.
        if (!s.captured) { g.alpha(0.3); g.fillCircle(s.canX, s.canY, 22 + 4 * Math.sin(s.time * 6), "#ffd27a"); g.alpha(1); }
        g.fillCircle(s.canX, s.canY, 8, "#ffd27a"); g.strokeCircle(s.canX, s.canY, 8, WHITE, 2);
        // Asteroids.
        for (SampleReturnStage.Rock r : s.rocks) {
            double[] xs = new double[8], ys = new double[8];
            for (int i = 0; i < 8; i++) { double a = r.angle + i * Math.PI / 4; double k = 0.78 + 0.22 * Math.sin(r.r * 3 + i * 2.3); xs[i] = r.x + Math.cos(a) * r.r * k; ys[i] = r.y + Math.sin(a) * r.r * k; }
            g.fillPoly(xs, ys, "#6f6a66");
            g.fillCircle(r.x - r.r * 0.25, r.y - r.r * 0.2, r.r * 0.22, "#57524f");
        }
        // Sent command (ghost) vs executed command: makes the signal delay visible.
        double sentLen = 40;
        if (Math.hypot(lastAx, lastAy) > 0.1) { g.alpha(0.35); g.line(s.x, s.y, s.x + lastAx * sentLen, s.y + lastAy * sentLen, CYAN, 2); g.alpha(1); }
        // Spacecraft.
        if (s.hitFlash > 0 && ((int) (s.hitFlash * 12)) % 2 == 0) g.alpha(0.4);
        g.save();
        g.translate(s.x, s.y);
        g.rotate(s.angle);
        boolean burning = Math.hypot(s.execAx, s.execAy) > 0.1 && s.fuel > 0;
        if (burning) g.fillPoly(new double[] { -14, -14, -26 - (s.thrusting > 0 ? 14 : 0) }, new double[] { -6, 6, 0 }, ORANGE);
        g.fillRect(-12, -9, 24, 18, "#d6a63a");
        g.fillRect(-6, -26, 12, 16, "#244a78"); g.fillRect(-6, 10, 12, 16, "#244a78");
        g.fillPoly(new double[] { 12, 12, 20 }, new double[] { -6, 6, 0 }, WHITE);
        g.restore();
        g.alpha(1);
        // HUD.
        panel(g, 14, 14, 270, 100);
        bar(g, 28, 40, 240, t("COMBUSTIBLE (Δv)", "FUEL (Δv)"), s.fuel / s.maxFuel, CYAN);
        bar(g, 28, 72, 240, t("CASCO", "HULL"), s.hull, GREEN);
        g.text(t("Retraso de señal ", "Signal delay ") + SampleReturnStage.fmt(s.delay) + " s · " + config.comm.toUpperCase(), 28, 102, ORANGE, 12, "left", true);
        g.text(Math.max(0, 120 - (int) s.time) + " s", VIEW_W - 24, 34, WHITE, 16, "right", true);
        hint(g, s.captured ? t("Lleva el contenedor al corredor de regreso (derecha)", "Take the canister to the return corridor (right)")
                           : t("Atrapa el contenedor dorado · Mantén Espacio / A / ● para impulso extra", "Catch the golden canister · Hold Space / A / ● for extra thrust"));
        toast(g, s.message, s.messageTime);
    }

    private double lastAx, lastAy;

    /** The web layer reports the raw (undelayed) command so the "ghost" arrow can show it. */
    public void setSentCommand(double ax, double ay) { lastAx = ax; lastAy = ay; }

    private void renderResults(Gfx g) {
        Result r = result;
        g.clear(SPACE);
        for (double[] s : stars) g.fillCircle(s[0], s[1], s[2] * 0.7, "#9fb8cc");
        g.text(t("INFORME DE SUPERFICIE · MARTE", "SURFACE REPORT · MARS"), 50, 60, CYAN, 13, "left", true);
        g.text(r.returned ? t("¡Muestras rumbo a la Tierra!", "Samples heading to Earth!") : t("La misión de retorno no se completó", "The return mission was not completed"), 50, 100, WHITE, 28, "left", true);
        g.fillCircle(VIEW_W - 130, 120, 70, r.returned ? "#0e3b2c" : "#3b1418");
        g.strokeCircle(VIEW_W - 130, 120, 70, r.returned ? GREEN : RED, 4);
        g.text(r.grade, VIEW_W - 130, 140, WHITE, 56, "center", true);
        g.text(r.score + " / 100", VIEW_W - 130, 220, MUTED, 14, "center", true);
        g.text(t("Muestras: ", "Samples: ") + (r.samples.isEmpty() ? "—" : String.join(", ", r.samples)), 50, 150, WHITE, 15, "left", false);
        g.text(t("Ciencia: ", "Science: ") + r.science, 50, 178, CYAN, 15, "left", true);
        g.text(t("Lo que tu diseño cambió:", "What your design changed:"), 50, 225, MUTED, 13, "left", true);
        for (int i = 0; i < r.lines.size(); i++) g.text("• " + r.lines.get(i), 50, 255 + i * 28, WHITE, 14, "left", false);
        boolean blink = ((int) (phaseTime * 2)) % 2 == 0;
        g.text(t("Pulsa Espacio / A / ● para volver al control de misión", "Press Space / A / ● to return to mission control"), 50, 480, blink ? WHITE : MUTED, 15, "left", true);
    }

    private void renderPause(Gfx g) {
        g.alpha(0.75); g.fillRect(0, 0, VIEW_W, VIEW_H, "#03070d"); g.alpha(1);
        g.text(t("PAUSA", "PAUSED"), VIEW_W / 2, 150, WHITE, 36, "center", true);
        String[] rows = config.es()
            ? new String[] { "Mover: WASD / flechas · stick izquierdo · joystick táctil", "Acción (escanear, perforar, impulso): Espacio / Enter · botón A · botón ●", "Pausa: P / Esc · Start · botón ❚❚", "Continuar: acción" }
            : new String[] { "Move: WASD / arrows · left stick · touch joystick", "Action (scan, drill, boost): Space / Enter · A button · ● button", "Pause: P / Esc · Start · ❚❚ button", "Resume: action" };
        for (int i = 0; i < rows.length; i++) g.text(rows[i], VIEW_W / 2, 220 + i * 36, i == 3 ? CYAN : WHITE, 16, "center", false);
    }

    private void renderTouch(Gfx g) {
        g.alpha(0.35); g.fillCircle(joyBaseX, joyBaseY, 70, "#ffffff"); g.alpha(0.8);
        g.fillCircle(joyKnobX, joyKnobY, 32, "#dff6ff"); g.alpha(1);
        double bx = VIEW_W - 110, by = VIEW_H - 120;
        g.alpha(touchAction ? 0.9 : 0.5); g.fillCircle(bx, by, 52, ORANGE); g.alpha(1);
        g.text("●", bx, by + 10, "#2a1405", 30, "center", true);
        g.alpha(0.5); g.fillCircle(VIEW_W - 50, 160, 26, "#ffffff"); g.alpha(1);
        g.text("❚❚", VIEW_W - 50, 167, "#07101b", 16, "center", true);
    }
}
