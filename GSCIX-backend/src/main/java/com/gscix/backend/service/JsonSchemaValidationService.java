package com.gscix.backend.service;

import com.gscix.backend.service.dto.ValidationResponse;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.util.*;

/**
 * Service that performs validation against GSCIX custom schemas.
 * These schemas are NOT standard JSON Schemas, but follow a custom 'properties'
 * array format.
 */
@Slf4j
@Service
public class JsonSchemaValidationService {

    private final ObjectMapper objectMapper;
    private final Map<String, JsonNode> schemas = new HashMap<>();
    private final String schemasPath;

    public JsonSchemaValidationService(ObjectMapper objectMapper,
            @Value("${gscix.schemas.path:../custom_schemas}") String schemasPath) {
        this.objectMapper = objectMapper;
        this.schemasPath = schemasPath;
    }

    @PostConstruct
    public void init() {
        loadSchemas();
    }

    private void loadSchemas() {
        File schemaDir = new File(schemasPath);
        if (!schemaDir.exists() || !schemaDir.isDirectory()) {
            log.error("Schemas directory not found at: {}", schemasPath);
            return;
        }

        File[] schemaFiles = schemaDir.listFiles((dir, name) -> name.endsWith(".json"));

        if (schemaFiles != null) {
            for (File file : schemaFiles) {
                try {
                    JsonNode schema = objectMapper.readTree(file);
                    // Store both by filename and by id if present
                    schemas.put(file.getName(), schema);
                    if (schema.has("id")) {
                        schemas.put(schema.get("id").asText() + ".json", schema);
                        schemas.put(schema.get("id").asText(), schema);
                    }
                    log.info("Loaded custom GSCIX schema: {}", file.getName());
                } catch (IOException e) {
                    log.error("Failed to load schema: {}", file.getName(), e);
                }
            }
        }
    }

    public void validate(String schemaName, JsonNode data) throws RuntimeException {
        List<String> errors = validateQuietly(schemaName, data);
        if (!errors.isEmpty()) {
            String combinedErrors = String.join("; ", errors);
            log.error("Validation failed for {}: {}", schemaName, combinedErrors);
            throw new RuntimeException("Validation failed for " + schemaName + ": " + combinedErrors);
        }
    }

    public List<String> validateQuietly(String schemaName, JsonNode data) {
        if (!schemaName.endsWith(".json")) {
            schemaName += ".json";
        }

        JsonNode schema = schemas.get(schemaName);
        if (schema == null) {
            // Try without .json suffix if it was stored by ID
            String baseName = schemaName.substring(0, schemaName.length() - 5);
            schema = schemas.get(baseName);
        }

        if (schema == null) {
            log.warn("Schema not found: {}. Attempting to reload.", schemaName);
            loadSchemas();
            schema = schemas.get(schemaName);
            if (schema == null) {
                return Collections.singletonList("Schema definition not found: " + schemaName);
            }
        }

        List<String> errors = new ArrayList<>();
        JsonNode properties = schema.get("properties");
        if (properties != null && properties.isArray()) {
            for (JsonNode prop : properties) {
                validateProperty(prop, data, errors);
            }
        }
        return errors;
    }

    public ValidationResponse validatePayload(JsonNode payload) {
        ValidationResponse response = new ValidationResponse();
        List<ValidationResponse.ValidationError> allErrors = new ArrayList<>();

        if (payload.has("type") && "bundle".equals(payload.get("type").asText())) {
            // It's a STIX bundle
            JsonNode objects = payload.get("objects");
            if (objects != null && objects.isArray()) {
                for (JsonNode obj : objects) {
                    validateObject(obj, allErrors);
                }
            }
        } else {
            // Single object
            validateObject(payload, allErrors);
        }

        if (allErrors.isEmpty()) {
            response.setStatus("OK");
            response.setMessage("Validation successful. No schema violations found.");
        } else {
            response.setStatus("ERROR");
            response.setMessage("Validation failed with " + allErrors.size() + " errors.");
            response.setErrors(allErrors);
        }

        return response;
    }

    private void validateObject(JsonNode obj, List<ValidationResponse.ValidationError> allErrors) {
        String type = obj.has("type") ? obj.get("type").asText() : null;
        String id = obj.has("id") ? obj.get("id").asText() : "unknown";

        if (type != null && type.startsWith("x-")) {
            // GSCIX Custom type
            List<String> errors = validateQuietly(type, obj);
            for (String err : errors) {
                ValidationResponse.ValidationError vErr = new ValidationResponse.ValidationError();
                vErr.setObjectId(id);
                vErr.setObjectType(type);
                vErr.setError(err);
                allErrors.add(vErr);
            }
        } else if (obj.has("extensions")) {
            // Check extensions for GSCIX data
            JsonNode extensions = obj.get("extensions");
            String gsciExtensionId = "extension-definition--6b53a3e2-8947-414b-876a-7d499edec5b8";
            if (extensions.has(gsciExtensionId)) {
                JsonNode gsciData = extensions.get(gsciExtensionId);
                List<String> errors = validateQuietly(type, gsciData);
                for (String err : errors) {
                    ValidationResponse.ValidationError vErr = new ValidationResponse.ValidationError();
                    vErr.setObjectId(id);
                    vErr.setObjectType(type);
                    vErr.setError(err);
                    allErrors.add(vErr);
                }
            }
        }
    }

    private void validateProperty(JsonNode propDef, JsonNode data, List<String> errors) {
        String name = propDef.get("name").asText();
        boolean mandatory = propDef.has("mandatory") && propDef.get("mandatory").asBoolean();
        String type = propDef.has("type") ? propDef.get("type").asText() : "string";

        // Handle field mapping for GeopoliticalIngestRequest vs Schema
        JsonNode value = data.get(name);
        if (value == null || value.isNull()) {
            // Special case for actor_name -> name
            if (name.equals("name") && data.has("actor_name")) {
                value = data.get("actor_name");
            }
            // Special case for geopolitical_context -> description
            else if (name.equals("description") && data.has("geopolitical_context")) {
                value = data.get("geopolitical_context");
            }
        }

        // Handle mandatory check
        if (mandatory && (value == null || value.isNull() || (value.isTextual() && value.asText().isEmpty()))) {
            errors.add("Missing mandatory property: " + name);
            return;
        }

        if (value == null || value.isNull()) {
            return;
        }

        // Handle type check and enum values
        switch (type.toLowerCase()) {
            case "enum":
                if (propDef.has("values")) {
                    Set<String> validValues = new HashSet<>();
                    propDef.get("values").forEach(v -> validValues.add(v.asText().toLowerCase()));
                    if (!validValues.contains(value.asText().toLowerCase())) {
                        errors.add("Invalid value for " + name + ": " + value.asText() + ". Expected one of: "
                                + propDef.get("values"));
                    }
                }
                break;
            case "number":
                if (!value.isNumber()) {
                    errors.add("Property " + name + " must be a number");
                }
                break;
            case "boolean":
                if (!value.isBoolean()) {
                    errors.add("Property " + name + " must be a boolean");
                }
                break;
            case "list":
                if (!value.isArray()) {
                    errors.add("Property " + name + " must be a list/array");
                }
                break;
            case "timestamp":
                // Basic check if it's a string, could be improved with ISO parsing check
                if (!value.isTextual()) {
                    errors.add("Property " + name + " must be a timestamp string");
                }
                break;
            default:
                // String or other types
                break;
        }
    }

    public void validate(String schemaName, Object data) throws RuntimeException {
        JsonNode node = objectMapper.valueToTree(data);
        validate(schemaName, node);
    }
}
