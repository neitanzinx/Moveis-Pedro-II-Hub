import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Check, ChevronDown } from 'lucide-react';

// Paleta de cores de móveis comuns no Brasil
const CORES_MOVEIS = [
    // Madeiras claras
    { nome: 'Nature', hex: '#E8D4B8', grupo: 'Madeiras Claras' },
    { nome: 'Carvalho', hex: '#C4A35A', grupo: 'Madeiras Claras' },
    { nome: 'Carvalho Claro', hex: '#D4BC84', grupo: 'Madeiras Claras' },
    { nome: 'Freijó', hex: '#C9A86C', grupo: 'Madeiras Claras' },
    { nome: 'Fendi', hex: '#D9C9B0', grupo: 'Madeiras Claras' },
    { nome: 'Amêndoa', hex: '#C19A6B', grupo: 'Madeiras Claras' },
    { nome: 'Avelã', hex: '#B08D57', grupo: 'Madeiras Claras' },
    { nome: 'Cinamomo', hex: '#C4A484', grupo: 'Madeiras Claras' },
    { nome: 'Nude', hex: '#E3BC9A', grupo: 'Madeiras Claras' },
    { nome: 'Areia', hex: '#D4C4A8', grupo: 'Madeiras Claras' },
    { nome: 'Natural', hex: '#E5D3B3', grupo: 'Madeiras Claras' },
    { nome: 'Marfim', hex: '#FFEFD5', grupo: 'Madeiras Claras' },
    { nome: 'Mel', hex: '#D4A94B', grupo: 'Madeiras Claras' },
    { nome: 'Mel Queimado', hex: '#8B6914', grupo: 'Madeiras Claras' },
    { nome: 'Mel Claro', hex: '#E8C872', grupo: 'Madeiras Claras' },

    // Madeiras médias
    { nome: 'Itapuã', hex: '#A67B5B', grupo: 'Madeiras Médias' },
    { nome: 'Cedro', hex: '#8B4513', grupo: 'Madeiras Médias' },
    { nome: 'Cerejeira', hex: '#9E4A2F', grupo: 'Madeiras Médias' },
    { nome: 'Jequitibá', hex: '#8B6914', grupo: 'Madeiras Médias' },
    { nome: 'Imbuia', hex: '#6B4423', grupo: 'Madeiras Médias' },
    { nome: 'Nogueira', hex: '#5D4E37', grupo: 'Madeiras Médias' },
    { nome: 'Canela', hex: '#D2691E', grupo: 'Madeiras Médias' },
    { nome: 'Canela Rústico', hex: '#B8733B', grupo: 'Madeiras Médias' },
    { nome: 'Rústico', hex: '#A0522D', grupo: 'Madeiras Médias' },
    { nome: 'Demolição', hex: '#6B4226', grupo: 'Madeiras Médias' },
    { nome: 'Mogno', hex: '#7F3A3A', grupo: 'Madeiras Médias' },
    { nome: 'Ipê', hex: '#6E4928', grupo: 'Madeiras Médias' },
    { nome: 'Sucupira', hex: '#5C4033', grupo: 'Madeiras Médias' },

    // Madeiras escuras
    { nome: 'Tabaco', hex: '#4A3728', grupo: 'Madeiras Escuras' },
    { nome: 'Café', hex: '#3C2415', grupo: 'Madeiras Escuras' },
    { nome: 'Ébano', hex: '#2C1810', grupo: 'Madeiras Escuras' },
    { nome: 'Castanho', hex: '#4E3B31', grupo: 'Madeiras Escuras' },
    { nome: 'Wengue', hex: '#3D2B1F', grupo: 'Madeiras Escuras' },
    { nome: 'Chocolate', hex: '#3D1C02', grupo: 'Madeiras Escuras' },
    { nome: 'Preto Madeira', hex: '#1C1008', grupo: 'Madeiras Escuras' },
    { nome: 'Malte', hex: '#4A3C2A', grupo: 'Madeiras Escuras' },

    // Neutros
    { nome: 'Branco', hex: '#FFFFFF', grupo: 'Neutros' },
    { nome: 'Branco Neve', hex: '#FFFAFA', grupo: 'Neutros' },
    { nome: 'Branco Gelo', hex: '#F8F8FF', grupo: 'Neutros' },
    { nome: 'Branco Ártico', hex: '#F0F8FF', grupo: 'Neutros' },
    { nome: 'Off White', hex: '#FAF9F6', grupo: 'Neutros' },
    { nome: 'Bege', hex: '#F5F5DC', grupo: 'Neutros' },
    { nome: 'Creme', hex: '#FFFDD0', grupo: 'Neutros' },
    { nome: 'Pérola', hex: '#EAE0C8', grupo: 'Neutros' },
    { nome: 'Cinza Claro', hex: '#D3D3D3', grupo: 'Neutros' },
    { nome: 'Cinza', hex: '#808080', grupo: 'Neutros' },
    { nome: 'Cinza Chumbo', hex: '#54585D', grupo: 'Neutros' },
    { nome: 'Grafite', hex: '#474747', grupo: 'Neutros' },
    { nome: 'Chumbo', hex: '#36454F', grupo: 'Neutros' },
    { nome: 'Preto', hex: '#1A1A1A', grupo: 'Neutros' },

    // Acabamentos especiais
    { nome: 'Sem Lustre', hex: '#B8B0A0', grupo: 'Acabamentos' },
    { nome: 'Com Lustre', hex: '#E8E0D0', grupo: 'Acabamentos' },
    { nome: 'Fosco', hex: '#9E9685', grupo: 'Acabamentos' },
    { nome: 'Acetinado', hex: '#D5CCC0', grupo: 'Acabamentos' },
    { nome: 'Brilhante', hex: '#F5F0E8', grupo: 'Acabamentos' },
    { nome: 'Texturizado', hex: '#A09080', grupo: 'Acabamentos' },
    { nome: 'Liso', hex: '#C8C0B0', grupo: 'Acabamentos' },

    // Cores especiais
    { nome: 'Azul Marinho', hex: '#1C3A5F', grupo: 'Cores' },
    { nome: 'Azul', hex: '#4169E1', grupo: 'Cores' },
    { nome: 'Azul Turquesa', hex: '#40E0D0', grupo: 'Cores' },
    { nome: 'Verde Musgo', hex: '#4A5D23', grupo: 'Cores' },
    { nome: 'Verde', hex: '#228B22', grupo: 'Cores' },
    { nome: 'Verde Oliva', hex: '#6B8E23', grupo: 'Cores' },
    { nome: 'Terracota', hex: '#C4694B', grupo: 'Cores' },
    { nome: 'Marsala', hex: '#7B3F3F', grupo: 'Cores' },
    { nome: 'Mostarda', hex: '#C9A227', grupo: 'Cores' },
    { nome: 'Amarelo', hex: '#FFD700', grupo: 'Cores' },
    { nome: 'Rosa Antigo', hex: '#C08081', grupo: 'Cores' },
    { nome: 'Rosa', hex: '#FFC0CB', grupo: 'Cores' },
    { nome: 'Vermelho', hex: '#B22222', grupo: 'Cores' },
    { nome: 'Vinho', hex: '#722F37', grupo: 'Cores' },
    { nome: 'Bordô', hex: '#800020', grupo: 'Cores' },
    { nome: 'Laranja', hex: '#FF8C00', grupo: 'Cores' },
    { nome: 'Coral', hex: '#FF7F50', grupo: 'Cores' },
];

