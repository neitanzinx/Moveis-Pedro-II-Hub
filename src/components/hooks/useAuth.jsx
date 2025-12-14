import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { ROLE_RULES, SCOPES } from "@/components/config/permissions";

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

 useEffect(() => {
    let mounted = true;
    base44.auth.me().then(u => {
        if(mounted) {
            // Se tiver um usuário, garantimos que ele tenha um cargo e nome padrão
            const safeUser = u ? {
                ...u,
                cargo: u.cargo || 'Administrador', // <--- FORÇA O CARGO ADMIN SE ESTIVER VAZIO
                full_name: u.full_name || u.email,
            } : null;

            setUser(safeUser);
            setLoading(false);
        }
    }).catch((error) => {
        console.error("Erro ao carregar usuário:", error);
        if(mounted) setLoading(false);
    });
    return () => { mounted = false; };
}, []);

  // Verifica permissão
  const can = (permission) => {
    if (!user) return false;
    // Se não tiver cargo definido, bloqueia tudo
    if (!user.cargo) return false;
    
    const rules = ROLE_RULES[user.cargo];
    if (!rules) return false;
    
    if (rules.can.includes('*')) return true; // Admin Deus
    return rules.can.includes(permission);
  };

  // Pega o escopo (all, store, own)
  const getScope = () => {
    if (!user) return SCOPES.OWN;
    const rules = ROLE_RULES[user.cargo];
    return rules ? rules.scope : SCOPES.OWN;
  };

  // Filtra dados automaticamente
  const filterData = (data, options = {}) => {
    if (!data || !user) return [];
    const scope = getScope();
    
    if (scope === SCOPES.ALL) return data;

    if (scope === SCOPES.STORE) {
      return data.filter(item => item.loja === user.loja);
    }

    if (scope === SCOPES.OWN) {
      const userIdField = options.userField || 'responsavel_id';
      return data.filter(item => 
        item[userIdField] === user.id || 
        item.created_by === user.email
      );
    }

    return [];
  };

  return { user, loading, can, getScope, filterData, SCOPES };
}