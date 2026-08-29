import http from 'http';
import path from 'path';
import { handler } from './api';
// Automatically load .env if running in Node 20+
try {
    process.loadEnvFile?.();
}
catch { }
try {
    process.loadEnvFile?.(path.resolve(process.cwd(), '../../.env'));
}
catch { }
try {
    process.loadEnvFile?.(path.resolve(process.cwd(), '.env'));
}
catch { }
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, X-Requested-With, Accept, Origin',
    'Access-Control-Max-Age': '86400',
};
const server = http.createServer(async (req, res) => {
    // Always attach CORS headers to all responses
    Object.entries(CORS_HEADERS).forEach(([k, v]) => {
        res.setHeader(k, v);
    });
    // Fast preflight response for OPTIONS requests
    if (req.method?.toUpperCase() === 'OPTIONS') {
        res.statusCode = 204;
        res.end();
        return;
    }
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    // Read body
    const chunks = [];
    for await (const chunk of req) {
        chunks.push(chunk);
    }
    const body = Buffer.concat(chunks).toString('utf-8');
    // Convert to APIGatewayProxyEventV2 format
    const queryParams = {};
    url.searchParams.forEach((val, key) => {
        queryParams[key] = val;
    });
    const event = {
        version: '2.0',
        routeKey: '$default',
        rawPath: url.pathname,
        rawQueryString: url.search.replace(/^\?/, ''),
        headers: req.headers,
        queryStringParameters: queryParams,
        requestContext: {
            accountId: 'local',
            apiId: 'local',
            domainName: 'localhost',
            domainPrefix: 'localhost',
            http: {
                method: req.method || 'GET',
                path: url.pathname,
                protocol: 'HTTP/1.1',
                sourceIp: '127.0.0.1',
                userAgent: req.headers['user-agent'] || 'local'
            },
            requestId: `req_${Date.now()}`,
            routeKey: '$default',
            stage: '$default',
            time: new Date().toISOString(),
            timeEpoch: Date.now()
        },
        body,
        isBase64Encoded: false
    };
    try {
        const result = await handler(event);
        if (typeof result === 'string') {
            res.statusCode = 200;
            res.end(result);
        }
        else {
            const headers = result.headers || {};
            Object.entries(headers).forEach(([k, v]) => {
                res.setHeader(k, v);
            });
            res.statusCode = result.statusCode || 200;
            res.end(result.body);
        }
    }
    catch (err) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Server error', message: err.message }));
    }
});
server.listen(PORT, () => {
    console.log(`⚡ Warehouse Lead Ingestion API running at http://localhost:${PORT}`);
});
