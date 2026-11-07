import type { Point } from "../dataModels/Point.js";
import type { Position } from "../dataModels/Position.js";
import type { ProductResponse } from "../dataModels/ProductResponse.js";

/** A route strategy declares which inputs it can handle and calculates the route. */
export interface RouteAlgorithm {
    canHandle(positions: Map<string, Position[]>): boolean;
    findShortestPath(positions: Map<string, Position[]>, start: Point): ProductResponse;
}
