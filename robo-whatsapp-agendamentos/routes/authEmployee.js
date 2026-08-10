/**
 * Rotas de Autenticação para Funcionários
 * Login por Matrícula + Senha (separado do Supabase Auth)
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Segredo JWT (deve estar em variável de ambiente em produção)
const JWT_SECRET = process.env.JWT_SECRET || 'moveis-pedro-ii-jwt-secret-2026';
const JWT_EXPIRES_IN = '24h';

// Cargos autorizados a criar/resetar credenciais de funcionários
const ADMIN_ROLES = ['Administrador', 'Gerente Geral'];

/**
 * Verifica se o request possui um JWT válido de um Administrador ou Gerente Geral.
 * Retorna o payload decodificado do JWT ou null (com resposta HTTP já enviada).
 */
async function verifyAdminJWT(req, res, supabase) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ success: false, error: 'Token de autenticação não fornecido.' });
        return null;
    }

    const token = authHeader.replace('Bearer ', '');
    let decoded;
    try {
        decoded = jwt.verify(token, JWT_SECRET);
    } catch (e) {
        res.status(401).json({ success: false, error: 'Token inválido ou expirado. Faça login novamente.' });
        return null;
    }

    // Verificar cargo do solicitante no banco (fonte da verdade, não confiar só no JWT)
    const { data: adminUser, error } = await supabase
        .from('public_users')
        .select('id, cargo, cargos, ativo')
        .eq('id', decoded.id)
        .single();

    if (error || !adminUser || !adminUser.ativo) {
        res.status(403).json({ success: false, error: 'Usuário não encontrado ou inativo.' });
        return null;
    }

    const roles = normalizeUserRoles(adminUser);
    const isAdmin = roles.some(r => ADMIN_ROLES.includes(r));

    if (!isAdmin) {
        console.warn(`[Auth] Tentativa de acesso admin negada para user ${decoded.id} (cargos: ${roles.join(', ')})`);
        res.status(403).json({ success: false, error: 'Acesso negado. Apenas Administradores podem executar esta ação.' });
        return null;
    }

    return decoded;
}

function normalizeUserRoles(user) {
    const fromArray = Array.isArray(user?.cargos)
        ? user.cargos.filter((role) => typeof role === 'string' && role.trim())
        : [];

    if (user?.cargo && !fromArray.includes(user.cargo)) {
        fromArray.unshift(user.cargo);
    }

    return fromArray;
}

// Validação de complexidade de senha para funcionários
// Mínimo 6 caracteres, 1 maiúscula, 1 número
function validarSenhaComplexidade(senha) {
    if (senha.length < 6) {
        return { valido: false, erro: 'A senha deve ter pelo menos 6 caracteres' };
    }
    if (!/[A-Z]/.test(senha)) {
        return { valido: false, erro: 'A senha deve conter pelo menos uma letra maiúscula' };
    }
    if (!/[0-9]/.test(senha)) {
        return { valido: false, erro: 'A senha deve conter pelo menos um número' };
    }
    return { valido: true };
}

/**
 * Configura as rotas de autenticação de funcionários
 * @param {Express.Application} app - Instância do Express
 * @param {SupabaseClient} supabase - Cliente Supabase
 * @param {WhatsAppClient} whatsappClient - Cliente WhatsApp para notificações (opcional)
 */
