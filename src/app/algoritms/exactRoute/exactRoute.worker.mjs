import { register } from "tsx/esm/api";

register();
await import("./exactRoute.worker.ts");
