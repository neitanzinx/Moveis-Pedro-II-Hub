
const fs = require('fs');
const path = require('path');

const filePath = 'c:\\Users\\Usuario\\Documents\\moveispedroii - launch\\src\\pages\\AutoAtendimento.jsx';
let content = fs.readFileSync(filePath, 'utf8');

const newFunction = `    const handleSearch = async (forcedPedido = null) => {
        setErrorMsg("");
        setPedidosRelacionados([]);
        setOrderStatus(null);

        if (!forcedPedido && !searchTerm.trim()) {
            const msg = "Digite o número do pedido ou CPF";
            setErrorMsg(msg);
            toast.error(msg);
            return;
        }

        setLoading(true);
        try {
            let selectedVenda = forcedPedido;

            if (!selectedVenda) {
                const cleanSearch = searchTerm.replace(/\\D/g, '');

                // Prioridade 1: Numero Pedido exato
                let { data: pedidoDireto } = await supabase
                    .from('vendas')
                    .select('*')
                    .eq('numero_pedido', searchTerm.trim())
                    .limit(1)
                    .maybeSingle();

                if (pedidoDireto) {
                    selectedVenda = pedidoDireto;
                } else {
                    // Prioridade 2: Busca por CPF (11 dígitos) ou outros campos
                    const isCPF = cleanSearch.length === 11;
                    const searchParam = cleanSearch || searchTerm.trim();

                    // Localizar Cliente
                    const clientQuery = supabase.from('clientes').select('id');
                    if (isCPF) {
                        clientQuery.or(\`cpf.eq.\${cleanSearch},cpf_cnpj.eq.\${cleanSearch}\`);
                    } else {
                        clientQuery.or(\`cpf.ilike.%\${searchParam}%,cnpj.ilike.%\${searchParam}%,cpf_cnpj.ilike.%\${searchParam}%,telefone.ilike.%\${searchParam}%\`);
                    }

                    const { data: matchedClients } = await clientQuery.limit(1);

                    if (matchedClients && matchedClients.length > 0) {
                        const cliente = matchedClients[0];
                        // Buscar todos os pedidos deste cliente
                        const { data: vendasCliente } = await supabase
                            .from('vendas')
                            .select('*')
                            .eq('cliente_id', cliente.id)
                            .order('data_venda', { ascending: false })
                            .limit(10);

                        if (vendasCliente && vendasCliente.length > 0) {
                            if (vendasCliente.length === 1) {
                                selectedVenda = vendasCliente[0];
                            } else {
                                // Múltiplos pedidos: Deixar o usuário selecionar
                                setPedidosRelacionados(vendasCliente);
                                setLoading(false);
                                return;
                            }
                        }
                    }

                    // Fallback Case 3: Busca direta em vendas por telefone ou nome
                    if (!selectedVenda) {
                        const { data: vendasFallback } = await supabase
                            .from('vendas')
                            .select('*')
                            .or(\`cliente_telefone.ilike.%\${searchParam}%,cliente_nome.ilike.%\${searchTerm.trim()}%\`)
                            .order('data_venda', { ascending: false })
                            .limit(5);

                        if (vendasFallback && vendasFallback.length > 0) {
                            if (vendasFallback.length === 1) {
                                selectedVenda = vendasFallback[0];
                            } else {
                                setPedidosRelacionados(vendasFallback);
                                setLoading(false);
                                return;
                            }
                        }
                    }
                }
            }

            if (selectedVenda) {
                // Verificar entrega
                const { data: entregas } = await supabase
                    .from('entregas')
                    .select('*')
                    .eq('venda_id', selectedVenda.id)
                    .order('created_at', { ascending: false });

                const estaEntregue = entregas?.some(e => e.status === 'Entregue');
                setPedido(selectedVenda);

                if (estaEntregue) {
                    toast.success("Pedido encontrado!");
                    setStep(1);
                } else {
                    // Pedido ainda não entregue - Mostrar o status
                    const ultimaEntrega = entregas?.[0];
                    setOrderStatus({
                        venda: selectedVenda.status,
                        entrega: ultimaEntrega?.status || 'Aguardando processamento',
                        data: ultimaEntrega?.data_entrega || selectedVenda.data_venda
                    });
                    setStep(4);
                }
            } else {
                const msg = "Pedido não encontrado. Verifique os dados.";
                setErrorMsg(msg);
                toast.error(msg);
            }
        } catch (err) {
            console.error(err);
            const msg = "Erro ao buscar pedido. Tente novamente.";
            setErrorMsg(msg);
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };`;

// Use a regex to find the handleSearch function and replace it.
// It starts with 'const handleSearch = async (forcedPedido = null) => {' 
// (or the old signature since I updated it) and ends with '};'
// We'll replace based on the signature I just partially updated.

const startRegex = /const handleSearch = async \(forcedPedido = null\) => \{/;
const endString = '    };'; // This might be tricky if there are other strings like this.

// Let's find the start index
const startMatch = content.match(startRegex);
if (!startMatch) {
    console.error("Could not find start of handleSearch");
    process.exit(1);
}

const startIndex = startMatch.index;

// Find the first '};' after the start index that is properly indented
// In this file, handleSearch ends at line 150.
// Better: find the end index by looking for the specific structure if possible.

// Since I know the function body ends with 'setLoading(false);\n        }\n    };'
const endMarker = 'setLoading(false);\n        }\n    };';
const markerIndex = content.indexOf(endMarker, startIndex);

if (markerIndex === -1) {
    console.error("Could not find end of handleSearch");
    process.exit(1);
}

const endIndex = markerIndex + endMarker.length;

const newContent = content.substring(0, startIndex) + newFunction + content.substring(endIndex);
fs.writeFileSync(filePath, newContent);
console.log("Successfully updated handleSearch");
