
import {createServer, type IncomingMessage, type ServerResponse} from 'node:http';
import {Service} from "./Service.js";
import {Controller} from "./Controller.js";
import {json} from "node:stream/consumers";
import type {ProductRequest} from "./dataModels/ProductRequest.js";
import {Optimizer} from "./Optimizer.js";

const API_PATH = "/products";


//dependency injection wiring on globals
const optimizer = new Optimizer();
const service = new Service(optimizer);
const controller = new Controller(service);

const server = createServer((req :IncomingMessage , res:ServerResponse ) =>
{

    //reject an incorrect URL
    if(req.url !== API_PATH){
        res.writeHead(404,{
            'Content-Type' : 'text/plain'
        })
        res.end('Page not found\n');
        return;
    }

    //reject everything that's not a POST
    if(req.method !== 'POST'){
        res.writeHead(405,{
            'Allow': 'POST',
            'Content-Type': 'text/plain'
        })
        res.end('This server accepts only a POST method\n');
        return;
    }

    //process the request
    const buffer : Buffer[]  = [];

    req.
        on('data',(chunk : unknown) => {
            if(chunk instanceof Buffer)buffer.push(chunk);
            else{
                res.writeHead(400, {'Content-Type' : 'text-plain'});
                res.end("Invalid request encoding")
                return;
            }
        })
        .on("end", () => {
            const data = buffer.concat().toString();

            try{
               const parsedData = JSON.parse(data) as ProductRequest;
               controller.postRequest(parsedData).then((data) => {
                   res.writeHead(200, {'Content-Type' : 'application/json' });
                   res.end(JSON.stringify(data));});

            }
            catch {
                res.writeHead(400, {'Content-Type' : 'text/plain'});
                res.end('Invalid JSON\n');
                return;
                
            }

        })
        .on('error', (err) => {
            res.writeHead(400, {'Content-Type': 'text/plain'});
            res.end("Error\n");
        })
});


server.listen(3000, '127.0.0.1', () => {
    console.log('Listening on 127.0.0.1:3000');
});

