export type Range = { startLine: number; startCol: number; endLine: number; endCol: number };

export type SymbolKind = 'function'|'class'|'method'|'variable'|'module';
export type Language = 'typescript'|'python';

export type SymbolRec = {
  id: string;
  kind: SymbolKind;
  name: string;
  file: string;
  range: Range;
  language: Language;
  signature?: string;
  parentId?: string | null;
};

export type EdgeType = 'defines'|'call'|'import'|'member_of';

export type EdgeRec = {
  src: string;
  type: EdgeType;
  dst: string;
};

export type Graph = {
  symbols: SymbolRec[];
  edges: EdgeRec[];
};
