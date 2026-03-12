import { adicionarDias } from './src/utils/dateUtils.js';

function assert(condition, message) {
    if (!condition) {
        throw new Error(message || "Assertion failed");
    }
}

console.log("--- Testing dateUtils.js ---");

// Feb 27, 2026 is Friday
const friday = new Date(2026, 1, 27);

// Friday + 1 business day = Monday (March 2nd)
const monday = adicionarDias(friday, 1, 'uteis');
console.log(`Friday + 1 business day: ${monday.toDateString()}`);
assert(monday.getDay() === 1, "Should be Monday");
assert(monday.getMonth() === 2, "Should be March");
assert(monday.getDate() === 2, "Should be 2nd");

// Friday + 5 business days = Friday (March 6th)
const nextFriday = adicionarDias(friday, 5, 'uteis');
console.log(`Friday + 5 business days: ${nextFriday.toDateString()}`);
assert(nextFriday.getDay() === 5, "Should be Friday");
assert(nextFriday.getDate() === 6, "Should be 6th");

// Friday + 1 calendar day = Saturday
const saturday = adicionarDias(friday, 1, 'corridos');
console.log(`Friday + 1 calendar day: ${saturday.toDateString()}`);
assert(saturday.getDay() === 6, "Should be Saturday");

console.log("All tests passed!");
