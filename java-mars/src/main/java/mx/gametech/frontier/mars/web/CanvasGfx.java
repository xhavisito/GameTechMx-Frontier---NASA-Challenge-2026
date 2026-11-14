package mx.gametech.frontier.mars.web;

import mx.gametech.frontier.mars.core.Gfx;
import org.teavm.jso.JSBody;
import org.teavm.jso.JSObject;

/** {@link Gfx} on an HTML canvas 2D context. Logical size is 960×540; the context is scaled to the real canvas. */
final class CanvasGfx implements Gfx {
    private final String canvasId;
    private JSObject ctx;

    CanvasGfx(String canvasId) { this.canvasId = canvasId; }

    /** Resize the backing store to the element size (× devicePixelRatio) and scale to 960×540. */
    boolean begin() {
        ctx = prepare(canvasId);
        return ctx != null;
    }

    @JSBody(params = "id", script =
        "var c = document.getElementById(id); if (!c) return null;"
        + "var d = window.devicePixelRatio || 1; var w = Math.max(1, Math.round(c.clientWidth * d)), h = Math.max(1, Math.round(c.clientHeight * d));"
        + "if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }"
        + "var x = c.getContext('2d'); x.setTransform(w / 960, 0, 0, h / 540, 0, 0); x.globalAlpha = 1; x.lineCap = 'round'; return x;")
    private static native JSObject prepare(String id);

    @JSBody(params = { "x", "c", "a", "b", "w", "h" }, script = "x.fillStyle = c; x.fillRect(a, b, w, h);")
    private static native void rect(JSObject x, String c, double a, double b, double w, double h);

    @JSBody(params = { "x", "c", "a", "b", "w", "h", "lw" }, script = "x.strokeStyle = c; x.lineWidth = lw; x.strokeRect(a, b, w, h);")
    private static native void srect(JSObject x, String c, double a, double b, double w, double h, double lw);

    @JSBody(params = { "x", "c", "a", "b", "r" }, script = "x.fillStyle = c; x.beginPath(); x.arc(a, b, Math.max(0, r), 0, 6.283185307); x.fill();")
    private static native void circle(JSObject x, String c, double a, double b, double r);

    @JSBody(params = { "x", "c", "a", "b", "r", "lw" }, script = "x.strokeStyle = c; x.lineWidth = lw; x.beginPath(); x.arc(a, b, Math.max(0, r), 0, 6.283185307); x.stroke();")
    private static native void scircle(JSObject x, String c, double a, double b, double r, double lw);

    @JSBody(params = { "x", "c", "a", "b", "e", "f", "lw" }, script = "x.strokeStyle = c; x.lineWidth = lw; x.beginPath(); x.moveTo(a, b); x.lineTo(e, f); x.stroke();")
    private static native void seg(JSObject x, String c, double a, double b, double e, double f, double lw);

    @JSBody(params = { "x" }, script = "x.beginPath();")
    private static native void beginPath(JSObject x);

    @JSBody(params = { "x", "a", "b" }, script = "x.moveTo(a, b);")
    private static native void moveTo(JSObject x, double a, double b);

    @JSBody(params = { "x", "a", "b" }, script = "x.lineTo(a, b);")
    private static native void lineTo(JSObject x, double a, double b);

    @JSBody(params = { "x", "c" }, script = "x.closePath(); x.fillStyle = c; x.fill();")
    private static native void fillPath(JSObject x, String c);

    @JSBody(params = { "x", "t", "a", "b", "c", "s", "al", "bold" }, script =
        "x.font = (bold ? '700 ' : '400 ') + s + 'px Inter, system-ui, -apple-system, sans-serif'; x.textAlign = al; x.textBaseline = 'alphabetic'; x.fillStyle = c; x.fillText(t, a, b);")
    private static native void txt(JSObject x, String t, double a, double b, String c, int s, String al, boolean bold);

    @JSBody(params = { "x", "a" }, script = "x.globalAlpha = Math.max(0, Math.min(1, a));")
    private static native void galpha(JSObject x, double a);

    @JSBody(params = { "x" }, script = "x.save();")
    private static native void gsave(JSObject x);

    @JSBody(params = { "x" }, script = "x.restore();")
    private static native void grestore(JSObject x);

    @JSBody(params = { "x", "a", "b" }, script = "x.translate(a, b);")
    private static native void gtranslate(JSObject x, double a, double b);

    @JSBody(params = { "x", "r" }, script = "x.rotate(r);")
    private static native void grotate(JSObject x, double r);

    @Override public double width() { return 960; }
    @Override public double height() { return 540; }
    @Override public void clear(String color) { rect(ctx, color, 0, 0, 960, 540); }
    @Override public void fillRect(double x, double y, double w, double h, String color) { rect(ctx, color, x, y, w, h); }
    @Override public void strokeRect(double x, double y, double w, double h, String color, double lw) { srect(ctx, color, x, y, w, h, lw); }
    @Override public void fillCircle(double x, double y, double r, String color) { circle(ctx, color, x, y, r); }
    @Override public void strokeCircle(double x, double y, double r, String color, double lw) { scircle(ctx, color, x, y, r, lw); }
    @Override public void line(double x1, double y1, double x2, double y2, String color, double lw) { seg(ctx, color, x1, y1, x2, y2, lw); }
    @Override public void fillPoly(double[] xs, double[] ys, String color) {
        beginPath(ctx);
        moveTo(ctx, xs[0], ys[0]);
        for (int i = 1; i < xs.length; i++) lineTo(ctx, xs[i], ys[i]);
        fillPath(ctx, color);
    }
    @Override public void text(String t, double x, double y, String color, int size, String align, boolean bold) { txt(ctx, t, x, y, color, size, align, bold); }
    @Override public void alpha(double a) { galpha(ctx, a); }
    @Override public void save() { gsave(ctx); }
    @Override public void restore() { grestore(ctx); }
    @Override public void translate(double x, double y) { gtranslate(ctx, x, y); }
    @Override public void rotate(double r) { grotate(ctx, r); }
}
