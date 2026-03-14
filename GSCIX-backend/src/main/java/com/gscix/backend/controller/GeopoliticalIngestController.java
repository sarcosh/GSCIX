package com.gscix.backend.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.gscix.backend.model.IngestionJob;
import com.gscix.backend.service.GeopoliticalIngestService;
import com.gscix.backend.service.IngestionTrackingService;
import com.gscix.backend.service.JsonSchemaValidationService;
import com.gscix.backend.service.dto.GeopoliticalIngestRequest;
import com.gscix.backend.service.dto.GeopoliticalIngestResponse;
import com.gscix.backend.service.dto.ValidationResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/geopolitical")
@Tag(name = "Geopolitical Ingestion", description = "Ingest geopolitical intelligence covering all GSCIX custom schemas")
public class GeopoliticalIngestController {

    private final GeopoliticalIngestService ingestService;
    private final com.gscix.backend.service.StixBundleIngestService bundleIngestService;
    private final JsonSchemaValidationService validationService;
    private final IngestionTrackingService trackingService;
    private final com.gscix.backend.service.RiskAnalyticsEngine riskAnalyticsEngine;

    public GeopoliticalIngestController(GeopoliticalIngestService ingestService,
            com.gscix.backend.service.StixBundleIngestService bundleIngestService,
            JsonSchemaValidationService validationService,
            IngestionTrackingService trackingService,
            com.gscix.backend.service.RiskAnalyticsEngine riskAnalyticsEngine) {
        this.ingestService = ingestService;
        this.bundleIngestService = bundleIngestService;
        this.validationService = validationService;
        this.trackingService = trackingService;
        this.riskAnalyticsEngine = riskAnalyticsEngine;
    }

    @GetMapping("/entities/{id}/analytics")
    @Operation(summary = "Calculate weighted HPI", description = "Calculates weighted HPI with temporal decay and spike detection for a given actor.")
    public ResponseEntity<com.gscix.backend.dto.HpiAnalysisResponse> getHpiAnalysis(@PathVariable String id) {
        return ResponseEntity.ok(riskAnalyticsEngine.calculateWeightedHpi(id));
    }

    @PostMapping("/ingest")
    @Operation(summary = "Ingest geopolitical data", description = "Receives a structured JSON payload covering x-geo-strategic-actor, "
            + "x-strategic-objective, x-hybrid-campaign, x-influence-vector, "
            + "x-strategic-impact, and x-strategic-assessment. "
            + "Persists entities to Elasticsearch and auto-discovers related Threat Actors in OpenCTI.")
    public ResponseEntity<GeopoliticalIngestResponse> ingest(@RequestBody GeopoliticalIngestRequest request) {
        if (request.getActorName() == null || request.getActorName().isBlank()) {
            GeopoliticalIngestResponse error = new GeopoliticalIngestResponse();
            error.setStatus("ERROR");
            error.setMessage("Field 'actor_name' is required.");
            return ResponseEntity.badRequest().body(error);
        }

        GeopoliticalIngestResponse response = ingestService.ingest(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/bundle")
    @Operation(summary = "Ingest native STIX 2.1 Bundle", description = "Receives a native STIX 2.1 Bundle JSON, processes objects and relationships, "
            + "and extracts GSCIX extensions.")
    public ResponseEntity<java.util.Map<String, Object>> ingestBundle(
            @RequestBody java.util.Map<String, Object> bundle,
            @org.springframework.web.bind.annotation.RequestParam(required = false) String filename) {
        java.util.Map<String, Object> response = bundleIngestService.ingestBundle(bundle, filename);
        if ("ERROR".equals(response.get("status"))) {
            return ResponseEntity.badRequest().body(response);
        }
        return ResponseEntity.ok(response);
    }

    @PostMapping("/validate")
    @Operation(summary = "Validate geopolitical data schema", description = "Validates the provided JSON (Bundle or single object) against GSCIX custom schemas without persisting.")
    public ResponseEntity<ValidationResponse> validate(@RequestBody JsonNode payload) {
        ValidationResponse response = validationService.validatePayload(payload);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/history")
    @Operation(summary = "Get ingestion history", description = "Returns the last 10 ingestion jobs.")
    public ResponseEntity<java.util.List<IngestionJob>> getHistory() {
        return ResponseEntity.ok(trackingService.getRecentJobs());
    }

    @DeleteMapping("/clear-all")
    @Operation(summary = "Clear all data", description = "Deletes all entities and relations from the database.")
    public ResponseEntity<Void> clearAll() {
        ingestService.clearAll();
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/entities/{id}")
    @Operation(summary = "Delete GSCIX entity", description = "Deletes an entity and all its associated relations.")
    public ResponseEntity<Void> deleteEntity(@PathVariable String id) {
        ingestService.deleteEntity(id);
        return ResponseEntity.noContent().build();
    }
}
