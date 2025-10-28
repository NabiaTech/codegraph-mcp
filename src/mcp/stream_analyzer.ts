/**
 * Parallel Stream Analyzer
 * Minimal viable implementation for analyzing and visualizing parallel workstreams
 */

export type StreamStatus = 'complete' | 'in-progress' | 'planned' | 'blocked';

export interface WorkStream {
  name: string;
  status: StreamStatus;
  summary?: string;
  deliverables?: string[];
  location?: string;
  completion?: number;
  next_steps?: string[];
  blockers?: string[];
}

export interface StreamContext {
  date?: string;
  theme?: string;
  goal?: string;
}

export interface Connection {
  from: string;
  to: string;
  type: 'data_flow' | 'dependency' | 'integration' | 'synthesis';
  description: string;
}

export interface MissingLayer {
  layer: string;
  description: string;
  blocks: string[];
}

export interface CriticalPathItem {
  milestone: string;
  duration: string;
  blockers: string[];
  enables: string[];
}

export interface TacticalNextSteps {
  quick_win?: string;
  foundation?: string;
  infrastructure?: string;
}

export interface AnalysisResult {
  synthesis: {
    architecture_map: string;
    connections: Connection[];
    missing_layers: MissingLayer[];
    critical_path: CriticalPathItem[];
    tactical_next_steps: TacticalNextSteps;
  };
  visual_map: string;
  recommendations: string[];
}

export class StreamAnalyzer {
  /**
   * Analyze parallel workstreams and generate synthesis
   */
  static analyze(streams: WorkStream[], context?: StreamContext): AnalysisResult {
    const normalized = this.normalizeStreams(streams);
    const connections = this.detectConnections(normalized);
    const layers = this.mapToLayers(normalized);
    const missing = this.findMissingLayers(layers, normalized);
    const criticalPath = this.calculateCriticalPath(normalized, connections);
    const tactical = this.generateTacticalSteps(normalized, missing);
    const visualMap = this.generateVisualMap(layers, normalized, connections, missing, criticalPath, context);
    const recommendations = this.generateRecommendations(normalized, missing, criticalPath);

    return {
      synthesis: {
        architecture_map: this.generateArchitectureMap(layers, normalized),
        connections,
        missing_layers: missing,
        critical_path: criticalPath,
        tactical_next_steps: tactical,
      },
      visual_map: visualMap,
      recommendations,
    };
  }

  private static normalizeStreams(streams: WorkStream[]): WorkStream[] {
    return streams.map(s => ({
      ...s,
      completion: s.completion ?? (s.status === 'complete' ? 100 : s.status === 'blocked' ? 0 : 50),
      next_steps: s.next_steps ?? [],
      blockers: s.blockers ?? [],
      deliverables: s.deliverables ?? [],
    }));
  }

  private static detectConnections(streams: WorkStream[]): Connection[] {
    const connections: Connection[] = [];

    // Simple heuristic: detect data flow based on naming patterns
    for (let i = 0; i < streams.length; i++) {
      for (let j = i + 1; j < streams.length; j++) {
        const a = streams[i];
        const b = streams[j];

        // Check for integration patterns (A → B in name)
        if (a.name.toLowerCase().includes('→') || a.name.toLowerCase().includes('integration')) {
          connections.push({
            from: a.name,
            to: b.name,
            type: 'integration',
            description: `${a.name} integrates with ${b.name}`,
          });
        }

        // Check for dependency (B blocked by A)
        if (b.blockers && b.blockers.some(blocker => blocker.toLowerCase().includes(a.name.toLowerCase()))) {
          connections.push({
            from: a.name,
            to: b.name,
            type: 'dependency',
            description: `${b.name} depends on ${a.name}`,
          });
        }
      }
    }

    return connections;
  }

  private static mapToLayers(streams: WorkStream[]): Map<string, WorkStream[]> {
    const layers = new Map<string, WorkStream[]>();

    for (const stream of streams) {
      const layer = this.inferLayer(stream);
      const existing = layers.get(layer) || [];
      existing.push(stream);
      layers.set(layer, existing);
    }

    return layers;
  }

