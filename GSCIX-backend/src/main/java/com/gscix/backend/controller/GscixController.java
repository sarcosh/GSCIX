package com.gscix.backend.controller;

import com.gscix.backend.dto.InfluenceGraphResponse;
import com.gscix.backend.model.GscixEntity;
import com.gscix.backend.model.GscixRelation;
import com.gscix.backend.repository.GscixEntityRepository;
import com.gscix.backend.repository.GscixRelationRepository;
import com.gscix.backend.service.InfluenceGraphService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import org.springframework.beans.factory.annotation.Value;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/gscix")
public class GscixController {

    private final GscixEntityRepository entityRepository;
    private final GscixRelationRepository relationRepository;
    private final InfluenceGraphService influenceGraphService;
    private final String openctiExternalUrl;

    public GscixController(GscixEntityRepository entityRepository,
            GscixRelationRepository relationRepository,
            InfluenceGraphService influenceGraphService,
            @Value("${opencti.external-url:http://localhost:8080}") String openctiExternalUrl) {
        this.entityRepository = entityRepository;
        this.relationRepository = relationRepository;
        this.influenceGraphService = influenceGraphService;
        this.openctiExternalUrl = openctiExternalUrl;
    }

    @PostMapping("/entities")
    public ResponseEntity<GscixEntity> createEntity(@RequestBody GscixEntity entity) {
        if (entity.getStixId() == null) {
            entity.setStixId(entity.getType() + "--" + UUID.randomUUID());
        }
        if (entity.getMetadata() == null) {
            entity.setMetadata(new GscixEntity.EntityMetadata());
            entity.getMetadata().setCreatedAt(Instant.now());
        }
        entity.getMetadata().setUpdatedAt(Instant.now());
        entity.setSource("GSCIX");

        GscixEntity saved = entityRepository.save(entity);
        return ResponseEntity.ok(saved);
    }

    @GetMapping("/entities")
    public ResponseEntity<Iterable<GscixEntity>> getAllEntities() {
        return ResponseEntity.ok(entityRepository.findAll());
    }

    @GetMapping("/entities/type/{type}")
    public ResponseEntity<List<GscixEntity>> getEntitiesByType(@PathVariable String type) {
        return ResponseEntity.ok(entityRepository.findByType(type));
    }

    @GetMapping("/entities/{id}")
    public ResponseEntity<GscixEntity> getEntityById(@PathVariable String id) {
        return entityRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/relations")
    public ResponseEntity<GscixRelation> createRelation(@RequestBody GscixRelation relation) {
        if (relation.getId() == null) {
            relation.setId("relationship--" + UUID.randomUUID());
        }

        if (!entityRepository.existsById(relation.getSourceRef())
                || !entityRepository.existsById(relation.getTargetRef())) {
            return ResponseEntity.badRequest().build();
        }

        GscixRelation saved = relationRepository.save(relation);
        return ResponseEntity.ok(saved);
    }

    @GetMapping("/relations")
    public ResponseEntity<Iterable<GscixRelation>> getAllRelations() {
        return ResponseEntity.ok(relationRepository.findAll());
    }

    @GetMapping("/relations/source/{sourceRef}")
    public ResponseEntity<List<GscixRelation>> getRelationsBySource(@PathVariable String sourceRef) {
        return ResponseEntity.ok(relationRepository.findBySourceRef(sourceRef));
    }

    // --- Influence Graph endpoints ---

    @GetMapping("/graph/{rootId}")
    public ResponseEntity<InfluenceGraphResponse> getInfluenceSubgraph(
            @PathVariable String rootId,
            @RequestParam(defaultValue = "2") int depth) {
        InfluenceGraphResponse response = influenceGraphService.buildSubgraph(rootId, Math.min(depth, 4));
        return ResponseEntity.ok(response);
    }

    @GetMapping("/graph")
    public ResponseEntity<InfluenceGraphResponse> getActorsOverview() {
        InfluenceGraphResponse response = influenceGraphService.buildActorsOverview();
        return ResponseEntity.ok(response);
    }

    // --- Config endpoint ---

    @GetMapping("/config/opencti-url")
    public ResponseEntity<Map<String, String>> getOpenctiUrl() {
        return ResponseEntity.ok(Map.of("url", openctiExternalUrl));
    }
}
