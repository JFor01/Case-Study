import type { Point } from "./dataModels/Point.js";
import type { Position } from "./dataModels/Position.js";
import type { ProductResponse } from "./dataModels/ProductResponse.js";
import { InvalidRouteRequestError } from "./InvalidRouteRequestError.js";
import { ExactRouteAlgorithm } from "./algoritms/ExactRouteAlgorithm.js";
import { NearestNeighborAlgorithm } from "./algoritms/NearestNeighborAlgorithm.js";
import type { RouteAlgorithm } from "./algoritms/RouteAlgorithm.js";
import { ProductUnavailableError } from "./ProductUnavailableError.js";

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
        //check if starting position is realistic
        if (
            !Number.isFinite(start.x) || start.x < 0 ||
            !Number.isFinite(start.y) || start.y < 0 ||
            !Number.isFinite(start.z) || start.z < 0
        ) {
            throw new InvalidRouteRequestError("Starting position coordinates must be finite, non-negative numbers");
        }
        //filter for realistic positions, including realistic quantities
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
            if (productPositions.length === 0) throw new ProductUnavailableError(productId);

            const inStock = productPositions.filter(
                (position) => Number.isFinite(position.quantity) && position.quantity >= 1,
            );
            if (inStock.length === 0) {
                throw new ProductUnavailableError(productId);
            }

            const withValidCoordinates = inStock.filter((position) =>
                Number.isFinite(position.x) && position.x >= 0 &&
                Number.isFinite(position.y) && position.y >= 0 &&
                Number.isFinite(position.z) && position.z >= 0,
            );
            if (withValidCoordinates.length === 0) {
                throw new ProductUnavailableError(productId);
            }
            pickablePositions.set(productId, withValidCoordinates);
        }
        return pickablePositions;
    }
}
