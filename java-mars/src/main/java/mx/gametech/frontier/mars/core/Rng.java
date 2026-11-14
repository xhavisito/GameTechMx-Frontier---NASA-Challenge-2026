package mx.gametech.frontier.mars.core;

/** Deterministic seeded random numbers (FNV-1a seed hash + Mulberry32), same idea as the TypeScript engine. */
public final class Rng {
    private int state;

    public Rng(String seed) {
        int h = 0x811C9DC5;
        for (int i = 0; i < seed.length(); i++) {
            h ^= seed.charAt(i);
            h *= 16777619;
        }
        state = h;
    }

    public double next() {
        state += 0x6D2B79F5;
        int x = state;
        x = (x ^ (x >>> 15)) * (1 | x);
        x ^= x + (x ^ (x >>> 7)) * (61 | x);
        return ((x ^ (x >>> 14)) >>> 0 & 0xFFFFFFFFL) / 4294967296.0;
    }

    public double range(double min, double max) {
        return min + next() * (max - min);
    }

    public int nextInt(int bound) {
        return (int) Math.floor(next() * bound);
    }
}
