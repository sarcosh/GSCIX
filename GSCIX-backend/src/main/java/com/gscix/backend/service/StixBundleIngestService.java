package com.gscix.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.gscix.backend.model.GscixEntity;
import com.gscix.backend.model.GscixRelation;
import com.gscix.backend.repository.GscixEntityRepository;
import com.gscix.backend.repository.GscixRelationRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;

/**
 * Service specialized in processing native STIX 2.1 Bundles.
 * It iterates over objects, extracts GSCIX attributes from the 'extensions'
 * field,
 * and persists both entities and relationships (SROs).
 */
@Service
public class StixBundleIngestService {

    private static final Logger logger = LoggerFactory.getLogger(StixBundleIngestService.class);
    private static final String GSCI_EXTENSION_ID = "extension-definition--6b53a3e2-8947-414b-876a-7d499edec5b8";

    private final GscixEntityRepository entityRepository;
    private final GscixRelationRepository relationRepository;
    private final ObjectMapper objectMapper;

    public StixBundleIngestService(GscixEntityRepository entityRepository,
            GscixRelationRepository relationRepository,
            ObjectMapper objectMapper) {
        this.entityRepository = entityRepository;
        this.relationRepository = relationRepository;
        this.objectMapper = objectMapper;
    }

    public Map<String, Object> ingestBundle(Map<String, Object> bundle) {
        List<Map<String, Object>> objects = (List<Map<String, Object>>) bundle.get("objects");
        if (objects == null) {
            return Map.of("status", "ERROR", "message", "No objects found in bundle");
        }

        int entitiesCreated = 0;
        int relationsCreated = 0;

        for (Map<String, Object> obj : objects) {
            String type = (String) obj.get("type");
            String id = (String) obj.get("id");

            if ("relationship".equals(type)) {
                processRelationship(obj);
                relationsCreated++;
            } else if (type != null && (type.startsWith("x-") || type.startsWith("x-gscix-"))) {
                processGscixEntity(obj);
                entitiesCreated++;
            }
        }

        return Map.of(
                "status", "OK",
                "message",
                String.format("Ingested STIX Bundle: %d entities and %d relations created.", entitiesCreated,
                        relationsCreated),
                "entities_created", entitiesCreated,
                "relations_created", relationsCreated);
    }

    private void processGscixEntity(Map<String, Object> obj) {
        String type = (String) obj.get("type");
        String id = (String) obj.get("id");
        String name = (String) obj.get("name");
        String description = (String) obj.get("description");

        GscixEntity entity = new GscixEntity();
        entity.setStixId(id);
        entity.setType(type);
        entity.setName(name);
        entity.setDescription(description);
        entity.setSource("STIX-BUNDLE-INGEST");
        entity.setExtensions(Collections.singletonList(GSCI_EXTENSION_ID));

        GscixEntity.EntityMetadata metadata = new GscixEntity.EntityMetadata();
        metadata.setCreatedAt(Instant.now());
        metadata.setUpdatedAt(Instant.now());
        entity.setMetadata(metadata);

        // Extract GSCIX Attributes from extensions
        Map<String, Object> extensions = (Map<String, Object>) obj.get("extensions");
        if (extensions != null && extensions.containsKey(GSCI_EXTENSION_ID)) {
            Map<String, Object> gsciData = (Map<String, Object>) extensions.get(GSCI_EXTENSION_ID);
            entity.setGsciAttributes(objectMapper.convertValue(gsciData, GscixEntity.GsciAttributes.class));
        }

        entityRepository.save(entity);
        logger.info("Ingested GSCIX Entity from Bundle: {} ({})", name, id);
    }

    private void processRelationship(Map<String, Object> obj) {
        GscixRelation relation = new GscixRelation();
        relation.setId((String) obj.get("id"));
        relation.setSourceRef((String) obj.get("source_ref"));
        relation.setTargetRef((String) obj.get("target_ref"));
        relation.setRelationshipType((String) obj.get("relationship_type"));
        relation.setDescription((String) obj.get("description"));
        relation.setExtensions(Collections.singletonList(GSCI_EXTENSION_ID));
        relation.setStartTime(Instant.now());
        relation.setConfidence(85);

        relationRepository.save(relation);
        logger.info("Ingested Relationship from Bundle: {}", relation.getId());
    }
}