  private static inferLayer(stream: WorkStream): string {
    const name = stream.name.toLowerCase();

    if (name.includes('tui') || name.includes('visual') || name.includes('ui')) {
      return 'Visualization';
    }
    if (name.includes('intelligence') || name.includes('scoring') || name.includes('algorithm')) {
      return 'Intelligence';
    }
    if (name.includes('mcp') || name.includes('graph') || name.includes('database') || name.includes('surrealdb')) {
      return 'Knowledge Graph';
    }
    if (name.includes('adapter') || name.includes('bridge') || name.includes('integration')) {
      return 'Federation Adapter';
    }
    if (name.includes('fsm') || name.includes('source') || name.includes('cli') || name.includes('git')) {
      return 'Source Systems';
    }

    return 'Other';
  }

  private static findMissingLayers(layers: Map<string, WorkStream[]>, streams: WorkStream[]): MissingLayer[] {
    const missing: MissingLayer[] = [];
    const standardLayers = ['Source Systems', 'Federation Adapter', 'Knowledge Graph', 'Intelligence', 'Visualization'];

    for (const layer of standardLayers) {
      const layerStreams = layers.get(layer) || [];
      const incomplete = layerStreams.filter(s => s.status === 'blocked' || s.status === 'planned' || (s.completion || 0) < 100);

      if (layerStreams.length === 0) {
        missing.push({
          layer,
          description: `${layer} layer not implemented`,
          blocks: ['All downstream layers'],
        });
      } else if (incomplete.length > 0) {
        missing.push({
          layer,
          description: `${layer} layer incomplete (${incomplete.length} blocked/planned)`,
          blocks: incomplete.map(s => s.name),
        });
      }
    }

    return missing;
  }

  private static calculateCriticalPath(streams: WorkStream[], connections: Connection[]): CriticalPathItem[] {
    const path: CriticalPathItem[] = [];

    // Find blocked streams first
    const blocked = streams.filter(s => s.status === 'blocked');
    for (const stream of blocked) {
      path.push({
        milestone: stream.name,
        duration: this.estimateDuration(stream),
        blockers: stream.blockers || [],
        enables: this.findDependents(stream.name, connections),
      });
    }

    // Then planned streams
    const planned = streams.filter(s => s.status === 'planned');
    for (const stream of planned) {
      path.push({
        milestone: stream.name,
        duration: this.estimateDuration(stream),
        blockers: stream.blockers || [],
        enables: this.findDependents(stream.name, connections),
      });
    }

    return path;
  }

  private static estimateDuration(stream: WorkStream): string {
    const completion = stream.completion || 0;
    if (completion >= 80) return '1-2 hours';
    if (completion >= 40) return '2-4 hours';
    return '4-8 hours';
  }

  private static findDependents(streamName: string, connections: Connection[]): string[] {
    return connections
      .filter(c => c.from === streamName)
      .map(c => c.to);
  }

  private static generateTacticalSteps(streams: WorkStream[], missing: MissingLayer[]): TacticalNextSteps {
    const steps: TacticalNextSteps = {};

    // Quick win: find highest completion in-progress stream
    const inProgress = streams.filter(s => s.status === 'in-progress').sort((a, b) => (b.completion || 0) - (a.completion || 0));
    if (inProgress.length > 0 && inProgress[0].next_steps && inProgress[0].next_steps.length > 0) {
      steps.quick_win = `Complete ${inProgress[0].name}: ${inProgress[0].next_steps[0]}`;
    }

    // Foundation: unblock critical missing layer
    const critical = missing.filter(m => m.description.includes('not implemented'));
    if (critical.length > 0) {
      steps.foundation = `Implement ${critical[0].layer} layer`;
    }

    // Infrastructure: planned streams
    const planned = streams.filter(s => s.status === 'planned');
    if (planned.length > 0) {
      steps.infrastructure = `Build ${planned[0].name}`;
    }

    return steps;
  }

