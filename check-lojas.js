import { base44 } from './src/api/base44Client.js';

async function checkLojas() {
  try {
    const lojas = await base44.entities.Loja.list();
    console.log('Lojas data:', JSON.stringify(lojas, null, 2));
  } catch (err) {
    console.error('Error fetching lojas:', err);
  }
}

checkLojas();
