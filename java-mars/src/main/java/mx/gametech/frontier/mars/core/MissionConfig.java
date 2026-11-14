package mx.gametech.frontier.mars.core;

import java.util.HashMap;
import java.util.Map;

/**
 * What the spacecraft the student designed brings to Mars. Sent by the web game as
 * "key=value;key=value" so the Java side needs no JSON library.
 *
 * Every field changes the surface gameplay:
 *  batteryWh   → rover energy reserve        solarW      → recharge while driving in daylight
 *  spectrometer→ identifies sample minerals  camera      → wider visible area (less fog)
 *  radar       → reveals buried water ice    deltaV      → fuel for the sample-return pilot stage
 *  comm        → remote-control signal delay health      → hull integrity carried from the cruise
 */
public final class MissionConfig {
    public double batteryWh = 350;
    public double solarW = 350;
    public boolean spectrometer;
    public boolean camera;
    public boolean radar;
    public double deltaV = 250;
    public String comm = "s";
    public double health = 1;
    public String seed = "FRONTIER-2026";
    public String lang = "es";
    public String difficulty = "beginner";

    public static MissionConfig parse(String raw) {
        MissionConfig c = new MissionConfig();
        if (raw == null) return c;
        Map<String, String> m = new HashMap<>();
        for (String part : raw.split(";")) {
            int eq = part.indexOf('=');
            if (eq > 0) m.put(part.substring(0, eq).trim(), part.substring(eq + 1).trim());
        }
        c.batteryWh = num(m.get("battery"), c.batteryWh, 0, 100000);
        c.solarW = num(m.get("solar"), c.solarW, 0, 100000);
        c.spectrometer = "1".equals(m.get("spectrometer"));
        c.camera = "1".equals(m.get("camera"));
        c.radar = "1".equals(m.get("radar"));
        c.deltaV = num(m.get("deltaV"), c.deltaV, 0, 100000);
        if (m.containsKey("comm")) c.comm = clean(m.get("comm"), 12);
        c.health = num(m.get("health"), c.health, 0, 1);
        if (m.containsKey("seed")) c.seed = clean(m.get("seed"), 100);
        if ("en".equals(m.get("lang"))) c.lang = "en";
        String d = m.get("difficulty");
        if ("intermediate".equals(d) || "expert".equals(d)) c.difficulty = d;
        return c;
    }

    private static double num(String s, double fallback, double min, double max) {
        if (s == null) return fallback;
        try {
            double v = Double.parseDouble(s);
            if (Double.isNaN(v) || Double.isInfinite(v)) return fallback;
            return Math.max(min, Math.min(max, v));
        } catch (NumberFormatException e) {
            return fallback;
        }
    }

    private static String clean(String s, int max) {
        String t = s.length() > max ? s.substring(0, max) : s;
        return t.replaceAll("[^A-Za-z0-9_\\- ]", "");
    }

    /** Seconds between a command and the spacecraft executing it (stylised; real Mars delay is 4–24 minutes). */
    public double signalDelay() {
        switch (comm) {
            case "uhf": return 0.65;
            case "s": return 0.45;
            case "x": return 0.3;
            case "ka": return 0.2;
            case "optical": return 0.12;
            default: return 0.5;
        }
    }

    /** Rover energy units: a 350 Wh battery gives ~70 s of driving, 3 kWh gives much more slack. */
    public double roverEnergy() {
        double base = 45 + Math.sqrt(batteryWh) * 1.4;
        double factor = "expert".equals(difficulty) ? 0.8 : "intermediate".equals(difficulty) ? 0.9 : 1.0;
        return base * factor;
    }

    /** Fuel units for the sample-return pilot stage. */
    public double fuel() {
        return Math.max(30, Math.min(120, 30 + deltaV / 2600.0 * 90));
    }

    public double visibility() {
        return camera ? 270 : 170;
    }

    public boolean es() {
        return !"en".equals(lang);
    }
}
