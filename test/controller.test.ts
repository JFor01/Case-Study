import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Controller } from "../src/infrastructure/Controller.js";
import type { ProductRequest } from "../src/app/dataModels/ProductRequest.js";
import type { ProductResponse } from "../src/app/dataModels/ProductResponse.js";
import type { Position } from "../src/app/dataModels/Position.js";

const request: ProductRequest = {
    products: ["product 1", "product/2"],
    startingPosition: { x: 1, y: 2, z: 3 },
};

describe("Controller.postRequest", () => {
    it("loads each product's positions and passes them to the service", async () => {
        const calls: { url: string; apiKey: string | null }[] = [];
        const first: Position[] = [{ positionId: "p1", productId: "product 1", x: 1, y: 0, z: 0, quantity: 2 }];
        const second: Position[] = [{ positionId: "p2", productId: "product/2", x: 2, y: 0, z: 0, quantity: 1 }];
        const originalFetch = globalThis.fetch;
        globalThis.fetch = async (input, init) => {
            calls.push({ url: String(input), apiKey: new Headers(init?.headers).get("x-api-key") });
            const body = String(input).includes("product%201") ? first : second;
            return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
        };

        const expected: ProductResponse = { pickingOrder: [], distance: 0 };
        let serviceArgs: [ProductRequest, Position[][]] | undefined;
        const controller = new Controller({
            optimizeRoute: (order, positions) => {
                serviceArgs = [order, positions];
                return expected;
            },
        }, { baseUrl: "https://warehouse.example/case-study", apiKey: "secret" });

        try {
            assert.deepStrictEqual(await controller.postRequest(request), expected);
            assert.deepStrictEqual(calls, [
                { url: "https://warehouse.example/case-study/products/product%201/positions", apiKey: "secret" },
                { url: "https://warehouse.example/case-study/products/product%2F2/positions", apiKey: "secret" },
            ]);
            assert.deepStrictEqual(serviceArgs, [request, [first, second]]);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    it("rejects when the warehouse returns an error", async () => {
        const originalFetch = globalThis.fetch;
        globalThis.fetch = async () => new Response("missing", { status: 404, statusText: "Not Found" });
        const controller = new Controller({ optimizeRoute: () => ({ pickingOrder: [], distance: 0 }) }, {
            baseUrl: "https://warehouse.example", apiKey: "secret",
        });
        try {
            await assert.rejects(controller.postRequest({ ...request, products: ["missing"] }), /missing failed: 404 Not Found/);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });
});
