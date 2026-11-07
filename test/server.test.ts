import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { API_PATH, createApp } from "../src/infrastructure/Server.js";
import type { ProductRequest } from "../src/app/dataModels/ProductRequest.js";
import type { ProductResponse } from "../src/app/dataModels/ProductResponse.js";
import { InvalidRouteRequestError } from "../src/app/InvalidRouteRequestError.js";

async function withServer<T>(handler: (request: ProductRequest) => Promise<ProductResponse> | ProductResponse, run: (baseUrl: string) => Promise<T>): Promise<T> {
    const server = createApp({ postRequest: async (request) => handler(request) });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address() as AddressInfo;
    try {
        return await run(`http://127.0.0.1:${address.port}`);
    } finally {
        await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
}

describe("HTTP server", () => {
    it("accepts a product request and returns the controller response as JSON", async () => {
        const expected: ProductResponse = { pickingOrder: [{ productId: "product-1", positionId: "position-1" }], distance: 4.5 };
        let received: ProductRequest | undefined;
        await withServer((request) => {
            received = request;
            return expected;
        }, async (baseUrl) => {
            const request: ProductRequest = { products: ["product-1"], startingPosition: { x: 0, y: 0, z: 0 } };
            const response = await fetch(`${baseUrl}${API_PATH}`, {
                method: "POST", headers: { "content-type": "application/json", connection: "close" }, body: JSON.stringify(request),
            });
            assert.equal(response.status, 200);
            assert.match(response.headers.get("content-type") ?? "", /application\/json/);
            assert.deepStrictEqual(await response.json(), expected);
            assert.deepStrictEqual(received, request);
        });
    });

    it("returns 400 for malformed JSON", async () => {
        await withServer(() => ({ pickingOrder: [], distance: 0 }), async (baseUrl) => {
            const response = await fetch(`${baseUrl}${API_PATH}`, { method: "POST", headers: { connection: "close" }, body: "{" });
            assert.equal(response.status, 400);
            assert.equal(await response.text(), "Invalid JSON\n");
        });
    });

    it("returns 404 for an unknown path", async () => {
        await withServer(() => ({ pickingOrder: [], distance: 0 }), async (baseUrl) => {
            const response = await fetch(`${baseUrl}/unknown`, { headers: { connection: "close" } });
            assert.equal(response.status, 404);
            assert.equal(await response.text(), "Page not found\n");
        });
    });

    it("returns 405 and an Allow header for a non-POST request", async () => {
        await withServer(() => ({ pickingOrder: [], distance: 0 }), async (baseUrl) => {
            const response = await fetch(`${baseUrl}${API_PATH}`, { headers: { connection: "close" } });
            assert.equal(response.status, 405);
            assert.equal(response.headers.get("allow"), "POST");
        });
    });

    it("returns 500 when the controller fails", async () => {
        const originalError = console.error;
        console.error = () => {};
        try {
            await withServer(() => { throw new Error("upstream failed"); }, async (baseUrl) => {
                const response = await fetch(`${baseUrl}${API_PATH}`, {
                    method: "POST", headers: { "content-type": "application/json", connection: "close" },
                    body: JSON.stringify({ products: [], startingPosition: { x: 0, y: 0, z: 0 } }),
                });
                assert.equal(response.status, 500);
                assert.equal(await response.text(), "Internal error\n");
            });
        } finally {
            console.error = originalError;
        }
    });

    it("returns a precise 400 response for invalid route input", async () => {
        await withServer(() => {
            throw new InvalidRouteRequestError("Starting position coordinates must be finite, non-negative numbers");
        }, async (baseUrl) => {
            const response = await fetch(`${baseUrl}${API_PATH}`, {
                method: "POST",
                headers: { "content-type": "application/json", connection: "close" },
                body: JSON.stringify({ products: ["product-1"], startingPosition: { x: -1, y: 0, z: 0 } }),
            });
            assert.equal(response.status, 400);
            assert.match(response.headers.get("content-type") ?? "", /application\/json/);
            assert.deepStrictEqual(await response.json(), {
                error: "Starting position coordinates must be finite, non-negative numbers",
            });
        });
    });
});
