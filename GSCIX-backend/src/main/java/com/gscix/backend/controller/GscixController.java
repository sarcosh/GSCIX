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

        // If the entity already exists (e.g. synced from OpenCTI), merge non-null fields
        // instead of blindly overwriting to preserve existing data like aliases, goals, metadata, etc.
        GscixEntity target = entityRepository.findById(entity.getStixId())
                .orElse(null);

        if (target != null) {
            // Merge: only overwrite fields that the incoming payload actually provides
            if (entity.getName() != null) target.setName(entity.getName());
            if (entity.getDescription() != null) target.setDescription(entity.getDescription());
            if (entity.getFirstSeen() != null) target.setFirstSeen(entity.getFirstSeen());
            if (entity.getLastSeen() != null) target.setLastSeen(entity.getLastSeen());
            if (entity.getResourceLevel() != null) target.setResourceLevel(entity.getResourceLevel());
            if (entity.getPrimaryMotivation() != null) target.setPrimaryMotivation(entity.getPrimaryMotivation());
            if (entity.getAliases() != null) target.setAliases(entity.getAliases());
            if (entity.getGoals() != null) target.setGoals(entity.getGoals());
            if (entity.getThreatActorTypes() != null) target.setThreatActorTypes(entity.getThreatActorTypes());
            if (entity.getConfidence() != null) target.setConfidence(entity.getConfidence());
            if (entity.getGsciAttributes() != null) target.setGsciAttributes(entity.getGsciAttributes());
            target.getMetadata().setUpdatedAt(Instant.now());

            GscixEntity saved = entityRepository.save(target);
            return ResponseEntity.ok(saved);
        }

        // New entity
        if (entity.getMetadata() == null) {
            entity.setMetadata(new GscixEntity.EntityMetadata());
            entity.getMetadata().setCreatedAt(Instant.now());
        }
        entity.getMetadata().setUpdatedAt(Instant.now());
        entity.setSource("GSCIX");

        GscixEntity saved = entityRepository.save(entity);
        return ResponseEntity.ok(saved);
    }

    @PutMapping("/entities/{id}")
    public ResponseEntity<GscixEntity> updateEntity(@PathVariable String id, @RequestBody GscixEntity entity) {
        GscixEntity target = entityRepository.findById(id).orElse(null);
        if (target == null) {
            return ResponseEntity.notFound().build();
        }

        // Merge non-null fields (same logic as POST upsert)
        if (entity.getName() != null) target.setName(entity.getName());
        if (entity.getDescription() != null) target.setDescription(entity.getDescription());
        if (entity.getFirstSeen() != null) target.setFirstSeen(entity.getFirstSeen());
        if (entity.getLastSeen() != null) target.setLastSeen(entity.getLastSeen());
        if (entity.getResourceLevel() != null) target.setResourceLevel(entity.getResourceLevel());
        if (entity.getPrimaryMotivation() != null) target.setPrimaryMotivation(entity.getPrimaryMotivation());
        if (entity.getAliases() != null) target.setAliases(entity.getAliases());
        if (entity.getGoals() != null) target.setGoals(entity.getGoals());
        if (entity.getThreatActorTypes() != null) target.setThreatActorTypes(entity.getThreatActorTypes());
        if (entity.getConfidence() != null) target.setConfidence(entity.getConfidence());
        if (entity.getExternalReferences() != null) target.setExternalReferences(entity.getExternalReferences());
        if (entity.getGsciAttributes() != null) target.setGsciAttributes(entity.getGsciAttributes());
        if (entity.getMetadata() != null && entity.getMetadata().getOpenctiInternalId() != null) {
            target.getMetadata().setOpenctiInternalId(entity.getMetadata().getOpenctiInternalId());
        }
        target.getMetadata().setUpdatedAt(Instant.now());

        GscixEntity saved = entityRepository.save(target);
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

    @PutMapping("/relations/{id}")
    public ResponseEntity<GscixRelation> updateRelation(@PathVariable String id, @RequestBody GscixRelation incoming) {
        GscixRelation existing = relationRepository.findById(id).orElse(null);
        if (existing == null) {
            return ResponseEntity.notFound().build();
        }

        // Validate that source and target entities exist
        if (incoming.getSourceRef() != null && !entityRepository.existsById(incoming.getSourceRef())) {
            return ResponseEntity.badRequest().build();
        }
        if (incoming.getTargetRef() != null && !entityRepository.existsById(incoming.getTargetRef())) {
            return ResponseEntity.badRequest().build();
        }

        // Merge non-null fields
        if (incoming.getSourceRef() != null) existing.setSourceRef(incoming.getSourceRef());
        if (incoming.getTargetRef() != null) existing.setTargetRef(incoming.getTargetRef());
        if (incoming.getRelationshipType() != null) existing.setRelationshipType(incoming.getRelationshipType());
        if (incoming.getDescription() != null) existing.setDescription(incoming.getDescription());
        if (incoming.getConfidence() != null) existing.setConfidence(incoming.getConfidence());

        GscixRelation saved = relationRepository.save(existing);
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/relations/{id}")
    public ResponseEntity<Void> deleteRelation(@PathVariable String id) {
        if (!relationRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        relationRepository.deleteById(id);
        return ResponseEntity.noContent().build();
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
