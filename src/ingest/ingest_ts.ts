import ts from 'typescript';
import path from 'node:path';
import { normalizePath } from '../util/fs.js';
import { makeId } from '../util/hash.js';
import type { EdgeRec, Graph, SymbolRec } from './types.js';

type PartialGraph = { symbols: SymbolRec[]; edges: EdgeRec[] };

function rangeFrom(node: ts.Node, sf: ts.SourceFile) {
  const start = sf.getLineAndCharacterOfPosition(node.getStart(sf));
  const end   = sf.getLineAndCharacterOfPosition(node.getEnd());
  return { startLine: start.line + 1, startCol: start.character + 1, endLine: end.line + 1, endCol: end.character + 1 };
}

function addSymbol(list: SymbolRec[], sym: Omit<SymbolRec, 'id'>) {
  const id = makeId([sym.kind, sym.name, sym.file, sym.range.startLine, sym.range.startCol]);
  const full = { id, ...sym };
  list.push(full);
  return full;
}

export function ingestTypeScriptFiles(files: string[], root: string): Graph {
  const symbols: SymbolRec[] = [];
  const edges: EdgeRec[] = [];
  const byName = new Map<string, SymbolRec[]>();

  // First pass: collect symbols
  for (const f of files) {
    const text = ts.sys.readFile(f, 'utf8') ?? '';
    const sf = ts.createSourceFile(f, text, ts.ScriptTarget.Latest, true);
    const filePath = normalizePath(path.relative(root, f));
    // module symbol per file
    const mod = addSymbol(symbols, {
      kind: 'module',
      name: filePath,
      file: filePath,
      range: { startLine: 1, startCol: 1, endLine: 1, endCol: 1 },
      language: 'typescript',
    });

    function defName(nameNode?: ts.Identifier) {
      return nameNode?.escapedText ? String(nameNode.escapedText) : undefined;
    }

    function visit(node: ts.Node) {
      if (ts.isFunctionDeclaration(node) && node.name) {
        const name = defName(node.name);
        if (name) {
          const sym = addSymbol(symbols, {
            kind: 'function',
            name,
            file: filePath,
            range: rangeFrom(node, sf),
            language: 'typescript',
          });
          edges.push({ src: mod.id, type: 'defines', dst: sym.id });
          // index
          const arr = byName.get(name) ?? [];
          arr.push(sym); byName.set(name, arr);
        }
      }
      if (ts.isClassDeclaration(node) && node.name) {
        const name = defName(node.name);
        if (name) {
          const klass = addSymbol(symbols, {
            kind: 'class',
            name,
            file: filePath,
            range: rangeFrom(node, sf),
            language: 'typescript',
          });
          edges.push({ src: mod.id, type: 'defines', dst: klass.id });
          const arr = byName.get(name) ?? [];
          arr.push(klass); byName.set(name, arr);

          // methods
          node.members?.forEach(m => {
            if (ts.isMethodDeclaration(m) && m.name && ts.isIdentifier(m.name)) {
              const mname = m.name.escapedText.toString();
              const msym = addSymbol(symbols, {
                kind: 'method',
                name: mname,
                file: filePath,
                range: rangeFrom(m, sf),
                language: 'typescript',
                parentId: klass.id,
              });
              edges.push({ src: klass.id, type: 'member_of', dst: msym.id });
              const arr2 = byName.get(mname) ?? [];
              arr2.push(msym); byName.set(mname, arr2);
            }
          });
        }
      }
      if (ts.isVariableDeclaration(node) && node.name && ts.isIdentifier(node.name)) {
        const vname = String(node.name.escapedText);
        const sym = addSymbol(symbols, {
          kind: 'variable',
          name: vname,
          file: filePath,
          range: rangeFrom(node, sf),
          language: 'typescript',
        });
        edges.push({ src: mod.id, type: 'defines', dst: sym.id });
        const arr = byName.get(vname) ?? [];
        arr.push(sym); byName.set(vname, arr);
      }
      ts.forEachChild(node, visit);
    }
    visit(sf);
  }

  // Second pass: imports + calls
  for (const f of files) {
    const text = ts.sys.readFile(f, 'utf8') ?? '';
    const sf = ts.createSourceFile(f, text, ts.ScriptTarget.Latest, true);
    const filePath = normalizePath(path.relative(root, f));
    const moduleSym = symbols.find(s => s.kind === 'module' && s.file === filePath);
    if (!moduleSym) continue;

    function nameFromExpr(expr: ts.Expression): string | undefined {
      if (ts.isIdentifier(expr)) return String(expr.escapedText);
      if (ts.isPropertyAccessExpression(expr)) return expr.name.text;
      if (ts.isCallExpression(expr)) return nameFromExpr(expr.expression);
      return undefined;
    }

    function bestMatch(name: string): string | undefined {
      const arr = byName.get(name);
      if (!arr || arr.length === 0) return undefined;
      // prefer same-file first
      const same = arr.find(s => s.file === filePath);
      return (same ?? arr[0]).id;
    }

    function visit(node: ts.Node) {
      // imports
      if (ts.isImportDeclaration(node)) {
        const spec = (node.moduleSpecifier as ts.StringLiteral).text;
        // represent the imported module as a pseudo-symbol name
        const importSymName = spec;
        let importSym = symbols.find(s => s.kind === 'module' && s.name === importSymName);
        if (!importSym) {
          importSym = {
            id: makeId(['module', importSymName, importSymName, 1, 1]),
            kind: 'module',
            name: importSymName,
            file: importSymName, // non-file modules retain specifier
            range: { startLine: 1, startCol: 1, endLine: 1, endCol: 1 },
            language: 'typescript'
          };
          symbols.push(importSym);
        }
        // edge from file module to imported module
        edges.push({ src: moduleSym.id, type: 'import', dst: importSym.id });
      }

      // calls
      if (ts.isCallExpression(node)) {
        const callee = nameFromExpr(node.expression);
        if (callee) {
          const dst = bestMatch(callee);
          if (dst) {
            edges.push({ src: moduleSym.id, type: 'call', dst });
          }
        }
      }

      ts.forEachChild(node, visit);
    }
    visit(sf);
  }

  return { symbols, edges };
}
