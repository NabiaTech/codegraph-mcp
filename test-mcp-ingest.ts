#!/usr/bin/env bun
/**
 * Test script to simulate MCP graph_ingest tool calls
 * This tests the ingestion functionality that the MCP tool uses
 */

import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

const REGISTRY_DIR = path.join(process.env.HOME || '/root', '.local/state/nabi/codegraph');
const REGISTRY_FILE = path.join(REGISTRY_DIR, 'registry.json');

function loadRegistry() {
  if (!fs.existsSync(REGISTRY_FILE)) {
    return { graphs: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8'));
  } catch {
    return { graphs: [] };
  }
}

function saveRegistry(reg: any) {
  fs.mkdirSync(REGISTRY_DIR, { recursive: true });
  fs.writeFileSync(REGISTRY_FILE, JSON.stringify(reg, null, 2), 'utf8');
}

function loadGraph(graphFile: string) {
  try {
    const content = fs.readFileSync(graphFile, 'utf8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function testIngest(target: string, id?: string) {
  const targetPath = path.resolve(target.replace(/^~/, process.env.HOME || '/root'));

  if (!fs.existsSync(targetPath)) {
    console.error(`Error: target directory does not exist: ${targetPath}`);
    return false;
  }

  const graphId = id || path.basename(targetPath);
  const outputDir = path.join(REGISTRY_DIR, 'graphs', graphId);
  fs.mkdirSync(outputDir, { recursive: true });

  const ingestPath = path.resolve(__dirname, './src/ingest/make_graph.ts');
  const cmd = `bun run "${ingestPath}" --target "${targetPath}" --output "${outputDir}" 2>&1`;

  console.log(`[test] Running ingest for ${graphId}: ${cmd}`);
  let output = '';
  try {
    output = execSync(cmd, { encoding: 'utf8', timeout: 300000, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (execErr: any) {
    const stdout = execErr.stdout ? execErr.stdout.toString('utf8') : '';
    const stderr = execErr.stderr ? execErr.stderr.toString('utf8') : '';
    const fullOutput = stdout + stderr;
    console.error(`Ingestion failed!\n\nCommand: ${cmd}\n\nOutput:\n${fullOutput}\n\nError: ${execErr.message}`);
    return false;
  }

  const graphFile = path.join(outputDir, 'graph.json');
  const newGraph = loadGraph(graphFile);
  if (!newGraph) {
    console.error(`Ingestion completed but failed to load result graph`);
    return false;
  }

  // Register in the registry
  const reg = loadRegistry();
  const existing = reg.graphs.findIndex((g: any) => g.id === graphId);
  const entry = {
    id: graphId,
    path: graphFile,
    target: targetPath,
    size: newGraph.symbols.length,
    timestamp: new Date().toISOString()
  };

  if (existing >= 0) {
    reg.graphs[existing] = entry;
  } else {
    reg.graphs.push(entry);
  }
  saveRegistry(reg);

  console.log(`✅ ${graphId}: ${newGraph.symbols.length} symbols, ${newGraph.edges.length} edges`);
  console.log(`   Output: ${output.split('\n').filter(l => l.includes('[ingest]')).join('\n   ')}`);
  return true;
}

async function main() {
  const targets = [
    { path: '~/nabia/core', id: 'core' },
    { path: '~/nabia/platform', id: 'platform' },
    { path: '~/nabia/memchain', id: 'memchain' }
  ];

  console.log('Testing MCP graph_ingest functionality on three directories...\n');

  for (const { path: target, id } of targets) {
    const success = await testIngest(target, id);
    if (!success) {
      console.error(`❌ Failed to ingest ${id}`);
    }
    console.log('');
  }

  // Show final registry
  const reg = loadRegistry();
  console.log('\n📋 Final registry:');
  console.log(JSON.stringify(reg, null, 2));
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
