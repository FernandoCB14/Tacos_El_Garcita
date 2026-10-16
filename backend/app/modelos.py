class ProductoMenu:
    def __init__(self, nombre, precio_base):
        self.id=None
        self.nombre = nombre
        self.precio_base = precio_base



class Taco(ProductoMenu):
    def __init__(self, carne):
        if carne.lower() == "suadero":
            precio = 20
        else:
            precio = 18

        super().__init__(f"Taco de {carne}", precio)
        self.carne = carne

    def __str__(self):
        return f"{self.nombre:<20} ${self.precio_base:.2f}"


class Con_queso(ProductoMenu):
    def __init__(self, tipo_platillo, precio_base, carne):
        self.tipo_platillo = tipo_platillo
        self.carne = carne

        if carne.lower() == "suadero":
            precio_final = precio_base + 3
        else:
            precio_final = precio_base
        super().__init__(f"{tipo_platillo} de {carne}", precio_final)

    def __str__(self):
        return f"{self.nombre:<20} ${self.precio_base:.2f}"


class BebidaYPostre(ProductoMenu):
    def __init__(self, nombre_producto, precio):
        # Para Refresco 455ml, Refresco 600ml, Boing, Aguas, Jericallas
        super().__init__(nombre_producto, precio)
