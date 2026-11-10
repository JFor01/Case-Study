import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ExactRouteAlgorithm } from "../src/app/algoritms/exactRoute/ExactRouteAlgorithm.js";
import { NearestNeighborAlgorithm } from "../src/app/algoritms/nearestNeighbor/NearestNeighborAlgorithm.js";
import type { Point } from "../src/app/dataModels/Point.js";
import type { Position } from "../src/app/dataModels/Position.js";
import type { ProductResponse } from "../src/app/dataModels/ProductResponse.js";

const EPSILON = 1e-9;

function distance(a: Point, b: Point): number {
    return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

/** Small deterministic generator (LCG) so a failing case can be reproduced from its seed. */
function createRandom(seed: number): () => number {
    let state = seed;
    return () => {
        state = (state * 1664525 + 1013904223) % 4294967296;
        return state / 4294967296;
    };
}

/** Random warehouse: 1-6 products, each stored at 1-3 positions. */
function randomInstance(random: () => number): { positions: Map<string, Position[]>; start: Point } {
    const productCount = 1 + Math.floor(random() * 6);
    const positions = new Map<string, Position[]>();
    for (let i = 0; i < productCount; i++) {
        const productId = `product-${i}`;
        const positionCount = 1 + Math.floor(random() * 3);
        positions.set(productId, Array.from({ length: positionCount }, (_, j) => ({
            positionId: `${productId}-position-${j}`,
            productId,
            x: random() * 50,
            y: random() * 10,
            z: random() * 300,
            quantity: 1,
        })));
    }
    return { positions, start: { x: random() * 50, y: 0, z: random() * 300 } };
}

/**
 * Reference solution: tries every product order and every position choice.
 * Far too slow for real use, but obviously correct for the tiny cases used here.
 */
function bruteForceShortestDistance(positions: Map<string, Position[]>, start: Point): number {
    let best = Infinity;
    const visit = (remaining: string[], current: Point, travelled: number): void => {
        if (travelled >= best) return; // already worse than the best route found so far
        if (remaining.length === 0) {
            best = travelled;
            return;
        }
        for (const productId of remaining) {
            const others = remaining.filter((id) => id !== productId);
            for (const position of positions.get(productId)!) {
                visit(others, position, travelled + distance(current, position));
            }
        }
    };
    visit([...positions.keys()], start, 0);
    return best;
}

/** Recomputes the length of a returned route, so we do not trust the reported distance. */
function routeLength(plan: ProductResponse, positions: Map<string, Position[]>, start: Point): number {
    let current = start;
    let total = 0;
    for (const { productId, positionId } of plan.pickingOrder) {
        const position = positions.get(productId)?.find((candidate) => candidate.positionId === positionId);
        assert.ok(position, `route uses unknown position ${positionId} for ${productId}`);
        total += distance(current, position);
        current = position;
    }
    return total;
}

describe('route optimality', () => {
    const exact = new ExactRouteAlgorithm();
    const nearestNeighbor = new NearestNeighborAlgorithm();

    it('exact search matches a brute-force search on random warehouses', async () => {
        const random = createRandom(12345);
        for (let run = 0; run < 300; run++) {
            const { positions, start } = randomInstance(random);
            assert.ok(exact.canHandle(positions), `run ${run}: exact search should accept this small instance`);

            const plan = await exact.findShortestPath(positions, start);
            const optimum = bruteForceShortestDistance(positions, start);

            assert.ok(
                Math.abs(plan.distance - optimum) <= EPSILON,
                `run ${run}: exact search returned ${plan.distance}, optimum is ${optimum}`,
            );
        }
    });

    it('exact search reports a distance that matches the route it returns', async () => {
        const random = createRandom(777);
        for (let run = 0; run < 100; run++) {
            const { positions, start } = randomInstance(random);
            const plan = await exact.findShortestPath(positions, start);

            assert.ok(Math.abs(plan.distance - routeLength(plan, positions, start)) <= EPSILON, `run ${run}`);
            assert.deepStrictEqual(
                plan.pickingOrder.map((entry) => entry.productId).sort(),
                [...positions.keys()].sort(),
                `run ${run}: every product must be picked exactly once`,
            );
        }
    });

    it('nearest neighbour is never shorter than the optimum, and returns a valid route', async () => {
        const random = createRandom(2024);
        for (let run = 0; run < 100; run++) {
            const { positions, start } = randomInstance(random);
            const plan = await nearestNeighbor.findShortestPath(positions, start);
            const optimum = bruteForceShortestDistance(positions, start);

            assert.ok(plan.distance >= optimum - EPSILON, `run ${run}: greedy beat the optimum, so one of them is wrong`);
            assert.ok(Math.abs(plan.distance - routeLength(plan, positions, start)) <= EPSILON, `run ${run}`);
        }
    });
});
