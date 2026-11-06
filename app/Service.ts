import type {ProductRequest} from "./dataModels/ProductRequest.js";
import type {ProductResponse} from "./dataModels/ProductResponse.js";

export class Service{

    public doMagic(req : ProductRequest):ProductResponse{

        return {
            pickingOrder : [],
            distance : 0
        }
    }
}