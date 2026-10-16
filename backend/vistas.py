class InterfazConsola:
    @staticmethod
    def solicitar_mesa():
        while True:
            num_mesa = input("Numero de mesa")
            try:
                return int(num_mesa)
            except ValueError:
                print("Opcion no valida. Por favor intenta de nuevo")

    @staticmethod
    def solicitar_carne():
        carnes = {
            "1": "Pastor",
            "2": "Bistec",
            "3": "Chorizo",
            "4": "Campechanos",
            "5": "Suadero",
        }
        while True:
            print("1. Pastor")
            print("2. Bistec")
            print("3. Chorizo")
            print("4. Campechanos")
            print("5. Suadero")
            carne_elegida = input("Escribe el tipo de carne (1-5)")

            if carne_elegida in carnes:
                return carnes[carne_elegida]
            else:
                print("❌ Opción de carne inválida. Intenta de nuevo.")

    @staticmethod
    def solicitar_cantidad(men_personalizado):
        while True:
            entrada = input(men_personalizado)
            try:
                cantidad = int(entrada)
                if cantidad > 0:
                    return cantidad
                else:
                    print("❌ La cantidad debe ser mayor a 0.")
            except ValueError:
                print("❌ Error: Introduce un número entero válido.")
