#!/usr/bin/env python3
# Minimal Python ingestion: walk .py files, parse via 'ast', emit NDJSON for symbols and edges

import os, sys, ast, json, hashlib

def make_id(parts):
    h = hashlib.sha1()
    for p in parts:
        h.update(str(p if p is not None else '').encode('utf-8'))
    return h.hexdigest()[:16]

def norm_path(p):
    return p.replace('\\', '/')

def range_of(node):
    # ast in Python gives only lineno/col_offset; end positions added in 3.8+ but may be None
    sl = getattr(node, 'lineno', 1)
    sc = getattr(node, 'col_offset', 0) + 1
    el = getattr(node, 'end_lineno', sl)
    ec = getattr(node, 'end_col_offset', sc)
    return dict(startLine=sl, startCol=sc, endLine=el, endCol=ec)

def emit(obj):
    sys.stdout.write(json.dumps(obj, ensure_ascii=False) + '\n')

def ingest_dir(root):
    for dirpath, dirnames, filenames in os.walk(root):
        if 'node_modules' in dirnames: dirnames.remove('node_modules')
        if '.git' in dirnames: dirnames.remove('.git')
        for fn in filenames:
            if fn.endswith('.py'):
                path = os.path.join(dirpath, fn)
                ingest_file(root, path)

def ingest_file(root, path):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            src = f.read()
    except Exception:
        return
    try:
        tree = ast.parse(src, filename=path)
    except SyntaxError:
        return

    file_rel = norm_path(os.path.relpath(path, root))
    mod_id = make_id(['module','python',file_rel,1,1])
    mod_sym = dict(
        id=mod_id, kind='module', name=file_rel, file=file_rel,
        range=dict(startLine=1,startCol=1,endLine=1,endCol=1),
        language='python'
    )
    emit({ "type": "symbol", "symbol": mod_sym })

    name_index = {}

    class Visitor(ast.NodeVisitor):
        def visit_FunctionDef(self, node):
            name = node.name
            sym = dict(
                id=make_id(['function',name,file_rel,node.lineno,node.col_offset+1]),
                kind='function',
                name=name, file=file_rel, range=range_of(node), language='python'
            )
            emit({ "type": "symbol", "symbol": sym })
            emit({ "type": "edge", "edge": { "src": mod_id, "type": "defines", "dst": sym["id"] } })
            name_index.setdefault(name, []).append(sym)
            self.generic_visit(node)

        def visit_ClassDef(self, node):
            name = node.name
            klass = dict(
                id=make_id(['class',name,file_rel,node.lineno,node.col_offset+1]),
                kind='class',
                name=name, file=file_rel, range=range_of(node), language='python'
            )
            emit({ "type": "symbol", "symbol": klass })
            emit({ "type": "edge", "edge": { "src": mod_id, "type": "defines", "dst": klass["id"] } })
            # methods
            for b in node.body:
                if isinstance(b, ast.FunctionDef):
                    mname = b.name
                    msym = dict(
                        id=make_id(['method',mname,file_rel,b.lineno,b.col_offset+1]),
                        kind='method',
                        name=mname, file=file_rel, range=range_of(b), language='python', parentId=klass["id"]
                    )
                    emit({ "type": "symbol", "symbol": msym })
                    emit({ "type": "edge", "edge": { "src": klass["id"], "type": "member_of", "dst": msym["id"] } })
                    name_index.setdefault(mname, []).append(msym)
            self.generic_visit(node)

        def visit_Assign(self, node):
            # basic variable symbol for left-most Name
            if node.targets and isinstance(node.targets[0], ast.Name):
                v = node.targets[0]
                vname = v.id
                sym = dict(
                    id=make_id(['variable',vname,file_rel,v.lineno,v.col_offset+1]),
                    kind='variable', name=vname, file=file_rel, range=range_of(v), language='python'
                )
                emit({ "type": "symbol", "symbol": sym })
                emit({ "type": "edge", "edge": { "src": mod_id, "type": "defines", "dst": sym["id"] } })
                name_index.setdefault(vname, []).append(sym)
            self.generic_visit(node)

        def visit_Import(self, node):
            for alias in node.names:
                spec = alias.name
                # pseudo-module symbol per spec
                pm_id = make_id(['module',spec,spec,1,1])
                emit({ "type": "symbol", "symbol": dict(
                    id=pm_id, kind='module', name=spec, file=spec,
                    range=dict(startLine=1,startCol=1,endLine=1,endCol=1), language='python'
                )})
                emit({ "type": "edge", "edge": { "src": mod_id, "type": "import", "dst": pm_id } })

        def visit_ImportFrom(self, node):
            spec = (node.module or '') + ('.' * (node.level or 0))
            pm_id = make_id(['module',spec,spec,1,1])
            emit({ "type": "symbol", "symbol": dict(
                id=pm_id, kind='module', name=spec, file=spec,
                range=dict(startLine=1,startCol=1,endLine=1,endCol=1), language='python'
            )})
            emit({ "type": "edge", "edge": { "src": mod_id, "type": "import", "dst": pm_id } })

        def visit_Call(self, node):
            # try to extract function name
            name = None
            if isinstance(node.func, ast.Name):
                name = node.func.id
            elif isinstance(node.func, ast.Attribute):
                name = node.func.attr
            if name:
                # naive resolution by name within the same file first is deferred to JS orchestrator
                emit({ "type": "call", "calleeName": name, "file": file_rel, "modId": mod_id })
            self.generic_visit(node)

    Visitor().visit(tree)
    # print a per-file name index to help JS resolution
    emit({ "type": "name_index", "file": file_rel, "index": name_index })

def main():
    if len(sys.argv) < 2:
        print("usage: ingest_py.py <target_dir>", file=sys.stderr)
        sys.exit(2)
    ingest_dir(sys.argv[1])

if __name__ == '__main__':
    main()
