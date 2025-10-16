from .utils import greet

def main(name: str) -> None:
    print(log(greet(name)))

def log(msg: str) -> str:
    return f"[py] {msg}"

class Person:
    def __init__(self, name: str):
        self.name = name
    def speak(self):
        return greet(self.name)
