use std::collections::HashMap;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process;
use syn::{visit::Visit, spanned::Spanned};
use serde::{Serialize, Deserialize};
use sha1::{Sha1, Digest};

#[derive(Serialize, Deserialize, Debug, Clone)]
struct Symbol {
    id: String,
    kind: String,
    name: String,
    file: String,
    range: Range,
    language: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    parent_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    signature: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct Range {
    start_line: usize,
    start_col: usize,
    end_line: usize,
    end_col: usize,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct Edge {
    src: String,
    r#type: String,
    dst: String,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(tag = "type")]
enum Record {
    #[serde(rename = "symbol")]
    Symbol { symbol: Symbol },
    #[serde(rename = "edge")]
    Edge { edge: Edge },
    #[serde(rename = "call")]
    Call { callee_name: String, file: String, mod_id: String },
    #[serde(rename = "name_index")]
    NameIndex { file: String, index: HashMap<String, Vec<Symbol>> },
}

fn make_id(parts: &[&str]) -> String {
    let mut hasher = Sha1::new();
    for part in parts {
        hasher.update(part.as_bytes());
    }
    format!("{:x}", hasher.finalize())[..16].to_string()
}

fn norm_path(p: &Path) -> String {
    p.to_string_lossy().replace('\\', "/")
}

fn range_of(_span: &proc_macro2::Span) -> Range {
    // Note: proc_macro2 spans don't have actual line/column info in this context
    // In a real implementation, you'd need source map integration
    Range {
        start_line: 1,
        start_col: 1,
        end_line: 1,
        end_col: 1,
    }
}

fn emit(record: Record) {
    println!("{}", serde_json::to_string(&record).unwrap());
}

struct Visitor {
    root: PathBuf,
    file_rel: String,
    mod_id: String,
    symbols: Vec<Symbol>,
    edges: Vec<Edge>,
    calls: Vec<String>,
    name_index: HashMap<String, Vec<Symbol>>,
}

impl Visitor {
    fn new(root: PathBuf, file_rel: String) -> Self {
        let mod_id = make_id(&["module", "rust", &file_rel, "1", "1"]);
        Self {
            root,
            file_rel: file_rel.clone(),
            mod_id,
            symbols: Vec::new(),
            edges: Vec::new(),
            calls: Vec::new(),
            name_index: HashMap::new(),
        }
    }

    fn emit_module(&self) {
        let mod_sym = Symbol {
            id: self.mod_id.clone(),
            kind: "module".to_string(),
            name: self.file_rel.clone(),
            file: self.file_rel.clone(),
            range: Range { start_line: 1, start_col: 1, end_line: 1, end_col: 1 },
            language: "rust".to_string(),
            parent_id: None,
            signature: None,
        };
        emit(Record::Symbol { symbol: mod_sym });
    }

    fn add_symbol(&mut self, symbol: Symbol) {
        self.symbols.push(symbol.clone());
        self.name_index.entry(symbol.name.clone()).or_insert_with(Vec::new).push(symbol);
    }

    fn add_edge(&mut self, edge: Edge) {
        self.edges.push(edge);
    }
}

impl<'ast> Visit<'ast> for Visitor {
    fn visit_item_fn(&mut self, node: &'ast syn::ItemFn) {
        let name = node.sig.ident.to_string();
        let symbol = Symbol {
            id: make_id(&["function", &name, &self.file_rel, "1", "1"]),
            kind: "function".to_string(),
            name: name.clone(),
            file: self.file_rel.clone(),
            range: range_of(&node.span()),
            language: "rust".to_string(),
            parent_id: None,
            signature: Some(quote::quote!(#node.sig).to_string()),
        };

        self.add_symbol(symbol.clone());
        self.add_edge(Edge {
            src: self.mod_id.clone(),
            r#type: "defines".to_string(),
            dst: symbol.id,
        });

        syn::visit::visit_item_fn(self, node);
    }

    fn visit_item_struct(&mut self, node: &'ast syn::ItemStruct) {
        let name = node.ident.to_string();
        let symbol = Symbol {
            id: make_id(&["struct", &name, &self.file_rel, "1", "1"]),
            kind: "class".to_string(), // Map to class for consistency
            name: name.clone(),
            file: self.file_rel.clone(),
            range: range_of(&node.span()),
            language: "rust".to_string(),
            parent_id: None,
            signature: None,
        };

        self.add_symbol(symbol.clone());
        self.add_edge(Edge {
            src: self.mod_id.clone(),
            r#type: "defines".to_string(),
            dst: symbol.id.clone(),
        });

        // Handle struct fields as variables
        for field in &node.fields {
            if let Some(ident) = &field.ident {
                let field_name = ident.to_string();
                let field_symbol = Symbol {
                    id: make_id(&["field", &field_name, &self.file_rel, "1", "1"]),
                    kind: "variable".to_string(),
                    name: field_name,
                    file: self.file_rel.clone(),
                    range: range_of(&field.span()),
                    language: "rust".to_string(),
                    parent_id: Some(symbol.id.clone()),
                    signature: None,
                };

                self.add_symbol(field_symbol.clone());
                self.add_edge(Edge {
                    src: symbol.id.clone(),
                    r#type: "member_of".to_string(),
                    dst: field_symbol.id,
                });
            }
        }

        syn::visit::visit_item_struct(self, node);
    }

    fn visit_item_enum(&mut self, node: &'ast syn::ItemEnum) {
        let name = node.ident.to_string();
        let symbol = Symbol {
            id: make_id(&["enum", &name, &self.file_rel, "1", "1"]),
            kind: "class".to_string(), // Map to class for consistency
            name: name.clone(),
            file: self.file_rel.clone(),
            range: range_of(&node.span()),
            language: "rust".to_string(),
            parent_id: None,
            signature: None,
        };

        self.add_symbol(symbol.clone());
        self.add_edge(Edge {
            src: self.mod_id.clone(),
            r#type: "defines".to_string(),
            dst: symbol.id.clone(),
        });

        // Handle enum variants
        for variant in &node.variants {
            let variant_name = variant.ident.to_string();
            let variant_symbol = Symbol {
                id: make_id(&["variant", &variant_name, &self.file_rel, "1", "1"]),
                kind: "variable".to_string(),
                name: variant_name,
                file: self.file_rel.clone(),
                range: range_of(&variant.span()),
                language: "rust".to_string(),
                parent_id: Some(symbol.id.clone()),
                signature: None,
            };

            self.add_symbol(variant_symbol.clone());
            self.add_edge(Edge {
                src: symbol.id.clone(),
                r#type: "member_of".to_string(),
                dst: variant_symbol.id,
            });
        }

        syn::visit::visit_item_enum(self, node);
    }

    fn visit_item_trait(&mut self, node: &'ast syn::ItemTrait) {
        let name = node.ident.to_string();
        let symbol = Symbol {
            id: make_id(&["trait", &name, &self.file_rel, "1", "1"]),
            kind: "class".to_string(), // Map to class for consistency
            name,
            file: self.file_rel.clone(),
            range: range_of(&node.span()),
            language: "rust".to_string(),
            parent_id: None,
            signature: None,
        };

        self.add_symbol(symbol.clone());
        self.add_edge(Edge {
            src: self.mod_id.clone(),
            r#type: "defines".to_string(),
            dst: symbol.id,
        });

        syn::visit::visit_item_trait(self, node);
    }

    fn visit_item_impl(&mut self, node: &'ast syn::ItemImpl) {
        // For impl blocks, we create method symbols
        let self_type = quote::quote!(#node.self_ty).to_string();

        for item in &node.items {
            match item {
                syn::ImplItem::Fn(method) => {
                    let method_name = method.sig.ident.to_string();
                    let method_symbol = Symbol {
                        id: make_id(&["method", &method_name, &self.file_rel, "1", "1"]),
                        kind: "method".to_string(),
                        name: method_name,
                        file: self.file_rel.clone(),
                        range: range_of(&method.span()),
                        language: "rust".to_string(),
                        parent_id: Some(make_id(&["impl", &self_type, &self.file_rel, "1", "1"])),
                        signature: Some(quote::quote!(#method.sig).to_string()),
                    };

                    self.add_symbol(method_symbol.clone());
                    // Note: We don't add edges here as we don't have a parent symbol ID
                }
                _ => {}
            }
        }

        syn::visit::visit_item_impl(self, node);
    }

    fn visit_item_use(&mut self, node: &'ast syn::ItemUse) {
        // Handle use statements as imports
        let use_path = quote::quote!(#node.tree).to_string();
        let import_symbol = Symbol {
            id: make_id(&["module", &use_path, &use_path, "1", "1"]),
            kind: "module".to_string(),
            name: use_path.clone(),
            file: use_path,
            range: Range { start_line: 1, start_col: 1, end_line: 1, end_col: 1 },
            language: "rust".to_string(),
            parent_id: None,
            signature: None,
        };

        emit(Record::Symbol { symbol: import_symbol.clone() });
        self.add_edge(Edge {
            src: self.mod_id.clone(),
            r#type: "import".to_string(),
            dst: import_symbol.id,
        });

        syn::visit::visit_item_use(self, node);
    }

    fn visit_expr_call(&mut self, node: &'ast syn::ExprCall) {
        // Extract function call names
        if let syn::Expr::Path(path) = &*node.func {
            if let Some(ident) = path.path.get_ident() {
                let name = ident.to_string();
                self.calls.push(name.clone());
                emit(Record::Call {
                    callee_name: name,
                    file: self.file_rel.clone(),
                    mod_id: self.mod_id.clone(),
                });
            }
        }

        syn::visit::visit_expr_call(self, node);
    }

    fn visit_expr_method_call(&mut self, node: &'ast syn::ExprMethodCall) {
        // Extract method call names
        let method_name = node.method.to_string();
        self.calls.push(method_name.clone());
        emit(Record::Call {
            callee_name: method_name,
            file: self.file_rel.clone(),
            mod_id: self.mod_id.clone(),
        });

        syn::visit::visit_expr_method_call(self, node);
    }
}

fn ingest_file(root: &Path, path: &Path) {
    let content = match fs::read_to_string(path) {
        Ok(content) => content,
        Err(_) => return,
    };

    let file_rel = norm_path(&path.strip_prefix(root).unwrap_or(path));
    let ast = match syn::parse_file(&content) {
        Ok(ast) => ast,
        Err(_) => return,
    };

    let mut visitor = Visitor::new(root.to_path_buf(), file_rel.clone());
    visitor.emit_module();
    visitor.visit_file(&ast);

    // Emit name index
    emit(Record::NameIndex {
        file: file_rel,
        index: visitor.name_index,
    });
}

fn ingest_dir(root: &Path) {
    for entry in walkdir::WalkDir::new(root)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
        .filter(|e| e.path().extension().map_or(false, |ext| ext == "rs"))
    {
        let path = entry.path();
        // Skip common directories
        if path.components().any(|c| {
            c.as_os_str() == "target" || c.as_os_str() == ".git" || c.as_os_str() == "node_modules"
        }) {
            continue;
        }
        ingest_file(root, path);
    }
}

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() < 2 {
        eprintln!("usage: {} <target_dir>", args[0]);
        process::exit(2);
    }

    let root = Path::new(&args[1]);
    if !root.is_dir() {
        eprintln!("error: {} is not a directory", root.display());
        process::exit(1);
    }

    ingest_dir(root);
}