// Função para encontrar cor hex pelo nome
export function getColorHex(colorName) {
    if (!colorName) return '#CCCCCC';

    const normalized = colorName.toLowerCase().trim();
    const found = CORES_MOVEIS.find(c =>
        c.nome.toLowerCase() === normalized ||
        c.nome.toLowerCase().includes(normalized) ||
        normalized.includes(c.nome.toLowerCase())
    );

    return found?.hex || '#CCCCCC';
}

// Componente seletor de cor
export default function FurnitureColorPicker({
    value,
    hexValue,
    onChange,
    onHexChange,
    placeholder = "Selecione ou digite uma cor"
}) {
    const [open, setOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Agrupa cores por categoria
    const groupedColors = useMemo(() => {
        const groups = {};
        CORES_MOVEIS.forEach(cor => {
            if (!groups[cor.grupo]) {
                groups[cor.grupo] = [];
            }
            groups[cor.grupo].push(cor);
        });
        return groups;
    }, []);

    // Filtra cores pelo termo de busca
    const filteredGroups = useMemo(() => {
        if (!searchTerm) return groupedColors;

        const filtered = {};
        Object.entries(groupedColors).forEach(([grupo, cores]) => {
            const matched = cores.filter(c =>
                c.nome.toLowerCase().includes(searchTerm.toLowerCase())
            );
            if (matched.length > 0) {
                filtered[grupo] = matched;
            }
        });
        return filtered;
    }, [groupedColors, searchTerm]);

    // Atualiza a cor selecionada
    const handleSelectColor = (cor) => {
        onChange(cor.nome);
        onHexChange(cor.hex);
        setOpen(false);
        setSearchTerm('');
    };

    // Quando digita uma cor, tenta encontrar o hex correspondente
    const handleInputChange = (e) => {
        const newValue = e.target.value;
        onChange(newValue);

        // Tenta encontrar a cor pela digitação
        const hex = getColorHex(newValue);
        if (hex !== '#CCCCCC') {
            onHexChange(hex);
        }
    };

    // Cor atual para preview
    const currentHex = hexValue || getColorHex(value) || '#CCCCCC';

    return (
        <div className="space-y-2">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <div className="relative">
                        <div
                            className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md border shadow-sm"
                            style={{ backgroundColor: currentHex }}
                        />
                        <Input
                            value={value}
                            onChange={handleInputChange}
                            placeholder={placeholder}
                            className="pl-12 pr-10 cursor-pointer"
                            onClick={() => setOpen(true)}
                        />
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    </div>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="start">
                    <div className="p-3 border-b">
                        <Input
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Buscar cor..."
                            className="h-9"
                            autoFocus
                        />
                    </div>
                    <div className="max-h-[300px] overflow-y-auto p-2">
                        {Object.entries(filteredGroups).map(([grupo, cores]) => (
                            <div key={grupo} className="mb-3">
                                <Label className="text-xs text-gray-500 px-2 mb-1 block">
                                    {grupo}
                                </Label>
                                <div className="grid grid-cols-4 gap-1">
                                    {cores.map((cor) => {
                                        const isSelected = value?.toLowerCase() === cor.nome.toLowerCase();
                                        return (
                                            <button
                                                key={cor.nome}
                                                type="button"
                                                onClick={() => handleSelectColor(cor)}
                                                className={cn(
                                                    "flex flex-col items-center p-2 rounded-lg hover:bg-gray-100 transition-colors",
                                                    isSelected && "bg-green-50 ring-2 ring-green-500"
                                                )}
                                                title={cor.nome}
                                            >
                                                <div
                                                    className={cn(
                                                        "w-8 h-8 rounded-md border-2 shadow-sm relative",
                                                        cor.hex === '#FFFFFF' && "border-gray-300"
                                                    )}
                                                    style={{ backgroundColor: cor.hex }}
                                                >
                                                    {isSelected && (
                                                        <Check className={cn(
                                                            "w-4 h-4 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
                                                            cor.hex === '#FFFFFF' || cor.hex === '#FAF9F6' || cor.hex === '#F5F5DC' || cor.hex === '#D3D3D3'
                                                                ? "text-gray-800"
                                                                : "text-white"
                                                        )} />
                                                    )}
                                                </div>
                                                <span className="text-xs mt-1 text-center leading-tight truncate w-full">
                                                    {cor.nome}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}

                        {Object.keys(filteredGroups).length === 0 && (
                            <div className="text-center py-4 text-gray-500 text-sm">
                                Nenhuma cor encontrada
                            </div>
                        )}
                    </div>

                    {/* Cor customizada */}
                    <div className="p-3 border-t bg-gray-50">
                        <Label className="text-xs text-gray-500 mb-2 block">
                            Cor personalizada
                        </Label>
                        <div className="flex gap-2 items-center">
                            <input
                                type="color"
                                value={currentHex}
                                onChange={(e) => onHexChange(e.target.value)}
                                className="w-10 h-10 rounded cursor-pointer border-0"
                            />
                            <Input
                                value={hexValue || currentHex}
                                onChange={(e) => onHexChange(e.target.value)}
                                placeholder="#FFFFFF"
                                className="flex-1 h-9 font-mono text-sm"
                            />
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
}

// Exporta a paleta para uso em outros lugares
export { CORES_MOVEIS };
