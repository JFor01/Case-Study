import type { Point } from "./dataModels/Point.js";
import type { Position } from "./dataModels/Position.js";
import type { ProductResponse } from "./dataModels/ProductResponse.js";
import { ExactRouteAlgorithm } from "./algoritms/ExactRouteAlgorithm.js";
import { NearestNeighborAlgorithm } from "./algoritms/NearestNeighborAlgorithm.js";
import type { RouteAlgorithm } from "./algoritms/RouteAlgorithm.js";

/**
 * Selects a route strategy while keeping one public entry point for callers.
 * Strategies run in array order, so keep the nearest-neighbor fallback last.
 */
export class Optimizer {
    constructor(
        private readonly algorithms: readonly RouteAlgorithm[] = [
            new ExactRouteAlgorithm(),
            new NearestNeighborAlgorithm(),
        ],
    ) {}

    public findShortestPath(positions: Map<string, Position[]>, start: Point): ProductResponse {
        if (!Number.isFinite(start.x) || !Number.isFinite(start.y) || !Number.isFinite(start.z)) {
            throw new Error("Start point coordinates must be finite numbers");
        }
        for (const [productId, productPositions] of positions) {
            if (productPositions.length === 0) throw new Error(`No positions for product ${productId}`);
        }
        if (positions.size === 0) return { pickingOrder: [], distance: 0 };

        // Use the first suitable strategy: exact search first, then nearest neighbor.
        const algorithm = this.algorithms.find((candidate) => candidate.canHandle(positions));
        if (!algorithm) throw new Error("No route algorithm can handle this request");
        return algorithm.findShortestPath(positions, start);
    }
}
