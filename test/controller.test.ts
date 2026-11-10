import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { Controller } from "../src/infrastructure/Controller.js";
import type { ProductRequest } from "../src/app/dataModels/ProductRequest.js";
import type { ProductResponse } from "../src/app/dataModels/ProductResponse.js";
import type { Position } from "../src/app/dataModels/Position.js";
import { ProductUnavailableError } from "../src/app/errors/ProductUnavailableError.js";
import { MAX_PRODUCTS, WAREHOUSE_CONCURRENCY } from "../src/app/limits.js";

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
            optimizeRoute: async (order, positions) => {
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
        const controller = new Controller({ optimizeRoute: async () => ({ pickingOrder: [], distance: 0 }) }, {
            baseUrl: "https://warehouse.example", apiKey: "secret",
        });
        try {
            await assert.rejects(
                controller.postRequest({ ...request, products: ["missing"] }),
                ProductUnavailableError,
            );
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    it("deduplicates product IDs before fetching positions", async () => {
        const calls: string[] = [];
        const originalFetch = globalThis.fetch;
        globalThis.fetch = async (input) => {
            calls.push(String(input));
            return new Response(JSON.stringify([
                { positionId: "p1", productId: "product-1", x: 1, y: 0, z: 0, quantity: 1 },
            ]), { status: 200 });
        };
        let received: ProductRequest | undefined;
        const controller = new Controller({
            optimizeRoute: async (order) => {
                received = order;
                return { pickingOrder: [], distance: 0 };
            },
        }, { baseUrl: "https://warehouse.example", apiKey: "secret" });

        try {
            await controller.postRequest({
                products: ["product-1", "product-1"],
                startingPosition: { x: 0, y: 0, z: 0 },
            });
            assert.equal(calls.length, 1);
            assert.deepStrictEqual(received?.products, ["product-1"]);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    it("benchmarks concurrent maximum-size requests against a simulated warehouse", async () => {
        const concurrentRequests = 8;
        const simulatedLatencyMs = 10;
        const originalFetch = globalThis.fetch;
        let inFlight = 0;
        let peakInFlight = 0;
        let upstreamCalls = 0;

        globalThis.fetch = async (input) => {
            upstreamCalls++;
            inFlight++;
            peakInFlight = Math.max(peakInFlight, inFlight);
            await new Promise((resolve) => setTimeout(resolve, simulatedLatencyMs));
            inFlight--;

            const productId = decodeURIComponent(String(input).split("/products/")[1]!.split("/positions")[0]!);
            const index = Number(productId.slice("product-".length));
            const position: Position = {
                positionId: `position-${index}`,
                productId,
                x: index % 100,
                y: index % 10,
                z: index % 300,
                quantity: 1,
            };
            return new Response(JSON.stringify([position]), { status: 200 });
        };

        const controller = new Controller({
            optimizeRoute: async (_order, positions) => ({
                pickingOrder: positions.map(([position]) => ({
                    productId: position!.productId,
                    positionId: position!.positionId,
                })),
                distance: 0,
            }),
        }, { baseUrl: "https://warehouse.example", apiKey: "benchmark" });
        const productRequest: ProductRequest = {
            products: Array.from({ length: MAX_PRODUCTS }, (_, index) => `product-${index}`),
            startingPosition: { x: 0, y: 0, z: 0 },
        };

        try {
            const startedAt = performance.now();
            const results = await Promise.all(
                Array.from({ length: concurrentRequests }, () => controller.postRequest(productRequest)),
            );
            const elapsedMs = Math.round(performance.now() - startedAt);

            assert.equal(upstreamCalls, concurrentRequests * MAX_PRODUCTS);
            assert.ok(peakInFlight <= concurrentRequests * WAREHOUSE_CONCURRENCY);
            assert.ok(results.every((result) => result.pickingOrder.length === MAX_PRODUCTS));
            console.log(
                `[benchmark] ${concurrentRequests} concurrent requests × ${MAX_PRODUCTS} products: ` +
                `${elapsedMs} ms; peak warehouse calls in flight: ${peakInFlight}`,
            );
        } finally {
            globalThis.fetch = originalFetch;
        }
    });
});
