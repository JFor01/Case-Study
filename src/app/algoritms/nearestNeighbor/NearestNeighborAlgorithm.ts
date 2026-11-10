import type { Point } from "../../dataModels/Point.js";
import type { Position } from "../../dataModels/Position.js";
import type { ProductResponse } from "../../dataModels/ProductResponse.js";
import type { RouteAlgorithm } from "../RouteAlgorithm.js";

/** Fast route strategy used when exact search would be too expensive. */
export class NearestNeighborAlgorithm implements RouteAlgorithm {
    public canHandle(): boolean {
        return true;
    }

    public findShortestPath(positions: Map<string, Position[]>, start: Point): ProductResponse {
        const remaining = new Map(positions);
        const pickingOrder: ProductResponse["pickingOrder"] = [];
        let current = start;
        let distance = 0;

        while (remaining.size > 0) {
            const best = this.findNearest(remaining, current);
            pickingOrder.push({ productId: best.position.productId, positionId: best.position.positionId });
            distance += best.distance;
            current = best.position;
            remaining.delete(best.position.productId);
        }

        return { pickingOrder, distance };
    }

    private findNearest(remaining: Map<string, Position[]>, from: Point): { position: Position; distance: number } {
        let best: { position: Position; distance: number } | undefined;
        for (const positions of remaining.values()) {
            for (const position of positions) {
                const distance = Math.hypot(from.x - position.x, from.y - position.y, from.z - position.z);
                if (best === undefined || distance < best.distance) best = { position, distance };
            }
        }
        if (best === undefined) throw new Error("No positions to choose from");
        return best;
    }
}
