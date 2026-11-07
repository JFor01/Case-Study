import type { Point } from "../dataModels/Point.js";
import type { Position } from "../dataModels/Position.js";
import type { ProductResponse } from "../dataModels/ProductResponse.js";

/**
 * Contract for a route-finding strategy used by Optimizer.
 *
 * Optimizer checks strategies in array order and runs the first one that can
 * handle the input. Keep canHandle deterministic, inexpensive, and read-only.
 */
export interface RouteAlgorithm {
    /** Return whether this strategy is suitable for the supplied product positions. */
    canHandle(positions: Map<string, Position[]>): boolean;

    /**
     * Choose one position for every product and return the route from start.
     * Distance is the sum of 3D legs; the route does not include a return trip.
     * Optimizer validates that the map has non-empty position lists first.
     */
    findShortestPath(positions: Map<string, Position[]>, start: Point): ProductResponse;
}
