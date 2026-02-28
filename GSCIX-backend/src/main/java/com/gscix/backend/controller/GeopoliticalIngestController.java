package com.gscix.backend.controller;

import com.gscix.backend.service.GeopoliticalIngestService;
import com.gscix.backend.service.dto.GeopoliticalIngestRequest;
import com.gscix.backend.service.dto.GeopoliticalIngestResponse;
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

    public GeopoliticalIngestController(GeopoliticalIngestService ingestService,
            com.gscix.backend.service.StixBundleIngestService bundleIngestService) {
        this.ingestService = ingestService;
        this.bundleIngestService = bundleIngestService;
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
            @RequestBody java.util.Map<String, Object> bundle) {
        java.util.Map<String, Object> response = bundleIngestService.ingestBundle(bundle);
        if ("ERROR".equals(response.get("status"))) {
            return ResponseEntity.badRequest().body(response);
        }
        return ResponseEntity.ok(response);
    }
}
