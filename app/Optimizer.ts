import type { Position } from "./dataModels/Position.js";
import type { Point } from "./dataModels/Point.js";
import type { ProductResponse } from "./dataModels/ProductResponse.js";

// Bound the exponential exact search; larger orders use the greedy fallback.
const MAX_EXACT_STATES = 6_000_000;
const MAX_EXACT_TRANSITIONS = 80_000_000;

type Candidate = Position & { productIndex: number };

export class Optimizer {
    private calculateDistance(a: Point, b: Point): number {
        return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
    }

    /** Finds the minimum open route that visits one position for every product. */
    public findShortestPath(positionsMap: Map<string, Position[]>, startPoint: Point): ProductResponse {
        if (!Number.isFinite(startPoint.x) || !Number.isFinite(startPoint.y) || !Number.isFinite(startPoint.z)) {
            throw new Error("Start point coordinates must be finite numbers");
        }
        for (const [productId, positions] of positionsMap) {
            if (positions.length === 0) throw new Error(`No positions for product ${productId}`);
        }
        if (positionsMap.size === 0) return { pickingOrder: [], distance: 0 };

        // Each group contains the possible warehouse locations for one product.
        const groups = [...positionsMap.values()];
        if (!this.isExactSearchFeasible(groups)) {
            return this.findNearestNeighborPath(positionsMap, startPoint);
        }

        const candidates: Candidate[] = [];
        const groupCandidateIndexes: number[][] = [];
        groups.forEach((positions, productIndex) => {
            const indexes: number[] = [];
            positions.forEach((position) => {
                indexes.push(candidates.length);
                candidates.push({ ...position, productIndex });
            });
            groupCandidateIndexes.push(indexes);
        });

        return this.findExactPath(candidates, groupCandidateIndexes, startPoint);
    }

    private isExactSearchFeasible(groups: Position[][]): boolean {
        const productCount = groups.length;
        // Exact search stores a state for every picked-product subset and possible ending position.
        const candidateCount = groups.reduce((total, group) => total + group.length, 0);
        const stateCount = 2 ** productCount * candidateCount;
        if (stateCount > MAX_EXACT_STATES) return false;

        // Estimate the number of moves between locations of different products.
        const sameProductPairs = groups.reduce((total, group) => total + group.length ** 2, 0);
        const transitionCount = productCount < 2
            ? 0
            : 2 ** (productCount - 2) * (candidateCount ** 2 - sameProductPairs);
        return transitionCount <= MAX_EXACT_TRANSITIONS;
    }

    private findExactPath(candidates: Candidate[], groupCandidateIndexes: number[][], start: Point,
    ): ProductResponse {
        const productCount = groupCandidateIndexes.length;
        const candidateCount = candidates.length;
        const subsetCount = 2 ** productCount;
        const fullMask = subsetCount - 1;
        // For each subset and ending location, save the cheapest distance and
        // which location came before it. This lets us rebuild the route later.
        const costs = new Float64Array(subsetCount * candidateCount);
        costs.fill(Number.POSITIVE_INFINITY);
        const previousCandidate = new Int32Array(subsetCount * candidateCount);
        previousCandidate.fill(-1);

        for (let candidateIndex = 0; candidateIndex < candidateCount; candidateIndex++) {
            const candidate = candidates[candidateIndex]!;
            const mask = 1 << candidate.productIndex;
            costs[mask * candidateCount + candidateIndex] = this.calculateDistance(start, candidate);
        }

        // Extend smaller routes by adding the endpoint product as the final pick.
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

        // Follow saved previous locations from the cheapest complete route.
        const reversed: ProductResponse["pickingOrder"] = [];
        let mask = fullMask;
        let current = lastCandidate;
        while (current >= 0) {
            const candidate = candidates[current]!;
            reversed.push({ productId: candidate.productId, positionId: candidate.positionId });
            const stateIndex = mask * candidateCount + current;
            const prior = previousCandidate[stateIndex]!;
            mask ^= 1 << candidate.productIndex;
            current = prior;
        }

        return { pickingOrder: reversed.reverse(), distance: bestCost };
    }

    private findNearestNeighborPath(positionsMap: Map<string, Position[]>, start: Point): ProductResponse {
        // Fast fallback: pick the nearest remaining product each time. Unlike
        // the DP, this does not guarantee the shortest possible route.
        const remaining = new Map(positionsMap);
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
                const distance = this.calculateDistance(from, position);
                if (best === undefined || distance < best.distance) best = { position, distance };
            }
        }
        if (best === undefined) throw new Error("No positions to choose from");
        return best;
    }
}
