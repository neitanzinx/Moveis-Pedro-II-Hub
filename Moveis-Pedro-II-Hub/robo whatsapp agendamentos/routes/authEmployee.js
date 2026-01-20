/**
 * Rotas de Autenticação para Funcionários
 * Login por Matrícula + Senha (separado do Supabase Auth)
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Segredo JWT (deve estar em variável de ambiente em produção)
const JWT_SECRET = process.env.JWT_SECRET || 'moveis-pedro-ii-jwt-secret-2026';
const JWT_EXPIRES_IN = '24h';

/**
 * Configura as rotas de autenticação de funcionários
 * @param {Express.Application} app - Instância do Express
 * @param {SupabaseClient} supabase - Cliente Supabase
 */
function setupEmployeeAuthRoutes(app, supabase) {

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

            if (!nova_senha || nova_senha.length < 6) {
                return res.status(400).json({
                    success: false,
                    error: 'A nova senha deve ter pelo menos 6 caracteres'
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

    // ========================================
    // POST /api/auth/employee/reset-password
    // Admin reseta senha de funcionário
    // ========================================
    app.post('/api/auth/employee/reset-password', async (req, res) => {
        try {
            const { matricula } = req.body;
            const authHeader = req.headers.authorization;

            // Verificar se é admin (simplificado - em produção verificar cargo)
            if (!authHeader) {
                return res.status(401).json({
                    success: false,
                    error: 'Não autorizado'
                });
            }

            const token = authHeader.replace('Bearer ', '');
            let adminUser;
            try {
                adminUser = jwt.verify(token, JWT_SECRET);
            } catch (e) {
                return res.status(401).json({
                    success: false,
                    error: 'Sessão expirada'
                });
            }

            // Verificar se é Administrador ou Gerente
            if (!['Administrador', 'Gerente'].includes(adminUser.cargo)) {
                return res.status(403).json({
                    success: false,
                    error: 'Permissão negada. Apenas administradores podem resetar senhas.'
                });
            }

            // Gerar senha temporária
            const senhaTemp = 'temp' + Math.random().toString(36).substring(2, 8);
            const senhaHash = await bcrypt.hash(senhaTemp, 10);

            // Atualizar no banco
            const { data: updatedUser, error: updateError } = await supabase
                .from('public_users')
                .update({
                    senha_hash: senhaHash,
                    primeiro_acesso: true
                })
                .eq('matricula', matricula.toUpperCase())
                .select('full_name, matricula')
                .single();

            if (updateError || !updatedUser) {
                return res.status(404).json({
                    success: false,
                    error: 'Matrícula não encontrada'
                });
            }

            console.log(`[Auth] Senha resetada para ${matricula} por ${adminUser.matricula}`);

            res.json({
                success: true,
                funcionario: updatedUser.full_name,
                matricula: updatedUser.matricula,
                senha_temporaria: senhaTemp,
                message: `Senha resetada! Comunique ao funcionário: ${senhaTemp}`
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
    // POST /api/auth/employee/create
    // Admin cria credenciais para funcionário
    // ========================================
    app.post('/api/auth/employee/create', async (req, res) => {
        try {
            const { user_id, setor_code } = req.body;
            const authHeader = req.headers.authorization;

            if (!authHeader) {
                return res.status(401).json({ success: false, error: 'Não autorizado' });
            }

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
                .select('id, full_name, email, cargo, matricula, loja, ativo')
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
                user
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
