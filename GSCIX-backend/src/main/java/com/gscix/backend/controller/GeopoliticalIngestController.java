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

    public GeopoliticalIngestController(GeopoliticalIngestService ingestService) {
        this.ingestService = ingestService;
    }

    @PostMapping("/ingest")
    @Operation(
            summary = "Ingest geopolitical data",
            description = "Receives a structured JSON payload covering x-geo-strategic-actor, "
                    + "x-strategic-objective, x-hybrid-campaign, x-influence-vector, "
                    + "x-strategic-impact, and x-strategic-assessment. "
                    + "Persists entities to Elasticsearch and auto-discovers related Threat Actors in OpenCTI."
    )
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
}
