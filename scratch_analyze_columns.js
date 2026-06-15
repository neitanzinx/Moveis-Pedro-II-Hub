import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: './.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, anonKey);

// 1. Fetch table mapping from supabase.js
const tableMapFile = fs.readFileSync(path.join(process.cwd(), 'src/lib/supabase.js'), 'utf8');
const tableMapRegex = /const tableMap = {([\s\S]*?)};/;
const tableMapMatch = tableMapFile.match(tableMapRegex);
const tableMap = {};
if (tableMapMatch) {
  const lines = tableMapMatch[1].split('\n');
  for (const line of lines) {
    const parts = line.split(':');
    if (parts.length === 2) {
      const entity = parts[0].trim();
      const table = parts[1].replace(/['",]/g, '').trim();
      if (entity && table && !entity.startsWith('//')) {
        tableMap[entity] = table;
      }
    }
  }
}

// 2. Fetch all files in src/ recursively
function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllFiles(filePath, fileList);
    } else if (filePath.endsWith('.js') || filePath.endsWith('.jsx')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}
const allJsFiles = getAllFiles(path.join(process.cwd(), 'src'));

// 3. Extract columns for each table
const tableColumnsSent = {}; // { tableName: Set<string> }
function addColumn(table, col) {
  if (!tableColumnsSent[table]) tableColumnsSent[table] = new Set();
  tableColumnsSent[table].add(col);
}

const extractKeys = (objStr) => {
  const keys = new Set();
  const regex = /([a-zA-Z_$][0-9a-zA-Z_$]*)\s*:/g;
  let match;
  while ((match = regex.exec(objStr)) !== null) {
    keys.add(match[1]);
  }
  return Array.from(keys);
};

for (const file of allJsFiles) {
  const content = fs.readFileSync(file, 'utf8');
  
  const base44Regex = /base44\.entities\.([A-Za-z0-9_]+)\.(create|update|upsert)\s*\(([\s\S]*?)\)/g;
  let match;
  while ((match = base44Regex.exec(content)) !== null) {
    const entity = match[1];
    const tableName = tableMap[entity] || (entity.toLowerCase() + 's');
    const argsStr = match[3];
    const objMatch = argsStr.match(/\{([\s\S]*)\}/);
    if (objMatch) {
      const keys = extractKeys(objMatch[1]);
      keys.forEach(k => addColumn(tableName, k));
    }
  }

  const supabaseRegex = /supabase\s*\.from\s*\(\s*['"]([A-Za-z0-9_]+)['"]\s*\)\s*\.(insert|update|upsert)\s*\(\s*(\[|\{)([\s\S]*?)(\]|\})\s*\)/g;
  while ((match = supabaseRegex.exec(content)) !== null) {
    const tableName = match[1];
    const argsStr = match[4];
    const keys = extractKeys(argsStr);
    keys.forEach(k => addColumn(tableName, k));
  }
}

const ignoreList = new Set(['id', 'created_at', 'updated_at', 'deleted_at', 'http', 'https', 'return', 'if', 'else', 'const', 'let', 'var', 'await', 'async', 'true', 'false', 'null', 'undefined', 'then', 'catch', 'map', 'filter', 'reduce']);

// 4. Test columns against Supabase database via REST
async function analyze() {
  console.log('Testing extracted columns against actual Supabase schema...');
  const report = [];

  for (const [table, columnsSet] of Object.entries(tableColumnsSent)) {
    const sentColumns = Array.from(columnsSet).filter(c => !ignoreList.has(c) && !c.startsWith('//') && c.length > 2);
    if (sentColumns.length === 0) continue;

    const missingColumns = [];
    let tableExists = true;

    // First check if table exists by selecting id or limit 1
    const { error: tableError } = await supabase.from(table).select('*').limit(1);
    if (tableError && (tableError.message.includes('relation') && tableError.message.includes('does not exist'))) {
      report.push(`⚠️ TABLE DOES NOT EXIST: ${table}`);
      tableExists = false;
      continue;
    }

    if (!tableExists) continue;

    for (const col of sentColumns) {
      const { error } = await supabase.from(table).select(`"${col}"`).limit(1);
      
      if (error && (error.message.includes('Could not find the') || error.message.includes('column') || error.message.includes('not exist'))) {
        missingColumns.push(col);
      }
    }

    if (missingColumns.length > 0) {
      report.push(`❌ Table ${table} might be missing columns: ${missingColumns.join(', ')}`);
    }
  }

  if (report.length === 0) {
    console.log('✅ No missing columns detected based on heuristic scan!');
  } else {
    console.log('\n--- ANALYSIS REPORT ---');
    console.log(report.join('\n'));
    console.log('-----------------------\nNote: Some results might be false positives if the code parser picked up variable assignments instead of column names.');
  }
}

analyze();
