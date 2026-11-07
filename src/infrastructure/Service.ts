import type {ProductRequest} from "../app/dataModels/ProductRequest.js";
import type {ProductResponse} from "../app/dataModels/ProductResponse.js";
import type {Position} from "../app/dataModels/Position.js";
import {Optimizer} from "../app/Optimizer.js";

export class Service{


    public optimizeRoute(req : ProductRequest, productPositions : Position[][]): ProductResponse{
        const optimizer = new Optimizer();
        //use hashMap for efficient index search
        const positionsMap = new Map<string, Position[]>();
        for (const positions of productPositions) this.mapEntry(positions, positionsMap);
        return optimizer.findShortestPath(positionsMap, req.startingPosition);

    }

    private mapEntry(positions: Position[], positionsMap: Map<string, Position[]>): void {
        const position = positions[0];
        //handle empty lists
        if(position === undefined){
            throw new Error("No positions returned for a product");
        }
        positionsMap.set(position.productId, positions);
    }




}
