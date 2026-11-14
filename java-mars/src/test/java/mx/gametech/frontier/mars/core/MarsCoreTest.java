package mx.gametech.frontier.mars.core;

/** Dependency-free tests for the Mars mission core. Run: java ... MarsCoreTest (exit code 1 on failure). */
public final class MarsCoreTest {
    private static int failures = 0, passed = 0;

    static void check(boolean ok, String name) {
        if (ok) passed++; else { failures++; System.out.println("FAIL: " + name); }
    }

    /** Records draw calls so rendering can be exercised without a browser. */
    static final class CountingGfx implements Gfx {
        int calls;
        public double width() { return 960; }
        public double height() { return 540; }
        public void clear(String c) { calls++; }
        public void fillRect(double x, double y, double w, double h, String c) { calls++; }
        public void strokeRect(double x, double y, double w, double h, String c, double lw) { calls++; }
        public void fillCircle(double x, double y, double r, String c) { calls++; }
        public void strokeCircle(double x, double y, double r, String c, double lw) { calls++; }
        public void line(double a, double b, double c2, double d, String c, double w) { calls++; }
        public void fillPoly(double[] xs, double[] ys, String c) { calls++; }
        public void text(String t, double x, double y, String c, int s, String a, boolean b) { calls++; }
        public void alpha(double a) {}
        public void save() {}
        public void restore() {}
        public void translate(double x, double y) {}
        public void rotate(double r) {}
    }

    static MissionConfig cfg(String extra) {
        return MissionConfig.parse("battery=3000;solar=1800;spectrometer=1;camera=1;radar=1;deltaV=2600;comm=x;health=1;seed=TEST;lang=es" + extra);
    }

    /** Simple autopilot: drive to a point, returns true when within range. */
    static boolean driveTo(RoverStage r, double tx, double ty, double range, int maxFrames) {
        Input in = new Input();
        for (int i = 0; i < maxFrames && r.status == RoverStage.Status.DRIVING; i++) {
            double dx = tx - r.x, dy = ty - r.y, d = Math.hypot(dx, dy);
            if (d < range) return true;
            // Nudge sideways when blocked by a rock.
            double side = (i / 60) % 2 == 0 ? 0.6 : -0.6;
            boolean stuck = Math.abs(r.speed) < 5 && i % 120 > 90;
            double ax = dx / d + (stuck ? -dy / d * side : 0), ay = dy / d + (stuck ? dx / d * side : 0);
            r.update(1 / 60.0, in.set(ax, ay, false, false, false));
        }
        return Math.hypot(tx - r.x, ty - r.y) < range;
    }

