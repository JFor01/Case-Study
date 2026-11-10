import { Worker } from "node:worker_threads";
import type { Point } from "../../dataModels/Point.js";
import type { Position } from "../../dataModels/Position.js";
import type { ProductResponse } from "../../dataModels/ProductResponse.js";
import type { RouteAlgorithm } from "../RouteAlgorithm.js";
import { ExactRouteTimeoutError } from "./ExactRouteTimeoutError.js";

const MAX_EXACT_STATES = 1_000_000;
const MAX_EXACT_TRANSITIONS = 10_000_000;
const EXACT_SEARCH_TIMEOUT_MS = 5_000;

type ExactRouteWorkerMessage =
    | { result: ProductResponse }
    | { error: string };

/** Finds the globally shortest route using dynamic programming. */
export class ExactRouteAlgorithm implements RouteAlgorithm {
    public canHandle(positions: Map<string, Position[]>): boolean {
        const groups = [...positions.values()];
        const productCount = groups.length;
        const candidateCount = groups.reduce((total, group) => total + group.length, 0);

        // Exact search stores one state for every product subset and ending position.
        const stateCount = 2 ** productCount * candidateCount;
        if (stateCount > MAX_EXACT_STATES) return false;

        // Estimate the route extensions between positions belonging to different products.
        const sameProductPairs = groups.reduce((total, group) => total + group.length ** 2, 0);
        const transitionCount = productCount < 2
            ? 0
            : 2 ** (productCount - 2) * (candidateCount ** 2 - sameProductPairs);
        return transitionCount <= MAX_EXACT_TRANSITIONS;
    }

    /**
     * Run the costly exact calculation away from the HTTP server's event loop.
     * A worker is short-lived because exact searches are deliberately bounded.
     */
    public findShortestPath(positions: Map<string, Position[]>, start: Point): Promise<ProductResponse> {
        return new Promise((resolve, reject) => {
            const worker = new Worker(new URL("./exactRoute.worker.mjs", import.meta.url), {
                workerData: { positions, start },
            });
            let settled = false;
            const timeout = setTimeout(() => {
                if (settled) return;
                settled = true;
                void worker.terminate();
                reject(new ExactRouteTimeoutError(EXACT_SEARCH_TIMEOUT_MS));
            }, EXACT_SEARCH_TIMEOUT_MS);

            const settle = (callback: () => void): void => {
                if (settled) return;
                settled = true;
                clearTimeout(timeout);
                callback();
            };

            worker.once("message", (message: ExactRouteWorkerMessage) => {
                settle(() => {
                    if ("error" in message) reject(new Error(message.error));
                    else resolve(message.result);
                });
            });
            worker.once("error", (error) => settle(() => reject(error)));
            worker.once("exit", (code) => {
                settle(() => reject(new Error(`Exact route worker exited before returning a result (code ${code})`)));
            });
        });
    }
}
