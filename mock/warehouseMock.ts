// mock/mockWarehouseApi.ts
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';


interface ProductPosition {
    positionId: string;
    x: number;
    y: number;
    z: number;
    productId: string;
    quantity: number;
}

const HOST = '127.0.0.1';
const PORT = Number(process.env.MOCK_PORT ?? 4000);

// If set, requests must send this value in the x-api-key header
const REQUIRED_API_KEY = process.env.MOCK_API_KEY;

// Every product gets between MIN and MAX positions (both inclusive)
const MIN_POSITIONS = 2;
const MAX_POSITIONS = 5;

const PATH_PATTERN = /^\/case-study\/products\/(product-\d+)\/positions$/;

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'x-api-key, content-type',
};

/**
 * Seeded pseudo-random generator (mulberry32). The same seed always gives
 * the same sequence, so a product's positions stay identical between requests.
 */
function seededRandom(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Random integer in [min, max], inclusive. */
function randomInt(rand: () => number, min: number, max: number): number {
    return Math.floor(rand() * (max - min + 1)) + min;
}

/**
 * Builds all positions for one product. The number of positions is drawn
 * first, then one position is generated for each slot.
 */
function generatePositions(productId: string): ProductPosition[] {
    const productNumber = Number(productId.slice('product-'.length));
    const rand = seededRandom(productNumber);
    const count = randomInt(rand, MIN_POSITIONS, MAX_POSITIONS);

    const positions: ProductPosition[] = [];
    for (let i = 0; i < count; i++) {
        positions.push({
            // product-N uses position-(N*100) onward, so IDs don't collide
            // between products (as long as MAX_POSITIONS is below 100)
            positionId: `position-${productNumber * 100 + i}`,
            x: randomInt(rand, 0, 100),
            y: randomInt(rand, 0, 10),
            z: randomInt(rand, 0, 3) * 100, // floors 0, 100, 200, 300
            productId,
            quantity: randomInt(rand, 1, 20),
        });
    }
    console.log(positions);
    return positions;
}

function sendJson(
    res: ServerResponse,
    status: number,
    body: unknown,
    headers: Record<string, string> = {},
): void {
    res.writeHead(status, {
        'Content-Type': 'application/json',
        ...CORS_HEADERS,
        ...headers,
    });
    res.end(JSON.stringify(body));
}

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    // Browser-based tools send a preflight OPTIONS request first
    if (req.method === 'OPTIONS') {
        res.writeHead(204, CORS_HEADERS);
        res.end();
        return;
    }

    if (req.method !== 'GET') {
        sendJson(res, 405, { message: 'Method not allowed' }, { Allow: 'GET, OPTIONS' });
        return;
    }

    // Same response the real gateway gives for a missing or wrong key
    if (REQUIRED_API_KEY && req.headers['x-api-key'] !== REQUIRED_API_KEY) {
        sendJson(res, 403, { message: 'Forbidden' });
        return;
    }


    // URL parsing drops any query string before matching the path
    const { pathname } = new URL(req.url ?? '/', `http://${HOST}:${PORT}`);
    const productId = PATH_PATTERN.exec(pathname)?.[1];

    if (productId === undefined) {
        sendJson(res, 404, { message: 'Not found' });
        return;
    }

    sendJson(res, 200, generatePositions(productId));


});

server.listen(PORT, HOST, () => {
    console.log(`Mock warehouse API on http://${HOST}:${PORT}`);
    console.log(REQUIRED_API_KEY ? 'x-api-key check: ON' : 'x-api-key check: OFF');
});