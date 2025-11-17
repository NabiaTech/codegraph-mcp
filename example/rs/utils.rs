pub fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}

pub fn helper() -> &'static str {
    "helper function"
}
