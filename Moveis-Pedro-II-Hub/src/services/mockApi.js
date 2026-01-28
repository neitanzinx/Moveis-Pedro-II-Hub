export const mockCosmosApi = async (gtin) => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Mock data based on GTIN prefix or specific test cases
    if (gtin === '7891234567890') {
      return {
        gtin: '7891234567890',
        nome: 'Guarda-Roupa Casal 6 Portas',
        marca: 'Móveis Pedro',
        ncm: '9403.50.00',
        foto_url: 'https://via.placeholder.com/150',
        volumes: 2 // This one has 2 volumes/boxes
      };
    }
    
    if (gtin === '7890000000001') {
      return {
        gtin: '7890000000001',
        nome: 'Mesa de Jantar 4 Lugares',
        marca: 'Móveis Pedro',
        ncm: '9403.40.00',
        foto_url: 'https://via.placeholder.com/150',
        volumes: 1
      };
    }

    // Return null if not found
    return null;
  };
