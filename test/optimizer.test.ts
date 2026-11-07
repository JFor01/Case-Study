// picking/optimizer.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {Optimizer} from "../app/Optimizer.js";
import type {Position} from "../app/dataModels/Position.js";

function assertClose(actual: number, expected: number, tolerance = 1e-9): void {
    assert.ok(
        Math.abs(actual - expected) <= tolerance,
        `expected ${expected}, got ${actual}`,
    );
}

describe('findShortestPath', () => {
    const optimizer :Optimizer = new Optimizer();
    it('orders two products by distance from the start', () => {
        const map = new Map([
            ['product-1', [{ positionId: 'position-100', x: 0, y: 5, z: 300, productId: 'product-1', quantity: 10 }]],
            ['product-2', [{ positionId: 'position-200', x: 32, y: 3, z: 200, productId: 'product-2', quantity: 2 }]],
        ]);

        const plan = optimizer.findShortestPath(map, { x: 0, y: 0, z: 0 });

        assert.deepStrictEqual(plan.pickingOrder, [
            { productId: 'product-2', positionId: 'position-200' },
            { productId: 'product-1', positionId: 'position-100' },
        ]);
        // origin -> product-2 -> product-1
        assertClose(plan.distance, Math.hypot(32, 3, 200) + Math.hypot(32, 2, 100));
    });
});

describe('exact route optimization', () => {
    const optimizer = new Optimizer();
    const pos = (positionId: string, productId: string, x: number): Position =>
        ({ positionId, productId, x, y: 0, z: 0, quantity: 1 });

    it('finds a shorter route than nearest neighbour when an early greedy pick is costly', () => {
        const at = (positionId: string, productId: string, x: number, y: number): Position =>
            ({ positionId, productId, x, y, z: 0, quantity: 1 });
        const positions = new Map<string, Position[]>([
            ['product-A', [at('A', 'product-A', 6, 6), at('A-far', 'product-A', 100, 100)]],
            ['product-B', [at('B', 'product-B', 7, 13)]],
            ['product-C', [at('C', 'product-C', 0, 1)]],
            ['product-D', [at('D', 'product-D', 5, 9)]],
            ['product-E', [at('E', 'product-E', 2, 7)]],
        ]);

        const plan = optimizer.findShortestPath(positions, { x: 0, y: 0, z: 0 });

        assert.deepStrictEqual(plan.pickingOrder, [
            { productId: 'product-C', positionId: 'C' },
            { productId: 'product-E', positionId: 'E' },
            { productId: 'product-A', positionId: 'A' },
            { productId: 'product-D', positionId: 'D' },
            { productId: 'product-B', positionId: 'B' },
        ]);
        assertClose(plan.distance, 1 + Math.sqrt(40) + Math.sqrt(17) + Math.sqrt(10) + Math.sqrt(20));
    });

    it('uses a valid nearest-neighbour route when the exact search is too large', () => {
        const positions = new Map<string, Position[]>();
        for (let index = 0; index < 20; index++) {
            const productId = `product-${index}`;
            positions.set(productId, [pos(`position-${index}`, productId, index + 1)]);
        }

        const plan = optimizer.findShortestPath(positions, { x: 0, y: 0, z: 0 });

        assert.equal(plan.pickingOrder.length, positions.size);
        assertClose(plan.distance, 20);
        assert.deepStrictEqual(plan.pickingOrder.map(({ productId }) => productId),
            Array.from({ length: 20 }, (_, index) => `product-${index}`));
    });
});


