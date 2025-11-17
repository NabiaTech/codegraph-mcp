pub mod utils;

use utils::greet;

pub fn main(name: &str) {
    println!("{}", log(greet(name)));
}

fn log(msg: &str) -> String {
    format!("[rs] {}", msg)
}

pub struct Person {
    pub name: String,
}

impl Person {
    pub fn new(name: &str) -> Self {
        Self {
            name: name.to_string(),
        }
    }

    pub fn speak(&self) -> String {
        greet(&self.name)
    }
}

pub enum Status {
    Active,
    Inactive,
}
