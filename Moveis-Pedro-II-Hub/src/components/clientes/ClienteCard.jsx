import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, User, Phone, Mail, MapPin, Building2 } from "lucide-react";

export default function ClienteCard({ cliente, onEdit, onDelete }) {
  const getIniciais = (nome) => {
    return nome
      .split(' ')
      .slice(0, 2)
      .map(n => n[0])
      .join('')
      .toUpperCase();
  };

  const enderecoCompleto = cliente.endereco 
    ? `${cliente.endereco}${cliente.complemento ? ', ' + cliente.complemento : ''}, ${cliente.bairro || ''}, ${cliente.cidade || ''} - ${cliente.estado || ''}`
    : null;

  return (
    <Card className="hover:shadow-xl transition-all duration-300 border-0">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div 
            className="w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: '#07593f', opacity: 0.1 }}
          >
            <span className="text-2xl font-bold" style={{ color: '#07593f' }}>
              {getIniciais(cliente.nome_completo)}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-bold text-lg mb-1" style={{ color: '#07593f' }}>
                  {cliente.nome_completo}
                </h3>
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="outline" style={{ borderColor: '#f38a4c', color: '#f38a4c' }}>
                    {cliente.tipo_pessoa === "Jurídica" ? (
                      <><Building2 className="w-3 h-3 mr-1" />PJ</>
                    ) : (
                      <><User className="w-3 h-3 mr-1" />PF</>
                    )}
                  </Badge>
                  {cliente.contatos && cliente.contatos.length > 0 && (
                    <Badge variant="outline">
                      {cliente.contatos.length} contato(s)
                    </Badge>
                  )}
                  {cliente.enderecos && cliente.enderecos.length > 0 && (
                    <Badge variant="outline">
                      {cliente.enderecos.length} endereço(s)
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2 text-sm mb-4">
              {cliente.tipo_pessoa === "Jurídica" && cliente.cnpj && (
                <div className="flex items-center gap-2" style={{ color: '#8B8B8B' }}>
                  <Building2 className="w-4 h-4" />
                  <span>CNPJ: {cliente.cnpj}</span>
                </div>
              )}
              {cliente.tipo_pessoa === "Física" && cliente.cpf && (
                <div className="flex items-center gap-2" style={{ color: '#8B8B8B' }}>
                  <User className="w-4 h-4" />
                  <span>CPF: {cliente.cpf}</span>
                </div>
              )}
              {cliente.telefone && (
                <div className="flex items-center gap-2" style={{ color: '#8B8B8B' }}>
                  <Phone className="w-4 h-4" />
                  <span>{cliente.telefone}</span>
                </div>
              )}
              {cliente.email && (
                <div className="flex items-center gap-2" style={{ color: '#8B8B8B' }}>
                  <Mail className="w-4 h-4" />
                  <span className="truncate">{cliente.email}</span>
                </div>
              )}
              {enderecoCompleto && (
                <div className="flex items-start gap-2" style={{ color: '#8B8B8B' }}>
                  <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span className="line-clamp-2">{enderecoCompleto}</span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(cliente)}
                className="flex-1"
              >
                <Pencil className="w-4 h-4 mr-1" />
                Editar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDelete(cliente.id)}
                className="text-red-600 hover:text-red-700 hover:border-red-600"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}