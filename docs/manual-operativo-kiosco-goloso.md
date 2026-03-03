# Manual Operativo
## Kiosco Goloso - San Antonio de Areco

Este manual define la operacion diaria del sistema SADAPOS para un kiosco pequeno/mediano.

## 1. Perfiles y accesos

- `admin`: configura usuarios, productos, proveedores, compras, reportes, backup/restore.
- `empleado`: venta, caja, consulta basica.

Recomendado:
- No compartir usuarios.
- Cambiar contrasenas iniciales.
- Mantener solo usuarios activos.

## 2. Apertura diaria

1. Ingresar con usuario propio.
2. Abrir caja con monto inicial real.
3. Verificar que la caja quede en estado `abierta`.
4. Revisar alertas:
- stock bajo
- productos proximos a vencer
- productos vencidos

## 3. Operaciones de ventas

1. Buscar producto por nombre o codigo.
2. Confirmar cantidad y precio.
3. Seleccionar medio de pago.
4. Cobrar y cerrar venta.

Notas:
- El sistema descuenta stock y lotes.
- Se prioriza FEFO (vence primero, sale primero).
- Si corresponde, generar ticket/imprimir/reimprimir.

## 4. Compras y proveedores

1. Cargar proveedor.
2. Registrar comprobante (factura/remito).
3. Agregar items con:
- producto
- cantidad
- costo unitario
- vencimiento por lote (si aplica)
4. Confirmar compra.

Resultado esperado:
- aumenta stock
- se crean/actualizan lotes
- queda trazabilidad por auditoria

## 5. Devoluciones y anulaciones

Uso recomendado:
- Anular solo ventas incorrectas o canceladas.
- Registrar motivo.

Impacto esperado:
- stock vuelve a inventario
- caja y reportes ajustan montos
- auditoria registra usuario, fecha y accion

## 6. Cierre de caja

1. Contar dinero fisico.
2. Cerrar caja cargando monto final contado.
3. Revisar diferencia (teorico vs real).
4. Validar:
- total vendido
- cantidad de ventas
- ganancia del turno

## 7. Reportes

Generar y exportar periodicamente:
- ventas por dia
- ventas por usuario
- ventas por medio de pago
- margen/ganancia

Frecuencia sugerida:
- diario: control operativo
- semanal: control comercial
- mensual: cierre de gestion

## 8. Auditoria

Acciones clave auditadas:
- cambios de precio
- cambios de stock
- eliminaciones
- compras
- anulaciones
- apertura/cierre de caja

Buenas practicas:
- cada persona usa su usuario
- no operar con cuenta compartida

## 9. Backup y restore

Frecuencia recomendada:
- backup diario al cierre
- backup adicional antes de cambios grandes

Politica minima:
- conservar copias de 7, 30 y 90 dias
- guardar copia fuera de la PC principal (nube o disco externo)

Restore:
- probar restauracion en entorno de prueba al menos 1 vez por mes

## 10. Seguridad y mantenimiento

- No guardar contrasenas en texto plano.
- Mantener Java, MySQL y sistema operativo actualizados.
- Revisar logs de errores semanalmente.
- Ejecutar pruebas automatizadas y CI antes de pasar cambios a produccion.

## 11. Checklist de salud del sistema

Diario:
- caja abre y cierra bien
- ventas se registran
- stock se descuenta correctamente
- ticket imprime/reimprime

Semanal:
- revisar alertas de stock y vencimiento
- validar 1 backup recuperable
- revisar auditoria de acciones sensibles

Mensual:
- control de margenes y precios
- limpieza de usuarios inactivos
- prueba end-to-end completa del flujo de venta
