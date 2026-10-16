from app.modelos import ProductoMenu

class Orden:
    def __init__(self, num_mesa):
        self.num_mesa = num_mesa
        self.items = []
        self.contador_id=1
    
    def agregar_producto(self, producto):
        producto.id = self.contador_id
        self.items.append(producto)
        self.contador_id += 1
        print(f"-> Cocina recibió: {producto.nombre}")

    def calcular_total(self):
        total = 0
        for item in self.items:
            total += item.precio_base
        return total  
    def mostrar_ticket(self):
        """Imprime el formato del ticket que diseñaste"""
        print("\n=========================================")
        print(f"          TACOS EL GARCITA            ")
        print(f"            Cuenta Mesa #{self.num_mesa}   ")
        print(f"=========================================")
        
        if not self.items:
            print("Mesa sin consumo actual.")
            return
        for item in self.items:
            print(item)
        print("-" * 41)
        print(f"{'Total:' : <20} ${self.calcular_total():.2f}")