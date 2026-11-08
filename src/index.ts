import { Service } from "./infrastructure/Service.js";
import { Controller } from "./infrastructure/Controller.js";
import {createApp} from "./infrastructure/Server.js";
import {Optimizer} from "./app/Optimizer.js";

//using dependency injection to wire stateless dependencies
const controller = new Controller(new Service(new Optimizer()), {
    baseUrl: process.env.WAREHOUSE_API_URL ?? "https://dev.aux.boxpi.com/case-study",
    apiKey: process.env.WAREHOUSE_API_KEY ?? "",
});

createApp(controller).listen(3000, "127.0.0.1", () => {
    console.log("Listening on 127.0.0.1:3000");
});