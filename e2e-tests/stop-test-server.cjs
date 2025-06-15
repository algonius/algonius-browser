#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Configuration
const PID_FILE = path.join(__dirname, '.test-server-pid');
const PORT = process.env.TEST_SERVER_PORT || 8080;
const HOST = process.env.TEST_SERVER_HOST || 'localhost';

// Function to check if process exists
function processExists(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return false;
  }
}

// Function to terminate process gracefully
function terminateProcess(pid) {
  try {
    console.log(`🛑 Sending SIGTERM to process ${pid}...`);
    process.kill(pid, 'SIGTERM');
    
    // Wait a bit for graceful shutdown
    setTimeout(() => {
      if (processExists(pid)) {
        console.log(`⚠️  Process ${pid} still running, sending SIGKILL...`);
        try {
          process.kill(pid, 'SIGKILL');
        } catch (error) {
          console.log(`⚠️  Could not force kill process ${pid}: ${error.message}`);
        }
      }
    }, 3000);
    
    return true;
  } catch (error) {
    console.error(`❌ Failed to terminate process ${pid}: ${error.message}`);
    return false;
  }
}

// Function to stop the test server
function stopTestServer() {
  console.log(`🔍 Looking for running test server...`);
  
  if (!fs.existsSync(PID_FILE)) {
    console.log(`❌ No PID file found at ${PID_FILE}`);
    console.log(`   This usually means the test server is not running.`);
    console.log(`   To start the server: node start-test-server.cjs`);
    process.exit(1);
  }

  let pid;
  try {
    const pidContent = fs.readFileSync(PID_FILE, 'utf8').trim();
    pid = parseInt(pidContent);
    
    if (isNaN(pid) || pid <= 0) {
      console.error(`❌ Invalid PID in file: ${pidContent}`);
      fs.unlinkSync(PID_FILE);
      process.exit(1);
    }
  } catch (error) {
    console.error(`❌ Failed to read PID file: ${error.message}`);
    process.exit(1);
  }

  console.log(`📋 Found PID file with process ID: ${pid}`);

  // Check if process is actually running
  if (!processExists(pid)) {
    console.log(`⚠️  Process ${pid} is not running (stale PID file)`);
    console.log(`🧹 Cleaning up stale PID file...`);
    fs.unlinkSync(PID_FILE);
    console.log(`✅ Cleanup complete. The test server was not running.`);
    process.exit(0);
  }

  console.log(`✅ Test server is running (PID: ${pid})`);
  console.log(`   Server URL: http://${HOST}:${PORT}`);

  // Attempt to terminate the process
  if (terminateProcess(pid)) {
    // Wait for process to terminate and clean up
    const checkInterval = setInterval(() => {
      if (!processExists(pid)) {
        clearInterval(checkInterval);
        
        // Clean up PID file
        try {
          if (fs.existsSync(PID_FILE)) {
            fs.unlinkSync(PID_FILE);
          }
          console.log(`✅ Test server stopped successfully!`);
          console.log(`🧹 PID file cleaned up`);
          process.exit(0);
        } catch (error) {
          console.log(`⚠️  Process stopped but failed to clean PID file: ${error.message}`);
          process.exit(1);
        }
      }
    }, 500);

    // Timeout after 10 seconds
    setTimeout(() => {
      clearInterval(checkInterval);
      if (processExists(pid)) {
        console.error(`❌ Failed to stop test server (PID: ${pid}) within 10 seconds`);
        console.error(`   You may need to stop it manually: kill ${pid}`);
        process.exit(1);
      }
    }, 10000);

  } else {
    console.error(`❌ Failed to stop test server`);
    process.exit(1);
  }
}

// Function to stop all Node.js processes on the test server port (fallback)
function forceStopByPort() {
  console.log(`🔍 Looking for processes using port ${PORT}...`);
  
  const { spawn } = require('child_process');
  
  // Try to find process using the port (Linux/macOS)
  const lsof = spawn('lsof', ['-ti', `:${PORT}`]);
  let pids = '';
  
  lsof.stdout.on('data', (data) => {
    pids += data.toString();
  });
  
  lsof.on('close', (code) => {
    if (code === 0 && pids.trim()) {
      const pidList = pids.trim().split('\n').filter(pid => pid.trim());
      console.log(`🎯 Found processes on port ${PORT}: ${pidList.join(', ')}`);
      
      pidList.forEach(pid => {
        const numPid = parseInt(pid.trim());
        if (!isNaN(numPid)) {
          console.log(`🛑 Terminating process ${numPid}...`);
          terminateProcess(numPid);
        }
      });
      
      // Clean up PID file
      if (fs.existsSync(PID_FILE)) {
        fs.unlinkSync(PID_FILE);
      }
      
      console.log(`✅ Force stop completed`);
    } else {
      console.log(`❌ No processes found on port ${PORT}`);
    }
  });
  
  lsof.on('error', (error) => {
    console.log(`⚠️  Could not check port usage: ${error.message}`);
    console.log(`   (This is normal on some systems without lsof)`);
  });
}

// Main execution
function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
🛑 Algonius Browser E2E Test Server - Stop Script

Usage:
  node stop-test-server.cjs [options]

Options:
  --force, -f    Force stop by checking port usage (fallback method)
  --help, -h     Show this help message

Examples:
  node stop-test-server.cjs           # Normal stop using PID file
  node stop-test-server.cjs --force   # Force stop by port
  
Environment Variables:
  TEST_SERVER_PORT    Port number (default: 8080)
  TEST_SERVER_HOST    Host address (default: localhost)
`);
    process.exit(0);
  }

  if (args.includes('--force') || args.includes('-f')) {
    forceStopByPort();
  } else {
    stopTestServer();
  }
}

// Handle script execution
if (require.main === module) {
  main();
}

module.exports = { stopTestServer, forceStopByPort, terminateProcess };
