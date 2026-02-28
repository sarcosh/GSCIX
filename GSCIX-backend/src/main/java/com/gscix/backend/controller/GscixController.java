package com.gscix.backend.controller;

import com.gscix.backend.model.GscixEntity;
import com.gscix.backend.model.GscixRelation;
import com.gscix.backend.repository.GscixEntityRepository;
import com.gscix.backend.repository.GscixRelationRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/gscix")
public class GscixController {

    private final GscixEntityRepository entityRepository;
    private final GscixRelationRepository relationRepository;

    public GscixController(GscixEntityRepository entityRepository, GscixRelationRepository relationRepository) {
        this.entityRepository = entityRepository;
        this.relationRepository = relationRepository;
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
        
        if (!entityRepository.existsById(relation.getSourceRef()) || !entityRepository.existsById(relation.getTargetRef())) {
            return ResponseEntity.badRequest().build();
        }
        
        GscixRelation saved = relationRepository.save(relation);
        return ResponseEntity.ok(saved);
    }

    @GetMapping("/relations/source/{sourceRef}")
    public ResponseEntity<List<GscixRelation>> getRelationsBySource(@PathVariable String sourceRef) {
        return ResponseEntity.ok(relationRepository.findBySourceRef(sourceRef));
    }
}
