package mx.gametech.frontier.mars.core;

/**
 * One frame of player input, already merged from keyboard, gamepad and touch.
 * (ax, ay) is a direction in screen space, each component in [-1, 1].
 */
public final class Input {
    public double ax;
    public double ay;
    /** Main action held (collect / thrust boost). */
    public boolean action;
    /** Main action went down this frame (scan, confirm). */
    public boolean actionPressed;
    /** Pause / help toggle pressed this frame. */
    public boolean pausePressed;

    public Input set(double ax, double ay, boolean action, boolean actionPressed, boolean pausePressed) {
        this.ax = ax; this.ay = ay; this.action = action; this.actionPressed = actionPressed; this.pausePressed = pausePressed;
        return this;
    }

    public Input copy() {
        return new Input().set(ax, ay, action, actionPressed, pausePressed);
    }

    public double magnitude() {
        return Math.min(1, Math.hypot(ax, ay));
    }
}