describe('findShortestPath (more cases)', () => {
    const optimizer = new Optimizer();
    const pos = (positionId: string, productId: string, x: number, y = 0, z = 0) =>
        ({ positionId, productId, x, y, z, quantity: 1 });

    it('returns an empty plan when there are no products', () => {
        const plan = optimizer.findShortestPath(new Map(), { x: 0, y: 0, z: 0 });
        assert.deepStrictEqual(plan, { pickingOrder: [], distance: 0 });
    });

    it('measures a single pick in 3D', () => {
        const map = new Map([['product-1', [pos('position-1', 'product-1', 1, 2, 2)]]]);
        const plan = optimizer.findShortestPath(map, { x: 0, y: 0, z: 0 });
        assertClose(plan.distance, 3);
    });

    it('chooses the closest of several positions for a single product', () => {
        const map = new Map([
            ['product-1', [pos('position-far', 'product-1', 10), pos('position-near', 'product-1', 2)]],
        ]);
        const plan = optimizer.findShortestPath(map, { x: 0, y: 0, z: 0 });
        assert.deepStrictEqual(plan.pickingOrder, [
            { productId: 'product-1', positionId: 'position-near' },
        ]);
        assertClose(plan.distance, 2);
    });

    it('visits points on a line in the order they are passed', () => {
        // start at 0; product-B at 5 is between the start and product-A at 10
        const map = new Map([
            ['product-A', [pos('position-A', 'product-A', 10)]],
            ['product-B', [pos('position-B', 'product-B', 5)]],
        ]);
        const plan = optimizer.findShortestPath(map, { x: 0, y: 0, z: 0 });
        assert.deepStrictEqual(plan.pickingOrder.map((p) => p.productId), ['product-B', 'product-A']);
        assertClose(plan.distance, 10);
    });

    it('picks each requested product exactly once', () => {
        const map = new Map([
            ['product-1', [pos('position-1a', 'product-1', 1), pos('position-1b', 'product-1', 9)]],
            ['product-2', [pos('position-2a', 'product-2', 4), pos('position-2b', 'product-2', 8)]],
            ['product-3', [pos('position-3a', 'product-3', 3)]],
        ]);
        const plan = optimizer.findShortestPath(map, { x: 0, y: 0, z: 0 });
        const productIds = plan.pickingOrder.map((p) => p.productId).sort();
        assert.deepStrictEqual(productIds, ['product-1', 'product-2', 'product-3']);
    });

    it('uses a position that belongs to the product it was chosen for', () => {
        const map = new Map([
            ['product-1', [pos('position-1', 'product-1', 2)]],
            ['product-2', [pos('position-2', 'product-2', 4)]],
        ]);
        const plan = optimizer.findShortestPath(map, { x: 0, y: 0, z: 0 });
        for (const step of plan.pickingOrder) {
            assert.equal(map.get(step.productId)?.some((p) => p.positionId === step.positionId), true);
        }
    });
});

describe('findShortestPath with several products and positions', () => {
    // Start at the origin. Each product has two candidate positions.
    //
    // product-A: A1 (10,0,0)   A2 (3,4,0)
    // product-B: B1 (6,8,0)    B2 (0,0,20)
    // product-C: C1 (1,0,0)    C2 (50,50,50)
    // product-D: D1 (0,0,4)    D2 (30,40,0)
    //
    // Nearest-neighbour trace, using the closest candidate of any remaining product:
    //   step 1, from (0,0,0): C1 at 1.000 is nearest (A2 is 5, D1 is 4)
    //   step 2, from C1 (1,0,0): D1 at sqrt(17) = 4.123 beats A2 at sqrt(20) = 4.472
    //   step 3, from D1 (0,0,4): A2 at sqrt(41) = 6.403 beats B1 at sqrt(116) = 10.77
    //   step 4, from A2 (3,4,0): B1 at 5.000 is the only choice left that is close
    //
    // Expected order: C1, D1, A2, B1. The unused candidates (A1, B2, C2, D2) must not appear.
    const optimizer = new Optimizer();
    const pos = (positionId: string, productId: string, x: number, y = 0, z = 0) =>
        ({ positionId, productId, x, y, z, quantity: 1 });

    const positions = new Map<string, Position[]>([
        ['product-A', [pos('position-A1', 'product-A', 10, 0, 0), pos('position-A2', 'product-A', 3, 4, 0)]],
        ['product-B', [pos('position-B1', 'product-B', 6, 8, 0), pos('position-B2', 'product-B', 0, 0, 20)]],
        ['product-C', [pos('position-C1', 'product-C', 1, 0, 0), pos('position-C2', 'product-C', 50, 50, 50)]],
        ['product-D', [pos('position-D1', 'product-D', 0, 0, 4), pos('position-D2', 'product-D', 30, 40, 0)]],
    ]);

    it('selects one available position for every product', () => {
        const plan = optimizer.findShortestPath(positions, { x: 0, y: 0, z: 0 });
        assert.equal(plan.pickingOrder.length, positions.size);
        for (const pick of plan.pickingOrder) {
            assert.equal(positions.get(pick.productId)?.some((position) => position.positionId === pick.positionId), true);
        }
    });

    it('reports the route distance without adding a return leg', () => {
        const plan = optimizer.findShortestPath(positions, { x: 0, y: 0, z: 0 });
        const route = [
            { x: 0, y: 0, z: 0 },
            ...plan.pickingOrder.map((pick) => positions.get(pick.productId)!.find((position) => position.positionId === pick.positionId)!),
        ];
        const distance = route.slice(1).reduce((total, point, index) => {
            const previous = route[index]!;
            return total + Math.hypot(point.x - previous.x, point.y - previous.y, point.z - previous.z);
        }, 0);
        assertClose(plan.distance, distance);
    });

    it('picks each product exactly once', () => {
        const plan = optimizer.findShortestPath(positions, { x: 0, y: 0, z: 0 });
        const productIds = plan.pickingOrder.map((p) => p.productId).sort();

        assert.deepStrictEqual(productIds, ['product-A', 'product-B', 'product-C', 'product-D']);
    });

    it('does not modify the input map', () => {
        const before = new Map(
            [...positions].map(([id, list]) => [id, [...list]] as const),
        );

        optimizer.findShortestPath(positions, { x: 0, y: 0, z: 0 });

        assert.deepStrictEqual(positions, before);
    });
});
