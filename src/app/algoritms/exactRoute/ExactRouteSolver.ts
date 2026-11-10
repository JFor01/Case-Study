import type { Point } from "../../dataModels/Point.js";
import type { Position } from "../../dataModels/Position.js";
import type { ProductResponse } from "../../dataModels/ProductResponse.js";

type Candidate = Position & { productIndex: number };

/** Performs the CPU-intensive dynamic-programming calculation for exact routes. */
export class ExactRouteSolver {
    public findShortestPath(positions: Map<string, Position[]>, start: Point): ProductResponse {
        const groups = [...positions.values()];
        const candidates: Candidate[] = [];
        const groupCandidateIndexes: number[][] = [];

        groups.forEach((productPositions, productIndex) => {
            const indexes: number[] = [];
            productPositions.forEach((position) => {
                indexes.push(candidates.length);
                candidates.push({ ...position, productIndex });
            });
            groupCandidateIndexes.push(indexes);
        });

        const productCount = groups.length;
        const candidateCount = candidates.length;
        const subsetCount = 2 ** productCount;
        const fullMask = subsetCount - 1;
        const costs = new Float64Array(subsetCount * candidateCount);
        costs.fill(Number.POSITIVE_INFINITY);
        const previousCandidate = new Int32Array(subsetCount * candidateCount);
        previousCandidate.fill(-1);

        for (let candidateIndex = 0; candidateIndex < candidateCount; candidateIndex++) {
            const candidate = candidates[candidateIndex]!;
            const mask = 1 << candidate.productIndex;
            costs[mask * candidateCount + candidateIndex] = this.calculateDistance(start, candidate);
        }

        for (let mask = 1; mask <= fullMask; mask++) {
            for (let productIndex = 0; productIndex < productCount; productIndex++) {
                const productBit = 1 << productIndex;
                if ((mask & productBit) === 0) continue;
                const previousMask = mask ^ productBit;
                if (previousMask === 0) continue;

                for (const candidateIndex of groupCandidateIndexes[productIndex]!) {
                    const candidate = candidates[candidateIndex]!;
                    const stateIndex = mask * candidateCount + candidateIndex;
                    for (let previousProduct = 0; previousProduct < productCount; previousProduct++) {
                        const previousBit = 1 << previousProduct;
                        if ((previousMask & previousBit) === 0) continue;
                        for (const previousIndex of groupCandidateIndexes[previousProduct]!) {
                            const previousState = previousMask * candidateCount + previousIndex;
                            const previousCost = costs[previousState]!;
                            if (!Number.isFinite(previousCost)) continue;
                            const total = previousCost + this.calculateDistance(candidates[previousIndex]!, candidate);
                            if (total < costs[stateIndex]!) {
                                costs[stateIndex] = total;
                                previousCandidate[stateIndex] = previousIndex;
                            }
                        }
                    }
                }
            }
        }

        let bestCost = Number.POSITIVE_INFINITY;
        let lastCandidate = -1;
        for (let candidateIndex = 0; candidateIndex < candidateCount; candidateIndex++) {
            const stateIndex = fullMask * candidateCount + candidateIndex;
            const cost = costs[stateIndex]!;
            if (cost < bestCost) {
                bestCost = cost;
                lastCandidate = candidateIndex;
            }
        }

        const reversed: ProductResponse["pickingOrder"] = [];
        let mask = fullMask;
        let current = lastCandidate;
        while (current >= 0) {
            const candidate = candidates[current]!;
            reversed.push({ productId: candidate.productId, positionId: candidate.positionId });
            const stateIndex = mask * candidateCount + current;
            const previous = previousCandidate[stateIndex]!;
            mask ^= 1 << candidate.productIndex;
            current = previous;
        }

        return { pickingOrder: reversed.reverse(), distance: bestCost };
    }

    private calculateDistance(a: Point, b: Point): number {
        return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
    }
}
