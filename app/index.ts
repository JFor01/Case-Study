import { Service } from "./Service.js";
import { Controller } from "./Controller.js";
import {createApp} from "./Server.js";


const controller = new Controller(new Service(), {
    baseUrl: process.env.WAREHOUSE_API_URL ?? "https://dev.aux.boxpi.com/case-study",
    apiKey: process.env.WAREHOUSE_API_KEY ?? "",
});

createApp(controller).listen(3000, "127.0.0.1", () => {
    console.log("Listening on 127.0.0.1:3000");
});