import type {ProductRequest} from "./dataModels/ProductRequest.js";
import type {ProductResponse} from "./dataModels/ProductResponse.js";
import type {Position} from "./dataModels/Position.js";
import type {Optimizer} from "./Optimizer.js";

export class Service{
    private optimizer : Optimizer;

    constructor(optimizer : Optimizer) {
        this.optimizer =optimizer;
    }

    public optimizeRoute(req : ProductRequest, productPositions : Position[][]):ProductResponse{
        //use hashMap for efficient index search
        const positionsMap = new Map();
        productPositions.map((position) => {this.mapEntry(position,positionsMap)});
        return this.optimizer.findShortestPath(positionsMap,req.startingPosition);

    }

    private mapEntry(positions : Position[], positionsMap : Map<String, Position[]>){
        const position = positions[0];
        //handle empty lists
        if(position === undefined){
            throw new Error('');
        }
        positionsMap.set(position.productId, positions);
    }




}