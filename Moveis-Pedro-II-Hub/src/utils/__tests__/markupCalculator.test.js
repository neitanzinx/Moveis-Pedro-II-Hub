import { describe, it, expect } from 'vitest';
import {
    getMarginTarget,
    getStockAdjustment,
    getTaxRate,
    calculateSuggestedMarkup,
    calculateMarkupDetails
} from '../markupCalculator';

describe('markupCalculator', () => {
    // Standard product for testing
    const product = {
        preco_custo: 100,
        categoria: 'Sofa', // margin 0.30
        quantidade_estoque: 10,
        estoque_minimo: 10, // Stock neutral
        fornecedor_id: 1 // Should be ignored now
    };

    describe('getMarginTarget', () => {
        it('returns correct margin for known categories', () => {
            expect(getMarginTarget('Sofa')).toBe(0.30);
            expect(getMarginTarget('Cama')).toBe(0.25);
        });

        it('returns default margin for unknown category', () => {
            expect(getMarginTarget('Unknown')).toBe(0.25);
        });
    });

    describe('getStockAdjustment', () => {
        it('returns 1.0 for neutral stock (equal to min)', () => {
            const result = getStockAdjustment({
                quantidade_estoque: 10,
                estoque_minimo: 10
            });
            expect(result).toBe(1.0);
        });

        it('returns 1.0 for undefined min stock', () => {
            const result = getStockAdjustment({
                quantidade_estoque: 100
            });
            expect(result).toBe(1.0);
        });

        it('increases factor for stock shortage (scarcity)', () => {
            // Stock 0 of min 10 -> Max increase
            const result = getStockAdjustment({
                quantidade_estoque: 0,
                estoque_minimo: 10
            });
            // Default scarcity logic: 1.0 + min(ratio * 0.10, 0.10)
            // Ratio = (10-0)/10 = 1.0
            // Result = 1.10
            expect(result).toBeCloseTo(1.10);
        });

        it('decreases factor for stock excess', () => {
            // Stock 40 of min 10 (> 3x) -> Decrease
            const result = getStockAdjustment({
                quantidade_estoque: 40,
                estoque_minimo: 10
            });
            // Default excess logic: 0.95
            expect(result).toBe(0.95);
        });
    });

    describe('getTaxRate', () => {
        it('returns 18% tax rate', () => {
            expect(getTaxRate({})).toBe(0.18);
        });
    });

    describe('calculateSuggestedMarkup', () => {
        it('returns 0 for invalid cost', () => {
            expect(calculateSuggestedMarkup({ preco_custo: 0, categoria: 'Sofa' })).toBe(0);
            expect(calculateSuggestedMarkup({ preco_custo: -100, categoria: 'Sofa' })).toBe(0);
        });

        it('calculates correct markup for basic product', () => {
            // Custo 100
            // Margem 30% -> 130
            // Stock Adj 1.0 -> 130
            // Tax 18% -> 130 * 1.18 = 153.40
            const result = calculateSuggestedMarkup(product);
            expect(result).toBeCloseTo(153.40);
        });

        it('reduces markup for high stock (clearance)', () => {
            const highStockProduct = {
                ...product,
                quantidade_estoque: 50, // > 3x min (10)
                estoque_minimo: 10
            };
            // 100 * 1.30 = 130
            // Stock Adj 0.95 -> 123.5
            // Tax 1.18 -> 145.73
            const result = calculateSuggestedMarkup(highStockProduct);
            expect(result).toBeCloseTo(145.73);
        });

        it('increases markup for low stock (scarcity)', () => {
            const lowStockProduct = {
                ...product,
                quantidade_estoque: 0,
                estoque_minimo: 10
            };
            // 100 * 1.30 = 130
            // Stock Adj 1.10 -> 143.0
            // Tax 1.18 -> 168.74
            const result = calculateSuggestedMarkup(lowStockProduct);
            expect(result).toBeCloseTo(168.74);
        });
    });

    describe('calculateMarkupDetails', () => {
        it('returns null for zero cost', () => {
            expect(calculateMarkupDetails({ preco_custo: 0 })).toBeNull();
        });

        it('returns breakdown with all steps', () => {
            const details = calculateMarkupDetails(product);

            expect(details).not.toBeNull();
            expect(details.custo).toBe(100);
            expect(details.categoria).toBe('Sofa');

            // Expected steps: Margem, Estoque, Impostos (3 steps now, removed Supplier)
            expect(details.steps).toHaveLength(3);

            expect(details.steps[0].label).toContain('Margem');
            expect(details.steps[1].label).toContain('Estoque');
            expect(details.steps[2].label).toContain('Impostos');
        });

        it('final price matches calculateSuggestedMarkup', () => {
            const suggestion = calculateSuggestedMarkup(product);
            const details = calculateMarkupDetails(product);

            expect(details.precoFinal).toBe(suggestion);
        });
    });
});