  private static generateArchitectureMap(layers: Map<string, WorkStream[]>, streams: WorkStream[]): string {
    const standardLayers = ['Visualization', 'Intelligence', 'Knowledge Graph', 'Federation Adapter', 'Source Systems'];
    let map = '```\n';

    for (const layer of standardLayers) {
      const layerStreams = layers.get(layer) || [];
      const complete = layerStreams.filter(s => s.status === 'complete').length;
      const total = layerStreams.length;
      const pct = total > 0 ? Math.round((complete / total) * 100) : 0;
      const status = pct === 100 ? '✅' : pct > 0 ? '🟡' : '❌';

      map += `┌${'─'.repeat(65)}┐\n`;
      map += `│ ${layer.toUpperCase().padEnd(45)} ${status} ${pct}% │\n`;

      if (layerStreams.length > 0) {
        for (const stream of layerStreams) {
          const statusIcon = stream.status === 'complete' ? '✅' : stream.status === 'blocked' ? '❌' : '🟡';
          map += `│ ├─ ${stream.name.padEnd(40)} ${statusIcon.padEnd(15)} │\n`;
        }
      } else {
        map += `│ ├─ ${'Not implemented'.padEnd(54)} │\n`;
      }

      map += `└${'─'.repeat(65)}┘\n`;
      if (layer !== 'Source Systems') {
        map += `${' '.repeat(32)}↓\n`;
      }
    }

    map += '```';
    return map;
  }

  private static generateVisualMap(
    layers: Map<string, WorkStream[]>,
    streams: WorkStream[],
    connections: Connection[],
    missing: MissingLayer[],
    criticalPath: CriticalPathItem[],
    context?: StreamContext
  ): string {
    let md = '# Parallel Workstreams Analysis\n\n';

    if (context) {
      if (context.date) md += `**Date**: ${context.date}\n`;
      if (context.theme) md += `**Theme**: ${context.theme}\n`;
      if (context.goal) md += `**Goal**: ${context.goal}\n`;
      md += '\n---\n\n';
    }

    md += '## Architecture Map\n\n';
    md += this.generateArchitectureMap(layers, streams);
    md += '\n\n---\n\n';

    if (connections.length > 0) {
      md += '## Connection Analysis\n\n';
      for (const conn of connections) {
        md += `- **${conn.from}** → **${conn.to}** (${conn.type})\n`;
        md += `  - ${conn.description}\n\n`;
      }
      md += '---\n\n';
    }

    if (missing.length > 0) {
      md += '## Missing/Incomplete Layers\n\n';
      for (const m of missing) {
        md += `### ${m.layer}\n`;
        md += `${m.description}\n\n`;
        md += `**Blocks**: ${m.blocks.join(', ')}\n\n`;
      }
      md += '---\n\n';
    }

    if (criticalPath.length > 0) {
      md += '## Critical Path\n\n';
      for (const item of criticalPath) {
        md += `### ${item.milestone}\n`;
        md += `- **Duration**: ${item.duration}\n`;
        if (item.blockers.length > 0) md += `- **Blockers**: ${item.blockers.join(', ')}\n`;
        if (item.enables.length > 0) md += `- **Enables**: ${item.enables.join(', ')}\n`;
        md += '\n';
      }
      md += '---\n\n';
    }

    md += '## Stream Status\n\n';
    md += '| Stream | Status | Completion | Next Step |\n';
    md += '|--------|--------|------------|-----------|\n';
    for (const s of streams) {
      const statusIcon = s.status === 'complete' ? '✅' : s.status === 'blocked' ? '❌' : '🟡';
      const nextStep = s.next_steps && s.next_steps.length > 0 ? s.next_steps[0] : '-';
      md += `| ${s.name} | ${statusIcon} ${s.status} | ${s.completion}% | ${nextStep} |\n`;
    }

    return md;
  }

  private static generateRecommendations(streams: WorkStream[], missing: MissingLayer[], criticalPath: CriticalPathItem[]): string[] {
    const recs: string[] = [];

    // Overall progress
    const complete = streams.filter(s => s.status === 'complete').length;
    const total = streams.length;
    const pct = Math.round((complete / total) * 100);
    recs.push(`Overall progress: ${pct}% (${complete}/${total} streams complete)`);

    // Critical blockers
    const blocked = streams.filter(s => s.status === 'blocked');
    if (blocked.length > 0) {
      recs.push(`Critical: ${blocked.length} blocked stream(s) - ${blocked.map(s => s.name).join(', ')}`);
    }

    // Missing layers
    const criticalMissing = missing.filter(m => m.description.includes('not implemented'));
    if (criticalMissing.length > 0) {
      recs.push(`Priority: Implement ${criticalMissing[0].layer} layer to unblock downstream work`);
    }

    // Next actionable step
    if (criticalPath.length > 0) {
      recs.push(`Next step: ${criticalPath[0].milestone} (${criticalPath[0].duration})`);
    }

    return recs;
  }
}
