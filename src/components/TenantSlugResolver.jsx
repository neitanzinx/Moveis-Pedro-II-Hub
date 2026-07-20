import React from 'react';
import { useParams } from 'react-router-dom';
import { TenantProvider } from '@/contexts/TenantContext';

/**
 * Wrapper que extrai o slug da rota (se disponível) e passa para o TenantProvider.
 * Funciona tanto para caminhos com slug (ex: /:slug/cliente-login)
 * quanto para acessos diretos via domínio próprio (ex: portal.empresa.com/cliente-login).
 */
export default function TenantSlugResolver({ children }) {
    const { slug } = useParams();

    return (
        <TenantProvider slug={slug}>
            {children}
        </TenantProvider>
    );
}
