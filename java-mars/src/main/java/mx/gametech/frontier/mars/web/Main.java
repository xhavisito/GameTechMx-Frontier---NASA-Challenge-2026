package mx.gametech.frontier.mars.web;

import mx.gametech.frontier.mars.core.Input;
import mx.gametech.frontier.mars.core.MarsMission;
import mx.gametech.frontier.mars.core.MissionConfig;
import org.teavm.jso.JSBody;
import org.teavm.jso.JSFunctor;
import org.teavm.jso.JSObject;

/**
 * Browser entry point (compiled to JavaScript by TeaVM).
 * Exposes window.FrontierMarsStart(canvasId, config) and window.FrontierMarsStop();
 * reports the result through window.FrontierMarsDone(payload).
 */
public final class Main {
    @JSFunctor
    public interface StartFn extends JSObject { void start(String canvasId, String config); }

    @JSFunctor
    public interface StopFn extends JSObject { void stop(); }

    @JSFunctor
    public interface FrameFn extends JSObject { void frame(double time); }

    private static Session current;

    public static void main(String[] args) {
        exportApi(Main::start, Main::stop);
    }

    static void start(String canvasId, String config) {
        stop();
        current = new Session(canvasId, MissionConfig.parse(config));
        installInput(canvasId);
        current.schedule();
    }

    static void stop() {
        if (current != null) current.running = false;
        current = null;
        disposeInput();
    }

    static final class Session {
        final MarsMission mission;
        final CanvasGfx gfx;
        final Input input = new Input();
        boolean running = true;
        double last = -1;

        Session(String canvasId, MissionConfig config) {
            mission = new MarsMission(config);
            gfx = new CanvasGfx(canvasId);
        }

        void schedule() { requestFrame(this::frame); }

        void frame(double time) {
            if (!running) return;
            double dt = last < 0 ? 0 : (time - last) / 1000.0;
            last = time;
            JSObject s = pollInput();
            input.set(at(s, 0), at(s, 1), at(s, 2) > 0, at(s, 3) > 0, at(s, 4) > 0);
            mission.touchUi = at(s, 5) > 0;
            mission.joyBaseX = at(s, 6); mission.joyBaseY = at(s, 7);
            mission.joyKnobX = at(s, 8); mission.joyKnobY = at(s, 9);
            mission.touchAction = at(s, 2) > 0 && mission.touchUi;
            mission.setSentCommand(input.ax, input.ay);
            if (mission.wantsExit(input)) {
                String payload = mission.result().encode();
                Main.stop();
                done(payload);
                return;
            }
            mission.update(dt, input);
            if (gfx.begin()) mission.render(gfx);
            schedule();
        }
    }

    @JSBody(params = { "start", "stop" }, script =
        "window.FrontierMarsStart = start; window.FrontierMarsStop = stop;"
        + "if (typeof window.FrontierMarsReady === 'function') window.FrontierMarsReady();")
    private static native void exportApi(StartFn start, StopFn stop);

    @JSBody(params = "f", script = "requestAnimationFrame(f);")
    private static native void requestFrame(FrameFn f);

    @JSBody(params = "p", script = "if (typeof window.FrontierMarsDone === 'function') window.FrontierMarsDone(p);")
    private static native void done(String payload);

    @JSBody(params = { "a", "i" }, script = "var v = a[i]; return typeof v === 'number' && isFinite(v) ? v : 0;")
    private static native double at(JSObject a, int i);

