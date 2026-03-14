package com.gscix.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.gscix.backend.service.dto.GeopoliticalIngestRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.File;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class JsonSchemaValidationServiceTest {

    private JsonSchemaValidationService validationService;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());
        // Point to the relative path of custom_schemas from the test root or use full
        // path
        // In local environment, ../custom_schemas should work relative to the project
        // root
        // But for testing purposes, I'll pass the absolute path if possible, or just
        // mock/assume it's there
        String schemasPath = "../custom_schemas";
        validationService = new JsonSchemaValidationService(objectMapper, schemasPath);
        validationService.init();
    }

    @Test
    void testValidateActorCorrect() {
        GeopoliticalIngestRequest request = new GeopoliticalIngestRequest();
        request.setActorName("Test Actor");
        request.setStrategicAlignment("NATO");

        // This should pass with the mappings added to the service
        assertDoesNotThrow(() -> validationService.validate("x-geo-strategic-actor", request));
    }

    @Test
    void testValidateActorMissingMandatory() {
        GeopoliticalIngestRequest request = new GeopoliticalIngestRequest();
        // Missing actor_name (which maps to 'name')
        request.setStrategicAlignment("NATO");

        RuntimeException exception = assertThrows(RuntimeException.class, () -> {
            validationService.validate("x-geo-strategic-actor", request);
        });
        assertTrue(exception.getMessage().contains("Missing mandatory property: name"));
    }

    @Test
    void testValidateActorInvalidEnum() {
        GeopoliticalIngestRequest request = new GeopoliticalIngestRequest();
        request.setActorName("Test Actor");
        request.setStrategicAlignment("INVALID_ALIGNMENT");

        RuntimeException exception = assertThrows(RuntimeException.class, () -> {
            validationService.validate("x-geo-strategic-actor", request);
        });
        assertTrue(exception.getMessage().contains("Invalid value for strategic_alignment"));
    }

    @Test
    void testValidateMapData() {
        Map<String, Object> data = new HashMap<>();
        data.put("name", "Test Campaign");
        data.put("phase", "pre-conflict");

        assertDoesNotThrow(() -> validationService.validate("x-hybrid-campaign", data));
    }
}