function setupEmployeeAuthRoutes(app, supabase, whatsappClient = null) {

    // ========================================
    // POST /api/auth/employee/login
    // Login de funcionário por matrícula
    // ========================================
    app.post('/api/auth/employee/login', async (req, res) => {
        try {
            const { matricula, senha } = req.body;

            if (!matricula || !senha) {
                return res.status(400).json({
                    success: false,
                    error: 'Matrícula e senha são obrigatórios'
                });
            }

            // Buscar funcionário pela matrícula
            const { data: user, error: userError } = await supabase
                .from('public_users')
                .select('*')
                .eq('matricula', matricula.toUpperCase())
                .single();

            if (userError || !user) {
                console.log(`[Auth] Tentativa de login falhou - Matrícula não encontrada: ${matricula}`);
                return res.status(401).json({
                    success: false,
                    error: 'Matrícula ou senha incorretos'
                });
            }

            // Verificar se está ativo
            if (user.ativo === false) {
                return res.status(403).json({
                    success: false,
                    error: 'Sua conta foi desativada. Contate o administrador.'
                });
            }

            // Verificar senha
            if (!user.senha_hash) {
                return res.status(401).json({
                    success: false,
                    error: 'Conta não configurada. Solicite ativação ao administrador.'
                });
            }

            const senhaValida = await bcrypt.compare(senha, user.senha_hash);
            if (!senhaValida) {
                console.log(`[Auth] Senha incorreta para matrícula: ${matricula}`);
                return res.status(401).json({
                    success: false,
                    error: 'Matrícula ou senha incorretos'
                });
            }

            // Verificar primeiro acesso
            if (user.primeiro_acesso) {
                // Gerar token temporário para troca de senha
                const tokenTemp = jwt.sign(
                    { id: user.id, matricula: user.matricula, tipo: 'primeiro_acesso' },
                    JWT_SECRET,
                    { expiresIn: '15m' }
                );

                return res.json({
                    success: true,
                    primeiro_acesso: true,
                    token_temp: tokenTemp,
                    message: 'Por favor, defina uma nova senha'
                });
            }

            // Gerar token JWT
            const token = jwt.sign(
                {
                    id: user.id,
                    matricula: user.matricula,
                    cargos: normalizeUserRoles(user),
                    cargo: user.cargo,
                    loja: user.loja
                },
                JWT_SECRET,
                { expiresIn: JWT_EXPIRES_IN }
            );

            // Atualizar último login
            await supabase
                .from('public_users')
                .update({ ultimo_login: new Date().toISOString() })
                .eq('id', user.id);

            console.log(`[Auth] Login bem-sucedido: ${matricula} (${user.full_name})`);

            res.json({
                success: true,
                token,
                user: {
                    id: user.id,
                    full_name: user.full_name,
                    cargos: normalizeUserRoles(user),
                    cargo: user.cargo,
                    matricula: user.matricula,
                    loja: user.loja,
                    email: user.email,
                    primeiro_acesso: false
                }
            });

        } catch (error) {
            console.error('[Auth] Erro no login:', error);
            res.status(500).json({
                success: false,
                error: 'Erro interno do servidor'
            });
        }
    });

    // ========================================
    // POST /api/auth/employee/change-password
    // Trocar senha (primeiro acesso ou normal)
    // ========================================
    app.post('/api/auth/employee/change-password', async (req, res) => {
        try {
            const { token_temp, senha_atual, nova_senha } = req.body;
            const authHeader = req.headers.authorization;

            if (!nova_senha) {
                return res.status(400).json({
                    success: false,
                    error: 'A nova senha é obrigatória'
                });
            }

            // Validar complexidade da senha
            const validacao = validarSenhaComplexidade(nova_senha);
            if (!validacao.valido) {
                return res.status(400).json({
                    success: false,
                    error: validacao.erro
                });
            }

            let userId;

            // Caso 1: Primeiro acesso (usa token_temp)
            if (token_temp) {
                try {
                    const decoded = jwt.verify(token_temp, JWT_SECRET);
                    if (decoded.tipo !== 'primeiro_acesso') {
                        throw new Error('Token inválido');
                    }
                    userId = decoded.id;
                } catch (e) {
                    return res.status(401).json({
                        success: false,
                        error: 'Token expirado ou inválido. Faça login novamente.'
                    });
                }
            }
            // Caso 2: Troca normal (usa token do header + senha atual)
            else if (authHeader && senha_atual) {
                const token = authHeader.replace('Bearer ', '');
                try {
                    const decoded = jwt.verify(token, JWT_SECRET);
                    userId = decoded.id;
                } catch (e) {
                    return res.status(401).json({
                        success: false,
                        error: 'Sessão expirada. Faça login novamente.'
                    });
                }

                // Verificar senha atual
                const { data: user } = await supabase
                    .from('public_users')
                    .select('senha_hash')
                    .eq('id', userId)
                    .single();

                if (!user || !await bcrypt.compare(senha_atual, user.senha_hash)) {
                    return res.status(401).json({
                        success: false,
                        error: 'Senha atual incorreta'
                    });
                }
            } else {
                return res.status(400).json({
                    success: false,
                    error: 'Requisição inválida'
                });
            }

            // Gerar hash da nova senha
            const novoHash = await bcrypt.hash(nova_senha, 10);

            // Atualizar no banco
            const { error: updateError } = await supabase
                .from('public_users')
                .update({
                    senha_hash: novoHash,
                    primeiro_acesso: false
                })
                .eq('id', userId);

            if (updateError) throw updateError;

            console.log(`[Auth] Senha alterada para usuário ID: ${userId}`);

            res.json({
                success: true,
                message: 'Senha alterada com sucesso'
            });

        } catch (error) {
            console.error('[Auth] Erro ao trocar senha:', error);
            res.status(500).json({
                success: false,
                error: 'Erro interno do servidor'
            });
        }
    });

    // (Rota reset-password removida pois era duplicada e usava matrícula)


    // ========================================
    // POST /api/auth/employee/create
    // Admin cria credenciais para funcionário
    // ========================================
    app.post('/api/auth/employee/create', async (req, res) => {
        try {
            // 🔐 Verificar se o solicitante é Administrador ou Gerente Geral
            const admin = await verifyAdminJWT(req, res, supabase);
            if (!admin) return; // Resposta já enviada por verifyAdminJWT

            const { user_id, setor_code } = req.body;

            // Gerar matrícula usando função do banco
            const { data: matriculaData, error: matriculaError } = await supabase
                .rpc('gerar_proxima_matricula', { p_setor_code: setor_code || 'AD' });

            if (matriculaError) {
                console.error('[Auth] Erro ao gerar matrícula:', matriculaError);
                return res.status(500).json({
                    success: false,
                    error: 'Erro ao gerar matrícula'
                });
            }

            const matricula = matriculaData;

            // Gerar senha temporária
            const senhaTemp = 'temp' + Math.random().toString(36).substring(2, 8);
            const senhaHash = await bcrypt.hash(senhaTemp, 10);

            // Atualizar usuário com matrícula e senha
            const { data: updatedUser, error: updateError } = await supabase
                .from('public_users')
                .update({
                    matricula: matricula,
                    senha_hash: senhaHash,
                    primeiro_acesso: true,
                    ativo: true
                })
                .eq('id', user_id)
                .select('id, full_name, matricula, cargo')
                .single();

            if (updateError) {
                console.error('[Auth] Erro ao criar credenciais:', updateError);
                return res.status(500).json({
                    success: false,
                    error: 'Erro ao criar credenciais'
                });
            }

            console.log(`[Auth] Credenciais criadas: ${matricula} para ${updatedUser.full_name}`);

            res.json({
                success: true,
                user: updatedUser,
                matricula: matricula,
                senha_temporaria: senhaTemp,
                message: `Acesso criado! Matrícula: ${matricula}, Senha: ${senhaTemp}`
            });

        } catch (error) {
            console.error('[Auth] Erro ao criar credenciais:', error);
            res.status(500).json({
                success: false,
                error: 'Erro interno do servidor'
            });
        }
    });

    // ========================================
    // POST /api/auth/employee/reset-password
    // Admin reseta senha de funcionário
    // ========================================
    app.post('/api/auth/employee/reset-password', async (req, res) => {
        try {
            // 🔐 Verificar se o solicitante é Administrador ou Gerente Geral
            const admin = await verifyAdminJWT(req, res, supabase);
            if (!admin) return; // Resposta já enviada por verifyAdminJWT

            const { user_id } = req.body;

            // Verificar se o usuário existe
            const { data: user, error: userError } = await supabase
                .from('public_users')
                .select('id, full_name, matricula, telefone, cargo, organization_id')
                .eq('id', user_id)
                .single();

            if (userError || !user) {
                return res.status(404).json({
                    success: false,
                    error: 'Funcionário não encontrado'
                });
            }

            if (!user.matricula) {
                return res.status(400).json({
                    success: false,
                    error: 'Funcionário não possui credenciais ativas'
                });
            }

            // Gerar nova senha temporária
            const senhaTemp = 'temp' + Math.random().toString(36).substring(2, 8);
            const senhaHash = await bcrypt.hash(senhaTemp, 10);

            // Atualizar senha
            const { error: updateError } = await supabase
                .from('public_users')
                .update({
                    senha_hash: senhaHash,
                    primeiro_acesso: true
                })
                .eq('id', user_id);

            if (updateError) {
                console.error('[Auth] Erro ao resetar senha:', updateError);
                return res.status(500).json({
                    success: false,
                    error: 'Erro ao resetar senha'
                });
            }

            console.log(`[Auth] Senha resetada: ${user.matricula} (${user.full_name})`);

            // Enviar notificação via WhatsApp se possível
            let whatsappEnviado = false;
            if (whatsappClient && user.telefone) {
                try {
                    const telefoneFormatado = user.telefone.replace(/\D/g, '');
                    const telefoneWhatsApp = telefoneFormatado.startsWith('55')
                        ? telefoneFormatado
                        : '55' + telefoneFormatado;

                    const mensagem = `🔐 *Senha Resetada*\n\n` +
                        `Olá ${user.full_name}!\n\n` +
                        `Sua senha de acesso foi resetada.\n\n` +
                        `📋 *Matrícula:* ${user.matricula}\n` +
                        `🔑 *Nova Senha:* ${senhaTemp}\n\n` +
                        `⚠️ _No primeiro acesso você deverá criar uma nova senha._\n\n` +
                        `Acesse o sistema para entrar.`;

                    const orgId = user.organization_id || '00000000-0000-0000-0000-000000000001';
                    if (typeof whatsappClient.sendMessage === 'function') {
                        // Suporte a TenantWhatsAppManager (orgId, chatId, content)
                        const sendRes = await whatsappClient.sendMessage(orgId, `${telefoneWhatsApp}@c.us`, mensagem);
                        whatsappEnviado = sendRes?.success || false;
                    }
                    console.log(`[Auth] Notificação WhatsApp enviada para ${user.full_name}`);
                } catch (whatsError) {
                    console.error('[Auth] Erro ao enviar WhatsApp:', whatsError);
                }
            }

            res.json({
                success: true,
                matricula: user.matricula,
                senha_temporaria: senhaTemp,
                whatsapp_enviado: whatsappEnviado,
                message: whatsappEnviado
                    ? 'Senha resetada e enviada via WhatsApp'
                    : 'Senha resetada. Informe manualmente ao funcionário.'
            });

        } catch (error) {
            console.error('[Auth] Erro ao resetar senha:', error);
            res.status(500).json({
                success: false,
                error: 'Erro interno do servidor'
            });
        }
    });
    // ========================================
    // GET /api/auth/employee/me
    // Retorna dados do usuário logado
    // ========================================
    app.get('/api/auth/employee/me', async (req, res) => {
        try {
            const authHeader = req.headers.authorization;

            if (!authHeader) {
                return res.status(401).json({
                    success: false,
                    error: 'Não autenticado'
                });
            }

            const token = authHeader.replace('Bearer ', '');

            let decoded;
            try {
                decoded = jwt.verify(token, JWT_SECRET);
            } catch (e) {
                return res.status(401).json({
                    success: false,
                    error: 'Token inválido ou expirado'
                });
            }

            // Buscar dados atualizados
            const { data: user, error } = await supabase
                .from('public_users')
                .select('id, full_name, email, cargo, cargos, matricula, loja, ativo')
                .eq('id', decoded.id)
                .single();

            if (error || !user) {
                return res.status(404).json({
                    success: false,
                    error: 'Usuário não encontrado'
                });
            }

            res.json({
                success: true,
                user: {
                    ...user,
                    cargos: normalizeUserRoles(user)
                }
            });

        } catch (error) {
            console.error('[Auth] Erro em /me:', error);
            res.status(500).json({
                success: false,
                error: 'Erro interno do servidor'
            });
        }
    });

    console.log('✅ Rotas de autenticação de funcionários configuradas');
}

module.exports = { setupEmployeeAuthRoutes };