    /**
     * Keyboard (WASD/arrows, Space/Enter, P/Esc), touch (virtual joystick on the left half,
     * action on the right half, pause top-right) and the standard gamepad
     * (left stick / D-pad, A = action, Start = pause). State lives in window.__frontierMars.
     */
    @JSBody(params = "id", script =
        "var c = document.getElementById(id); var s = { k: {}, p: {}, tid: null, bx: 120, by: 420, tx: 0, ty: 0, act: false, actTid: null, actP: false, pauseP: false, touch: false, pad: [] };"
        + "var keys = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD','Space','Enter','KeyP','Escape'];"
        + "function kd(e) { if (keys.indexOf(e.code) < 0) return; e.preventDefault(); e.stopPropagation(); if (!s.k[e.code]) s.p[e.code] = true; s.k[e.code] = true; s.touch = false; }"
        + "function ku(e) { if (keys.indexOf(e.code) < 0) return; e.stopPropagation(); s.k[e.code] = false; }"
        + "function pt(t) { var r = c.getBoundingClientRect(); return { x: (t.clientX - r.left) / r.width * 960, y: (t.clientY - r.top) / r.height * 540 }; }"
        + "function ts(e) { e.preventDefault(); s.touch = true; for (var i = 0; i < e.changedTouches.length; i++) { var t = e.changedTouches[i], q = pt(t);"
        + "  if (q.x > 890 && q.y > 110 && q.y < 210) { s.pauseP = true; continue; }"
        + "  if (q.x < 480 && s.tid === null) { s.tid = t.identifier; s.bx = q.x; s.by = q.y; s.tx = 0; s.ty = 0; }"
        + "  else if (q.x >= 480 && s.actTid === null) { s.actTid = t.identifier; s.act = true; s.actP = true; } } }"
        + "function tm(e) { e.preventDefault(); for (var i = 0; i < e.changedTouches.length; i++) { var t = e.changedTouches[i]; if (t.identifier !== s.tid) continue;"
        + "  var q = pt(t), dx = q.x - s.bx, dy = q.y - s.by, d = Math.hypot(dx, dy), m = Math.min(1, d / 70); s.tx = d ? dx / d * m : 0; s.ty = d ? dy / d * m : 0; } }"
        + "function te(e) { for (var i = 0; i < e.changedTouches.length; i++) { var t = e.changedTouches[i];"
        + "  if (t.identifier === s.tid) { s.tid = null; s.tx = 0; s.ty = 0; } if (t.identifier === s.actTid) { s.actTid = null; s.act = false; } } }"
        + "window.addEventListener('keydown', kd, true); window.addEventListener('keyup', ku, true);"
        + "if (c) { c.addEventListener('touchstart', ts, { passive: false }); c.addEventListener('touchmove', tm, { passive: false }); c.addEventListener('touchend', te); c.addEventListener('touchcancel', te); }"
        + "s.dispose = function () { window.removeEventListener('keydown', kd, true); window.removeEventListener('keyup', ku, true);"
        + "  if (c) { c.removeEventListener('touchstart', ts); c.removeEventListener('touchmove', tm); c.removeEventListener('touchend', te); c.removeEventListener('touchcancel', te); } };"
        + "window.__frontierMars = s;")
    private static native void installInput(String canvasId);

    @JSBody(script = "var s = window.__frontierMars; if (s && s.dispose) s.dispose(); window.__frontierMars = null;")
    private static native void disposeInput();

    /** Returns [ax, ay, action, actionPressed, pausePressed, touchUi, joyBaseX, joyBaseY, joyKnobX, joyKnobY]. */
    @JSBody(script =
        "var s = window.__frontierMars; if (!s) return [0,0,0,0,0,0,120,420,120,420];"
        + "var k = s.k, ax = 0, ay = 0, act = false, actP = false, pauseP = false;"
        + "if (k.KeyA || k.ArrowLeft) ax -= 1; if (k.KeyD || k.ArrowRight) ax += 1; if (k.KeyW || k.ArrowUp) ay -= 1; if (k.KeyS || k.ArrowDown) ay += 1;"
        + "if (k.Space || k.Enter) act = true; if (s.p.Space || s.p.Enter) actP = true; if (s.p.KeyP || s.p.Escape) pauseP = true; s.p = {};"
        + "var pads = (navigator.getGamepads && navigator.getGamepads()) || [];"
        + "for (var i = 0; i < pads.length; i++) { var g = pads[i]; if (!g || !g.connected) continue;"
        + "  var b = function (n) { return !!(g.buttons[n] && g.buttons[n].pressed); };"
        + "  var lx = g.axes[0] || 0, ly = g.axes[1] || 0; if (Math.abs(lx) > 0.2) ax += lx; if (Math.abs(ly) > 0.2) ay += ly;"
        + "  if (b(14)) ax -= 1; if (b(15)) ax += 1; if (b(12)) ay -= 1; if (b(13)) ay += 1;"
        + "  var a = b(0) || b(7), st = b(9); if (a) act = true; if (a && !s.pad[0]) actP = true; if (st && !s.pad[9]) pauseP = true;"
        + "  s.pad[0] = a; s.pad[9] = st; if (a || st || Math.abs(lx) > 0.3 || Math.abs(ly) > 0.3) s.touch = false; break; }"
        + "if (s.touch) { ax += s.tx; ay += s.ty; if (s.act) act = true; if (s.actP) actP = true; if (s.pauseP) pauseP = true; }"
        + "s.actP = false; s.pauseP = false;"
        + "var m = Math.hypot(ax, ay); if (m > 1) { ax /= m; ay /= m; }"
        + "return [ax, ay, act ? 1 : 0, actP ? 1 : 0, pauseP ? 1 : 0, s.touch ? 1 : 0, s.bx, s.by, s.bx + s.tx * 70, s.by + s.ty * 70];")
    private static native JSObject pollInput();
}
