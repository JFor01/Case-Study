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
        const availablePositions = this.filterPickablePositions(positions);
        if (availablePositions.size === 0) return { pickingOrder: [], distance: 0 };

        // Use the first suitable strategy: exact search first, then nearest neighbor.
        const algorithm = this.algorithms.find((candidate) => candidate.canHandle(availablePositions));
        if (!algorithm) throw new Error("No route algorithm can handle this request");
        return algorithm.findShortestPath(availablePositions, start);
    }

    private filterPickablePositions(positions: Map<string, Position[]>): Map<string, Position[]> {
        const pickablePositions = new Map<string, Position[]>();
        for (const [productId, productPositions] of positions) {
            if (productPositions.length === 0) throw new Error(`No positions for product ${productId}`);

            const inStock = productPositions.filter(
                (position) => Number.isFinite(position.quantity) && position.quantity >= 1,
            );
            if (inStock.length === 0) {
                throw new Error(`No positions with available quantity for product ${productId}`);
            }

            const withValidCoordinates = inStock.filter((position) =>
                Number.isFinite(position.x) && position.x >= 0 &&
                Number.isFinite(position.y) && position.y >= 0 &&
                Number.isFinite(position.z) && position.z >= 0,
            );
            if (withValidCoordinates.length === 0) {
                throw new Error(`No positions with valid non-negative coordinates for product ${productId}`);
            }
            pickablePositions.set(productId, withValidCoordinates);
        }
        return pickablePositions;
    }
}
