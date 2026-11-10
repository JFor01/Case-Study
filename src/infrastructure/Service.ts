import type {ProductRequest} from "../app/dataModels/ProductRequest.js";
import type {ProductResponse} from "../app/dataModels/ProductResponse.js";
import type {Position} from "../app/dataModels/Position.js";
import {Optimizer} from "../app/Optimizer.js";
import { ProductUnavailableError } from "../app/errors/ProductUnavailableError.js";

export class Service{

    constructor(
        private readonly optimizer: Optimizer,
    ) {}

    public async optimizeRoute(req : ProductRequest, productPositions : Position[][]): Promise<ProductResponse>{
        //use hashMap for efficient index search
        const positionsMap = new Map<string, Position[]>();
        productPositions.forEach((positions, index) => {
            this.mapEntry(positions, positionsMap, req.products[index] ?? "unknown product");
        });
        return this.optimizer.findShortestPath(positionsMap, req.startingPosition);

    }

    private mapEntry(positions: Position[], positionsMap: Map<string, Position[]>, requestedProductId: string): void {
        const position = positions[0];
        if (position === undefined) throw new ProductUnavailableError(requestedProductId);
        positionsMap.set(requestedProductId, positions.map((item) => ({ ...item, productId: requestedProductId })));
    }




}
