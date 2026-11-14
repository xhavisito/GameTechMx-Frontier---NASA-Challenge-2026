package mx.gametech.frontier.mars.core;

/**
 * Minimal drawing surface. The game core only talks to this interface, so it
 * runs unchanged in tests (no browser) and in the web build (HTML canvas via TeaVM).
 */
public interface Gfx {
    double width();
    double height();
    void clear(String color);
    void fillRect(double x, double y, double w, double h, String color);
    void strokeRect(double x, double y, double w, double h, String color, double lineWidth);
    void fillCircle(double x, double y, double r, String color);
    void strokeCircle(double x, double y, double r, String color, double lineWidth);
    void line(double x1, double y1, double x2, double y2, String color, double lineWidth);
    void fillPoly(double[] xs, double[] ys, String color);
    /** align: "left" | "center" | "right". */
    void text(String text, double x, double y, String color, int size, String align, boolean bold);
    void alpha(double alpha);
    void save();
    void restore();
    void translate(double x, double y);
    void rotate(double radians);
}
