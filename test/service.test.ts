import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Service } from "../src/infrastructure/Service.js";
import { Optimizer } from "../src/app/Optimizer.js";
import type { Position } from "../src/app/dataModels/Position.js";
import type { ProductRequest } from "../src/app/dataModels/ProductRequest.js";

const request = (products: string[]): ProductRequest => ({
    products,
    startingPosition: { x: 0, y: 0, z: 0 },
});
const pos = (positionId: string, productId: string, x: number, y = 0, z = 0): Position =>
    ({ positionId, productId, x, y, z, quantity: 1 });

describe("Service.optimizeRoute", () => {
    it("chooses the nearest of several positions for one product", () => {
        const plan = new Service(new Optimizer()).optimizeRoute(request(["product-1"]), [
            [pos("position-far", "product-1", 10), pos("position-near", "product-1", 2)],
        ]);

        assert.deepStrictEqual(plan.pickingOrder, [{ productId: "product-1", positionId: "position-near" }]);
        assert.ok(Math.abs(plan.distance - 2) < 1e-9);
    });

    it("orders products by shortest route", () => {
        const plan = new Service(new Optimizer()).optimizeRoute(request(["product-1", "product-2"]), [
            [pos("position-100", "product-1", 0, 5, 300)],
            [pos("position-200", "product-2", 32, 3, 200)],
        ]);

        assert.deepStrictEqual(plan.pickingOrder.map((p) => p.productId), ["product-2", "product-1"]);
        const expected = Math.hypot(32, 3, 200) + Math.hypot(32, 2, 100);
        assert.ok(Math.abs(plan.distance - expected) < 1e-9);
    });

    it("returns an empty plan when no products are requested", () => {
        const plan = new Service(new Optimizer()).optimizeRoute(request([]), []);
        assert.deepStrictEqual(plan, { pickingOrder: [], distance: 0 });
    });

    it("throws a useful error when a product has no positions", () => {
        assert.throws(
            () => new Service(new Optimizer()).optimizeRoute(request(["product-1"]), [[]]),
            /no pickable position is available for product "product-1"/i,
        );
    });
});
