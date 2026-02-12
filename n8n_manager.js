const axios = require('axios');
const fs = require('fs');
const path = require('path');

// --- Configuration & Secrets Loading ---
let apiKey = process.env.N8N_API_KEY;
let baseUrl = process.env.N8N_BASE_URL || 'https://n8n.johnsontn.com.br/api/v1';

if (!apiKey) {
    const secretsPath = path.join(__dirname, 'MEUS_SEGREDOS.txt');
    if (fs.existsSync(secretsPath)) {
        const content = fs.readFileSync(secretsPath, 'utf8');
        const match = content.match(/API Key:\s*(.+)/);
        if (match) {
            apiKey = match[1].trim();
            // console.log('Loaded API Key from MEUS_SEGREDOS.txt');
        }
    }
}

if (!apiKey) {
    console.error('Error: Could not find N8N_API_KEY in environment or MEUS_SEGREDOS.txt');
    process.exit(1);
}

// --- CLI Argument Handling ---
const args = process.argv.slice(2);
const command = args[0];
const param1 = args[1];
const param2 = args[2];

if (!command) {
    printUsage();
    process.exit(0);
}

// --- Main Execution ---
(async () => {
    try {
        switch (command) {
            case 'list':
                await listWorkflows();
                break;
            case 'start':
            case 'activate':
                if (!param1) throw new Error('Workflow ID required');
                await setWorkflowActive(param1, true);
                break;
            case 'stop':
            case 'deactivate':
                if (!param1) throw new Error('Workflow ID required');
                await setWorkflowActive(param1, false);
                break;
            case 'info':
                if (!param1) throw new Error('Workflow ID required');
                await getWorkflow(param1);
                break;
            case 'import':
                if (!param1) throw new Error('Workflow JSON file path required');
                await importWorkflow(param1);
                break;
            default:
                console.error(`Unknown command: ${command}`);
                printUsage();
        }
    } catch (error) {
        console.error('Operation failed:', error.message);
        if (error.response) {
            console.error('Details:', error.response.data);
        }
    }
})();

// --- Functions ---

function printUsage() {
    console.log(`
Usage: node n8n_manager.js <command> [args]

Commands:
  list                  List all workflows and their status
  start <id>            Activate a workflow
  stop  <id>            Deactivate a workflow
  info  <id>            Get details of a workflow
`);
}

async function listWorkflows() {
    console.log('Fetching workflows...');
    const response = await axios.get(`${baseUrl}/workflows`, {
        headers: { 'X-N8N-API-KEY': apiKey }
    });

    const workflows = response.data.data;
    console.log('\nID                   | STATUS   | NAME');
    console.log('---------------------+----------+--------------------------------');
    workflows.forEach(w => {
        const status = w.active ? 'ACTIVE  ' : 'INACTIVE';
        const color = w.active ? '\x1b[32m' : '\x1b[31m'; // Green or Red
        const reset = '\x1b[0m';
        console.log(`${w.id} | ${color}${status}${reset} | ${w.name}`);
    });
    console.log(`\nTotal: ${workflows.length} workflows.`);
}

async function setWorkflowActive(id, active) {
    console.log(`${active ? 'Activating' : 'Deactivating'} workflow ${id}...`);
    const response = await axios.post(`${baseUrl}/workflows/${id}/${active ? 'activate' : 'deactivate'}`, {}, {
        headers: { 'X-N8N-API-KEY': apiKey }
    });

    if (response.data) {
        console.log(`Success! Workflow ${id} is now ${active ? 'ACTIVE' : 'INACTIVE'}.`);
    } else {
        console.log('Operation completed (no data returned).');
    }
}

async function getWorkflow(id) {
    const response = await axios.get(`${baseUrl}/workflows/${id}`, {
        headers: { 'X-N8N-API-KEY': apiKey }
    });
    console.log(JSON.stringify(response.data, null, 2));
}

async function importWorkflow(filePath) {
    console.log(`Reading workflow from ${filePath}...`);
    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }

    const workflowData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    // Handle N8N export format which wraps in { "nodes": [], ... } or array
    // API expects: { name: "...", nodes: [...], connections: {...}, ... }

    // Check if it's a raw array (sometimes exports are arrays)
    let payload = workflowData;
    if (Array.isArray(workflowData)) {
        // Obsolete format? usually it is object
        throw new Error('Unexpected array format. Expected object with nodes and connections.');
    }

    // If name is missing in JSON, use filename
    if (!payload.name) {
        payload.name = path.basename(filePath, path.extname(filePath));
    }

    // Ensure settings exist (API requirement)
    if (!payload.settings) {
        payload.settings = {};
    }

    console.log(`Importing workflow "${payload.name}"...`);
    const response = await axios.post(`${baseUrl}/workflows`, payload, {
        headers: { 'X-N8N-API-KEY': apiKey }
    });

    console.log(`Success! Workflow imported with ID: ${response.data.id}`);
    console.log(`Name: ${response.data.name}`);
    console.log(`Active: ${response.data.active}`);
}

function printUsage() {
    console.log(`
Usage: node n8n_manager.js <command> [args]

Commands:
  list                  List all workflows and their status
  start <id>            Activate a workflow
  stop  <id>            Deactivate a workflow
  info  <id>            Get details of a workflow
  import <file>         Import a workflow from JSON file
`);
}
