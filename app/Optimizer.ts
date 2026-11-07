import type {Position} from "./dataModels/Position.js";
import type {Point} from "./dataModels/Point.js";
import type {ProductResponse} from "./dataModels/ProductResponse.js";

export class Optimizer{


    private calculateDistance(a :Point, b : Point){
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dz = a.z - b.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    //solution using the suboptimal but quick nearest neighbors
    public findShortestPath(positionsMap: Map<string, Position[]>, startPoint: Point): ProductResponse {
        if (!Number.isFinite(startPoint.x) || !Number.isFinite(startPoint.y) || !Number.isFinite(startPoint.z)) {
            throw new Error("Start point coordinates must be finite numbers");
        }
        for (const [productId, positions] of positionsMap) {
            if (positions.length === 0) throw new Error(`No positions for product ${productId}`);
        }

        const remaining = new Map(positionsMap);
        const pickingOrder: { productId: string; positionId: string }[] = [];
        let current: Point = startPoint;
        let distance = 0;

        while (remaining.size > 0) {
            const best = this.findNearest(remaining, current);
            pickingOrder.push({
                productId: best.position.productId,
                positionId: best.position.positionId,
            });
            distance += best.distance;
            current = best.position;                  // next leg starts here
            remaining.delete(best.position.productId); // remove the product just picked
        }

        return { pickingOrder, distance };
    }

    /** Nearest position of any product still in `remaining`, checking every candidate position. */
    private findNearest(
        remaining: Map<string, Position[]>,
        from: Point,
    ): { position: Position; distance: number } {
        let best: { position: Position; distance: number } | undefined;

        for (const positions of remaining.values()) {
            for (const position of positions) {
                const d = this.calculateDistance(from, position);
                if (best === undefined || d < best.distance) {
                    best = { position, distance: d };
                }
            }
        }

        if (best === undefined) throw new Error("No positions to choose from");
        return best;
    }


}