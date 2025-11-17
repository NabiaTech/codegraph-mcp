/**
 * Test for stream analyzer
 * Run with: bun test/test_stream_analyzer.ts
 */

import { StreamAnalyzer, type WorkStream } from '../src/mcp/stream_analyzer.js';

// Example workstreams from the spec
const testStreams: WorkStream[] = [
  {
    name: 'Document FSM Recovery',
    status: 'complete',
    completion: 100,
    deliverables: ['state_tribune.py', 'docs', 'tests'],
    summary: 'FSM for multi-agent coordination',
  },
  {
    name: 'FSM → nabi-mcp Integration',
    status: 'planned',
    completion: 40,
    next_steps: ['Create SurrealDB schema', 'Implement MCP calls'],
    summary: 'Federated sync bridge',
  },
  {
    name: 'dag-tui Canvas',
    status: 'in-progress',
    completion: 60,
    next_steps: ['Add data pipeline', 'Connect to nabi-mcp'],
    summary: 'Terminal UI visualization',
  },
  {
    name: 'nabi-mcp Backend',
    status: 'complete',
    completion: 100,
    summary: 'Knowledge graph backend',
  },
  {
    name: 'Intelligence Layer',
    status: 'blocked',
    completion: 0,
    blockers: ['No implementation'],
    next_steps: ['Implement scoring algorithm'],
    summary: 'Precedence/decay/proximity scoring',
  },
  {
    name: 'Sprint Summary System',
    status: 'planned',
    completion: 0,
    next_steps: ['Design synthesis algorithm'],
    summary: 'Multi-source synthesis',
  },
];

const context = {
  date: '2025-10-27',
  theme: 'TUI-based cognitive visualization',
  goal: 'Visualize federated knowledge with intelligence',
};

console.log('Testing StreamAnalyzer...\n');

const result = StreamAnalyzer.analyze(testStreams, context);

console.log('=== Analysis Result ===\n');
console.log('Recommendations:');
result.recommendations.forEach((rec, i) => {
  console.log(`${i + 1}. ${rec}`);
});

console.log('\n=== Tactical Next Steps ===');
console.log('Quick Win:', result.synthesis.tactical_next_steps.quick_win);
console.log('Foundation:', result.synthesis.tactical_next_steps.foundation);
console.log('Infrastructure:', result.synthesis.tactical_next_steps.infrastructure);

console.log('\n=== Connections Detected ===');
console.log(`Found ${result.synthesis.connections.length} connections`);
result.synthesis.connections.forEach(conn => {
  console.log(`- ${conn.from} → ${conn.to} (${conn.type})`);
});

console.log('\n=== Missing Layers ===');
console.log(`Found ${result.synthesis.missing_layers.length} missing/incomplete layers`);
result.synthesis.missing_layers.forEach(m => {
  console.log(`- ${m.layer}: ${m.description}`);
});

console.log('\n=== Critical Path ===');
console.log(`${result.synthesis.critical_path.length} milestones`);
result.synthesis.critical_path.forEach(item => {
  console.log(`- ${item.milestone} (${item.duration})`);
});

console.log('\n=== Full Visual Map ===');
console.log(result.visual_map);

console.log('\n✅ Test completed successfully!');
