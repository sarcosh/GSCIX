
- Añadir el campo "confidence_score" a todas las entidades y a las relaciones. Actualizar también la documentación, los custom_schemas y las validaciones.


- El valor de "confidence" establecido en la importación será el valor que se establecerá por defecto para todas aquellas entidades y relaciones que no tengan un valor de "confidence" establecido.

- ~~Hay que revisar la implementación cuando se selecciona un intrusion-set en el proceso de creación de una nueva entidad porque las fechas "first_seen" y "last_seen" no se están estableciendo correctamente. Podría ser porque no estén informadas en la entidad de origen.~~ **RESUELTO**: El frontend ahora envía un update (POST /entities con stixId) para entidades OpenCTI, y el backend hace merge de campos no-nulos en vez de sobrescribir.

- ~~Hay que revisar la implementación porque no se crea la relación entre el intrusion-set y otras entidad (p.ej: strategic-objective: TEST).~~ **RESUELTO**: El formulario "Add Relation" ahora se pre-rellena automáticamente con el stixId de la entidad recién guardada como source_ref.



