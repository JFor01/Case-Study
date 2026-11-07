import type {ProductRequest} from "./dataModels/ProductRequest.js";
import type {ProductResponse} from "./dataModels/ProductResponse.js";
import type {Service} from "./Service.js";
import type {Position} from "./dataModels/Position.js";

const HOST = "http://127.0.0.1:4000"

export class Controller{

    private service : Service;

    constructor(service : Service) {
        this.service = service;
    }

    public async postRequest(request : ProductRequest):Promise<ProductResponse>{
       const positions = await Promise.all(request.products.map((requestId) => this.fetchPositions(requestId)));

       return this.service.optimizeRoute(request,positions);
    }


    private async fetchPositions(productId:String){
        const res = await fetch(HOST + "/case-study/products/"+ productId + "/positions");
        if (!res.ok){
            throw new Error(`Positions for ${productId} failed: ${res.status} ${res.statusText}`)
        }
        return await (res.json()) as Position[];
    }



}