    public static void main(String[] args) {
        // Config parsing is defensive.
        MissionConfig c = MissionConfig.parse("battery=abc;deltaV=-5;comm=<script>;health=9;lang=en");
        check(c.batteryWh == 350, "invalid battery falls back");
        check(c.deltaV == 0, "deltaV clamped to >= 0");
        check(!c.comm.contains("<"), "comm sanitised");
        check(c.health == 1, "health clamped to 1");
        check(!c.es(), "english selected");

        // Design choices change gameplay.
        check(cfg(";battery=3000").roverEnergy() > cfg(";battery=350").roverEnergy(), "bigger battery → more rover energy");
        check(cfg(";comm=uhf").signalDelay() > cfg(";comm=optical").signalDelay(), "better antenna → less delay");
        check(cfg(";deltaV=2600").fuel() > cfg(";deltaV=250").fuel(), "more Δv → more fuel");
        check(cfg(";camera=1").visibility() > cfg(";camera=0").visibility(), "camera → more visibility");
        RoverStage noRadar = new RoverStage(cfg(";radar=0"));
        RoverStage withRadar = new RoverStage(cfg(";radar=1"));
        long hiddenNo = noRadar.sites.stream().filter(s -> !s.revealed).count();
        long hiddenYes = withRadar.sites.stream().filter(s -> !s.revealed).count();
        check(hiddenNo == 1 && hiddenYes == 0, "radar reveals the buried ice");

        // Determinism.
        RoverStage a = new RoverStage(cfg("")), b = new RoverStage(cfg(""));
        check(a.sites.get(0).x == b.sites.get(0).x && a.obstacles.size() == b.obstacles.size(), "same seed → same terrain");
        check(new RoverStage(cfg(";seed=OTHER")).sites.get(0).x != a.sites.get(0).x, "different seed → different terrain");

        // Rover: scan, drill, return and complete.
        RoverStage r = new RoverStage(cfg(""));
        RoverStage.Site site = r.nearestSite();
        check(driveTo(r, site.x, site.y, 30, 6000), "rover reaches a sample site");
        r.update(1 / 60.0, new Input().set(0, 0, true, true, false));
        check(site.scanned, "action scans the site");
        for (int i = 0; i < 120; i++) r.update(1 / 60.0, new Input().set(0, 0, true, false, false));
        check(r.carried.size() == 1 && site.collected, "holding action drills a sample");
        check(r.message.contains("Muestra"), "spanish feedback message");
        check(driveTo(r, r.mavX, r.mavY, 50, 9000), "rover returns to the MAV");
        r.update(1 / 60.0, new Input().set(0, 0, false, true, false));
        check(r.status == RoverStage.Status.COMPLETE, "loading samples completes the stage");
        check(r.science() > 0, "samples give science");

        // Energy runs out when idling with a tiny battery far from the MAV.
        RoverStage poor = new RoverStage(MissionConfig.parse("battery=0;solar=0;seed=TEST"));
        driveTo(poor, poor.mavX + 900, poor.mavY, 40, 20000);
        for (int i = 0; i < 60 * 400 && poor.status == RoverStage.Status.DRIVING; i++) poor.update(1 / 60.0, new Input());
        check(poor.status == RoverStage.Status.FAILED, "empty battery far from MAV fails the stage");

        // Sample return: delay, fuel, capture and corridor.
        SampleReturnStage s = new SampleReturnStage(cfg(";comm=uhf"), 1);
        s.update(1 / 60.0, new Input().set(1, 0, false, false, false));
        check(s.execAx == 0, "command not executed before the signal delay");
        for (int i = 0; i < 60; i++) s.update(1 / 60.0, new Input().set(1, 0, false, false, false));
        check(s.execAx > 0.9, "command executed after the signal delay");
        check(s.fuel < s.maxFuel, "thrust spends fuel");
        s.rocks.clear();
        // Fly to the canister, then to the corridor (rocks removed for a deterministic check).
        Input in = new Input();
        for (int i = 0; i < 60 * 60 && !s.captured && s.status == SampleReturnStage.Status.FLYING; i++) {
            s.rocks.clear();
            double dx = s.canX - s.x, dy = s.canY - s.y, d = Math.max(1, Math.hypot(dx, dy));
            s.update(1 / 60.0, in.set(dx / d - s.vx / 300, dy / d - s.vy / 300, false, false, false));
        }
        check(s.captured, "spacecraft captures the canister");
        for (int i = 0; i < 60 * 60 && s.status == SampleReturnStage.Status.FLYING; i++) {
            s.rocks.clear();
            double dx = SampleReturnStage.GATE_X + 20 - s.x, dy = SampleReturnStage.GATE_Y - s.y, d = Math.max(1, Math.hypot(dx, dy));
            s.update(1 / 60.0, in.set(dx / d, dy / d, false, false, false));
        }
        check(s.status == SampleReturnStage.Status.COMPLETE, "flying through the corridor completes the return");

        SampleReturnStage hit = new SampleReturnStage(cfg(""), 0.3);
        hit.rocks.clear();
        for (int i = 0; i < 60 * 20 && hit.status == SampleReturnStage.Status.FLYING; i++) {
            if (hit.rocks.isEmpty()) hit.rocks.add(new SampleReturnStage.Rock(hit.x + 40, hit.y, -150, 0, 30, 0));
            hit.update(1 / 60.0, new Input());
        }
        check(hit.hits > 0 && hit.status == SampleReturnStage.Status.FAILED, "asteroid impacts can destroy a weak hull");

        // Whole mission + rendering every phase.
        MarsMission m = new MarsMission(cfg(""));
        CountingGfx g = new CountingGfx();
        m.render(g);
        for (int i = 0; i < 30; i++) m.update(0.05, new Input());
        m.update(0.016, new Input().set(0, 0, false, true, false));
        check(m.phase == MarsMission.Phase.ROVER, "briefing → rover");
        m.touchUi = true;
        m.render(g);
        m.update(0.016, new Input().set(0, 0, false, false, true));
        check(m.paused, "pause toggles");
        m.render(g);
        m.update(0.016, new Input().set(0, 0, false, true, false));
        check(!m.paused, "action resumes");
        m.rover.carried.add(RoverStage.Mineral.CLAY);
        m.rover.status = RoverStage.Status.COMPLETE;
        m.update(0.016, new Input());
        check(m.phase == MarsMission.Phase.ASCENT, "rover → ascent");
        m.render(g);
        for (int i = 0; i < 300; i++) m.update(0.016, new Input());
        check(m.phase == MarsMission.Phase.RETURN, "ascent → return");
        m.render(g);
        m.ret.status = SampleReturnStage.Status.COMPLETE;
        m.update(0.016, new Input());
        check(m.finished() && m.result().returned, "return → results");
        m.render(g);
        check(g.calls > 500, "every phase renders");
        MarsMission.Result res = m.result();
        check(res.encode().startsWith("score=") && res.encode().contains("returned=1"), "result payload");
        check(res.lines.size() >= 4, "result explains design consequences");
        for (int i = 0; i < 60; i++) m.update(0.016, new Input());
        check(m.wantsExit(new Input().set(0, 0, false, true, false)), "action exits the results");

        System.out.println(passed + " passed, " + failures + " failed");
        if (failures > 0) System.exit(1);
    }
}
