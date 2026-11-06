import type {ProductRequest} from "./dataModels/ProductRequest.js";
import type {ProductResponse} from "./dataModels/ProductResponse.js";
import type {Service} from "./Service.js";

export class Controller{

    private service : Service;

    constructor(service : Service) {
        this.service = service;
    }

    public postRequest(request : ProductRequest):ProductResponse{
        return this.service.doMagic(request);
    }
}