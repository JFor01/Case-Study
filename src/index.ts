import { Service } from "./infrastructure/Service.js";
import { Controller } from "./infrastructure/Controller.js";
import {createApp} from "./infrastructure/Server.js";
import {Optimizer} from "./app/Optimizer.js";

const apiKey = process.env.X_API_KEY;
if (!apiKey) {
    console.error("X_API_KEY is not set");
    process.exit(1);
}
//using dependency injection to wire stateless dependencies
const controller = new Controller(new Service(new Optimizer()), {
    baseUrl: process.env.WAREHOUSE_API_URL ?? "https://api.gymbeam.io/case-study-picking-optimization",
    apiKey: apiKey
});

createApp(controller).listen(3000, "127.0.0.1", () => {
    console.log("Listening on 127.0.0.1:3000");
});
