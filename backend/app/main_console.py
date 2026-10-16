from abc import ABC, abstractmethod
from backend.app.modelos import Taco, Con_queso
from backend.app.orden import Orden
from backend.vistas import InterfazConsola

if __name__ == "__main__":
    print("¡Bienvenido al sistema de tacos el Garcita!")

    num_mesa = InterfazConsola.solicitar_mesa()
    print(f"👍 Mesa {num_mesa} abierta con éxito.")
    mi_orden = Orden(num_mesa)
    while True:
        print("\n--- SISTEMA DE VENTAS ---")
        print("1. Agregar Taco a la orden")
        print("2. Agregar producto con queso")
        print("3. Ver Ticket / Cuenta Actual")
        print("4. Cerrar Mesa y Salir")

        opcion = input("Selecciona una opcion (1-4):")
        if opcion == "1":
            carne_real = InterfazConsola.solicitar_carne()
            cantidad = InterfazConsola.solicitar_cantidad(f"¿Cuántos tacos de {carne_real} va a querer?: ")
            for _ in range(cantidad):
                nuevo_taco = Taco(carne_real)
                mi_orden.agregar_producto(nuevo_taco)
            print(f"\n✅ ¡Se agregaron {cantidad} tacos de {carne_real}!")

        elif opcion == "2":
            print("\n--- SELECCIONA EL PLATILLO ---")
            print("1. Taco con queso ($25)")
            print("2. Gringa / Volcán / Chonita ($40)")
            print("3. Gringa Doble ($75)")
            platillo_elegido = input("Selecciona una opcion(1-3): ")
            menu_queso = {
                "1": ("Taco con Queso", 25),
                "2": ("Gringa", 40),
                "3": ("Gringa Doble", 75),
            }
            
            if platillo_elegido in menu_queso:
                nombre_platillo, precio_base = menu_queso[platillo_elegido]
                carne_real = InterfazConsola.solicitar_carne()
                cantidad = InterfazConsola.solicitar_cantidad(f"¿Cuántos {menu_queso[platillo_elegido][0]} de {carne_real} va a querer?: ")

                for _ in range(cantidad):
                    nuevo_platillo = Con_queso(nombre_platillo, precio_base, carne_real)
                    mi_orden.agregar_producto(nuevo_platillo)
                    print(
                        f"\n✅ ¡Se agregaron {cantidad} {nombre_platillo}(s) de {carne_real}!"
                    )
            else:
                print("❌ Opción de platillo inválida.")
        elif opcion == "3":
            mi_orden.mostrar_ticket()
                
        elif opcion == "4":
            print("\nGenerando total...")
            mi_orden.mostrar_ticket()
            print("!Mesa cerrada con exito!")
            break
        else:
            print("Opcion no valida. Por favor intenta de nuevo")
