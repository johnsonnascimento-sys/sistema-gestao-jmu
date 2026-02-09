const axios = require('axios');

const apiKey = process.env.N8N_API_KEY;
const baseUrl = 'https://n8n.johnsontn.com.br/api/v1';

if (!apiKey) {
    console.error('Error: N8N_API_KEY environment variable is not set.');
    process.exit(1);
}

const workflows = [
    'nwV77ktZrCIawXYr', // JMU - PreSEI Criar
    'clRfeCOLYAWBN3Qs', // JMU - PreSEI Associar
    'nfBKnnBjON6oU1NT'  // JMU - Bootstrap Adminlog
];

async function checkWorkflows() {
    console.log('Checking N8N Workflows...');
    for (const id of workflows) {
        try {
            const response = await axios.get(`${baseUrl}/workflows/${id}`, {
                headers: { 'X-N8N-API-KEY': apiKey }
            });
            const isActive = response.data.active;
            console.log(`[${isActive ? 'OK' : 'WARNING'}] Workflow ${id} (${response.data.name}): ${isActive ? 'ACTIVE' : 'INACTIVE'}`);
        } catch (error) {
            console.error(`[ERROR] Workflow ${id}:`, error.message);
        }
    }
}

checkWorkflows();
