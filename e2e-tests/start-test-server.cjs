#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Configuration
const PORT = process.env.TEST_SERVER_PORT || 8080;
const HOST = process.env.TEST_SERVER_HOST || 'localhost';
const PID_FILE = path.join(__dirname, '.test-server-pid');

// MIME types for different file extensions
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain',
};

// Check if server is already running
function checkExistingServer() {
  if (fs.existsSync(PID_FILE)) {
    try {
      const pid = fs.readFileSync(PID_FILE, 'utf8').trim();
      process.kill(parseInt(pid), 0); // Check if process exists
      console.log(`❌ Test server is already running (PID: ${pid})`);
      console.log(`   Access at: http://${HOST}:${PORT}`);
      console.log(`   To stop: node stop-test-server.cjs`);
      process.exit(1);
    } catch (error) {
      // Process doesn't exist, remove stale PID file
      fs.unlinkSync(PID_FILE);
    }
  }
}

// Create HTTP server
function createServer() {
  const server = http.createServer((req, res) => {
    // Parse URL and remove query parameters
    let filePath = req.url.split('?')[0];
    
    // Default to index listing if requesting root
    if (filePath === '/') {
      serveIndexPage(req, res);
      return;
    }

    // Serve requested file
    filePath = path.join(__dirname, filePath);
    
    // Security check - ensure file is within e2e-tests directory
    const resolvedPath = path.resolve(filePath);
    const baseDir = path.resolve(__dirname);
    
    if (!resolvedPath.startsWith(baseDir)) {
      serve404(res);
      return;
    }

    // Check if file exists
    fs.access(filePath, fs.constants.F_OK, (err) => {
      if (err) {
        serve404(res);
        return;
      }

      // Get file extension and MIME type
      const ext = path.extname(filePath).toLowerCase();
      const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

      // Set headers
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      // Handle OPTIONS request for CORS
      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      // Stream file to response
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
      
      fileStream.on('error', (error) => {
        console.error(`Error serving file ${filePath}:`, error);
        serve500(res);
      });

      // Log request
      console.log(`📄 ${req.method} ${req.url} -> ${path.basename(filePath)}`);
    });
  });

  return server;
}

// Serve index page with list of test files
function serveIndexPage(req, res) {
  const testFiles = fs.readdirSync(__dirname)
    .filter(file => file.endsWith('.html'))
    .sort();

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Algonius Browser E2E Test Server</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            max-width: 800px; 
            margin: 0 auto; 
            padding: 20px; 
            background-color: #f5f5f5;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 { 
            color: #333; 
            border-bottom: 2px solid #007bff;
            padding-bottom: 10px;
        }
        .test-list {
            list-style: none;
            padding: 0;
        }
        .test-item {
            margin: 15px 0;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 5px;
            border-left: 4px solid #007bff;
        }
        .test-link {
            color: #007bff;
            text-decoration: none;
            font-weight: bold;
            font-size: 18px;
        }
        .test-link:hover {
            text-decoration: underline;
        }
        .test-description {
            color: #666;
            margin-top: 8px;
            font-size: 14px;
        }
        .server-info {
            background: #e9ecef;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
        }
        .status {
            color: #28a745;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🧪 Algonius Browser E2E Test Server</h1>
        
        <div class="server-info">
            <p><span class="status">✅ Server running</span> on <strong>http://${HOST}:${PORT}</strong></p>
            <p>This server provides test pages for Algonius Browser MCP tools testing.</p>
        </div>

        <h2>Available Test Pages:</h2>
        <ul class="test-list">
            ${testFiles.map(file => {
              const descriptions = {
                'test_static_page.html': 'DOM index consistency testing with various interactive elements',
                'test-type-value.html': 'Input value typing tool testing with special keys and modifiers',
                'test-scrollable-container.html': 'Scrollable container detection and navigation testing',
                'canvas-ball-game.html': 'Canvas-based interactive game for complex interaction testing'
              };
              
              return `
                <li class="test-item">
                    <a href="/${file}" class="test-link">${file}</a>
                    <div class="test-description">${descriptions[file] || 'Test page for browser automation'}</div>
                </li>
              `;
            }).join('')}
        </ul>

        <h2>Quick Start:</h2>
        <p>Click on any test page above to start testing, or use these URLs directly in your automation scripts.</p>
        
        <h2>Stop Server:</h2>
        <p>To stop this server, run: <code>node stop-test-server.cjs</code></p>
    </div>
</body>
</html>
  `;

  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.writeHead(200);
  res.end(html);
  
  console.log(`📋 ${req.method || 'GET'} / -> Index page`);
}

// Serve 404 error
function serve404(res) {
  res.setHeader('Content-Type', 'text/html');
  res.writeHead(404);
  res.end(`
    <html>
      <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
        <h1>404 - File Not Found</h1>
        <p>The requested file was not found on this server.</p>
        <a href="/">← Back to test files</a>
      </body>
    </html>
  `);
}

// Serve 500 error
function serve500(res) {
  res.setHeader('Content-Type', 'text/html');
  res.writeHead(500);
  res.end(`
    <html>
      <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
        <h1>500 - Internal Server Error</h1>
        <p>An error occurred while serving the file.</p>
        <a href="/">← Back to test files</a>
      </body>
    </html>
  `);
}

// Start server
function startServer() {
  checkExistingServer();

  const server = createServer();

  server.listen(PORT, HOST, () => {
    // Save PID for later cleanup
    fs.writeFileSync(PID_FILE, process.pid.toString());

    console.log(`🚀 Algonius Browser E2E Test Server started!`);
    console.log(`   URL: http://${HOST}:${PORT}`);
    console.log(`   PID: ${process.pid}`);
    console.log(`   Directory: ${__dirname}`);
    console.log(`   Test files available:`);
    
    // List available test files
    const testFiles = fs.readdirSync(__dirname)
      .filter(file => file.endsWith('.html'))
      .sort();
    
    testFiles.forEach(file => {
      console.log(`     → http://${HOST}:${PORT}/${file}`);
    });
    
    console.log(`\n💡 To stop server: node stop-test-server.cjs\n`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} is already in use. Try a different port:`);
      console.error(`   TEST_SERVER_PORT=8081 node start-test-server.cjs`);
    } else {
      console.error(`❌ Server error:`, error);
    }
    
    // Clean up PID file on error
    if (fs.existsSync(PID_FILE)) {
      fs.unlinkSync(PID_FILE);
    }
    
    process.exit(1);
  });

  // Clean up on process termination
  process.on('SIGINT', () => {
    console.log(`\n🛑 Stopping test server...`);
    server.close(() => {
      if (fs.existsSync(PID_FILE)) {
        fs.unlinkSync(PID_FILE);
      }
      console.log(`✅ Test server stopped`);
      process.exit(0);
    });
  });

  process.on('SIGTERM', () => {
    console.log(`\n🛑 Received SIGTERM, stopping test server...`);
    server.close(() => {
      if (fs.existsSync(PID_FILE)) {
        fs.unlinkSync(PID_FILE);
      }
      console.log(`✅ Test server stopped`);
      process.exit(0);
    });
  });
}

// Start the server
if (require.main === module) {
  startServer();
}

module.exports = { startServer, createServer };
