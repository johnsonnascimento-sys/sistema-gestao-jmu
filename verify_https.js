const axios = require('axios');

async function checkSite() {
  const url = process.env.APPSMITH_URL || 'https://app.johnsontn.com.br';
  console.log(`Checking ${url}...`);

  try {
    const response = await axios.get(url, {
      timeout: 10_000,
      validateStatus: (status) => status < 500,
    });

    console.log(`Status: ${response.status}`);
    console.log(`Server: ${response.headers.server || 'N/A'}`);

    const body = typeof response.data === 'string' ? response.data : '';
    if (body.includes('Appsmith')) {
      console.log('Content Check: OK - Appsmith keyword detected in body');
    } else {
      console.log('Content Check: WARN - Appsmith keyword not found (might be loading JS)');
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  }
}

checkSite();

