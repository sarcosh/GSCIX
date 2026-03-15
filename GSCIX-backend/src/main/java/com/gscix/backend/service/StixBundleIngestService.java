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
 *
 * Supports both GSCIX custom SDOs (x-*) and standard STIX 2.1 SDOs
 * (intrusion-set, threat-actor, malware, attack-pattern, etc.) so that
 * the influence graph can render the full topology of a bundle.
 */
@Service
public class StixBundleIngestService {

    private static final Logger logger = LoggerFactory.getLogger(StixBundleIngestService.class);
    private static final String GSCI_EXTENSION_ID = "extension-definition--6b53a3e2-8947-414b-876a-7d499edec5b8";

    /**
     * STIX 2.1 meta-object types that are NOT domain objects and should not be
     * persisted as entities. Everything else (custom x-* or standard SDOs) is
     * treated as an entity.
     */
    private static final Set<String> NON_ENTITY_TYPES = Set.of(
            "relationship", "sighting", "marking-definition",
            "extension-definition", "language-content", "bundle");

    private final GscixEntityRepository entityRepository;
    private final GscixRelationRepository relationRepository;
    private final JsonSchemaValidationService validationService;
    private final IngestionTrackingService trackingService;
    private final ObjectMapper objectMapper;

    public StixBundleIngestService(GscixEntityRepository entityRepository,
            GscixRelationRepository relationRepository,
            JsonSchemaValidationService validationService,
            IngestionTrackingService trackingService,
            ObjectMapper objectMapper) {
        this.entityRepository = entityRepository;
        this.relationRepository = relationRepository;
        this.validationService = validationService;
        this.trackingService = trackingService;
        this.objectMapper = objectMapper;
    }

    public Map<String, Object> ingestBundle(Map<String, Object> bundle, String filename) {
        return ingestBundle(bundle, filename, null, null);
    }

    public Map<String, Object> ingestBundle(Map<String, Object> bundle, String filename, String targetActorId) {
        return ingestBundle(bundle, filename, targetActorId, null);
    }

    public Map<String, Object> ingestBundle(Map<String, Object> bundle, String filename, String targetActorId, Integer defaultConfidence) {
        List<Map<String, Object>> objects = (List<Map<String, Object>>) bundle.get("objects");
        if (objects == null) {
            trackingService.logJob(filename, "ERROR", "No objects found in bundle", 0, 0);
            return Map.of("status", "ERROR", "message", "No objects found in bundle");
        }

        // =================================================================
        // Actor ID remapping: when a targetActorId is specified and the
        // bundle contains a x-geo-strategic-actor, remap all internal
        // references from the bundle actor's ID to the targetActorId.
        // This fixes bundles with inconsistent internal IDs and ensures
        // that relationships correctly point to the existing platform actor.
        // =================================================================
        Set<String> remappedActorIds = new HashSet<>();
        if (targetActorId != null && !targetActorId.isBlank()) {
            // Collect IDs of all x-geo-strategic-actor objects in the bundle
            for (Map<String, Object> obj : objects) {
                if ("x-geo-strategic-actor".equals(obj.get("type"))) {
                    String bundleActorId = (String) obj.get("id");
                    if (bundleActorId != null && !bundleActorId.equals(targetActorId)) {
                        remappedActorIds.add(bundleActorId);
                    }
                }
            }

            // Also collect any actor IDs referenced only in relationships but not
            // present as entities (phantom references from broken bundles)
            Set<String> entityIds = new HashSet<>();
            for (Map<String, Object> obj : objects) {
                if (!"relationship".equals(obj.get("type")) && obj.get("id") != null) {
                    entityIds.add((String) obj.get("id"));
                }
            }
            for (Map<String, Object> obj : objects) {
                if ("relationship".equals(obj.get("type"))) {
                    for (String refField : List.of("source_ref", "target_ref")) {
                        String ref = (String) obj.get(refField);
                        if (ref != null && ref.startsWith("x-geo-strategic-actor--")
                                && !ref.equals(targetActorId) && !entityIds.contains(ref)) {
                            remappedActorIds.add(ref);
                        }
                    }
                }
            }

            // Apply remapping across all objects
            if (!remappedActorIds.isEmpty()) {
                logger.info("Remapping {} bundle actor ID(s) {} -> {}", remappedActorIds.size(), remappedActorIds, targetActorId);
                for (Map<String, Object> obj : objects) {
                    String objId = (String) obj.get("id");
                    if (objId != null && remappedActorIds.contains(objId)) {
                        obj.put("id", targetActorId);
                    }
                    String srcRef = (String) obj.get("source_ref");
                    if (srcRef != null && remappedActorIds.contains(srcRef)) {
                        obj.put("source_ref", targetActorId);
                    }
                    String tgtRef = (String) obj.get("target_ref");
                    if (tgtRef != null && remappedActorIds.contains(tgtRef)) {
                        obj.put("target_ref", targetActorId);
                    }
                }
            }
        }

        int entitiesCreated = 0;
        int relationsCreated = 0;
        List<String> ingestedEntityIds = new ArrayList<>();

        for (Map<String, Object> obj : objects) {
            String type = (String) obj.get("type");
            String id = (String) obj.get("id");

            if ("relationship".equals(type)) {
                processRelationship(obj, defaultConfidence);
                relationsCreated++;
            } else if (type != null && !NON_ENTITY_TYPES.contains(type)) {
                processEntity(obj, defaultConfidence);
                entitiesCreated++;
                if (id != null) {
                    ingestedEntityIds.add(id);
                }
            }
        }

        // If a target actor was specified, verify which ingested entities are
        // actually reachable from the target actor via existing relations (BFS).
        // Entities that are NOT reachable are considered orphaned and get an
        // 'attributed-to' relationship to the target actor.
        // This is more robust than the previous approach (checking target_refs)
        // because it handles bundles with broken/inconsistent internal relations.
        if (targetActorId != null && !targetActorId.isBlank()) {
            Set<String> ingestedSet = new HashSet<>(ingestedEntityIds);
            // BFS from targetActorId through all relations in the DB
            Set<String> reachable = new HashSet<>();
            Queue<String> bfsQueue = new LinkedList<>();
            bfsQueue.add(targetActorId);
            reachable.add(targetActorId);
            while (!bfsQueue.isEmpty()) {
                String current = bfsQueue.poll();
                for (GscixRelation r : relationRepository.findBySourceRef(current)) {
                    if (ingestedSet.contains(r.getTargetRef()) && reachable.add(r.getTargetRef())) {
                        bfsQueue.add(r.getTargetRef());
                    }
                }
                for (GscixRelation r : relationRepository.findByTargetRef(current)) {
                    if (ingestedSet.contains(r.getSourceRef()) && reachable.add(r.getSourceRef())) {
                        bfsQueue.add(r.getSourceRef());
                    }
                }
            }

            int linked = 0;
            for (String entityId : ingestedEntityIds) {
                if (!entityId.equals(targetActorId) && !reachable.contains(entityId)) {
                    createAttributedToRelation(targetActorId, entityId, defaultConfidence);
                    relationsCreated++;
                    linked++;
                }
            }
            logger.info("Created {} 'attributed-to' relations linking actor {} to orphaned entities (out of {} ingested, {} reachable).",
                    linked, targetActorId, ingestedEntityIds.size(), reachable.size());
        }

        Map<String, Object> result = Map.of(
                "status", "OK",
                "message",
                String.format("Ingested STIX Bundle: %d entities and %d relations created.", entitiesCreated,
                        relationsCreated),
                "entities_created", entitiesCreated,
                "relations_created", relationsCreated);

        trackingService.logJob(filename, "OK", (String) result.get("message"), entitiesCreated, relationsCreated);
        return result;
    }

    /**
     * Process any STIX 2.1 domain object (both custom x-* and standard types).
     * Custom types may carry GSCIX extension attributes; standard types are
     * persisted with basic fields (name, description, first_seen, etc.) so they
     * can participate in graph traversal.
     */
    private void processEntity(Map<String, Object> obj, Integer defaultConfidence) {
        String type = (String) obj.get("type");
        String id = (String) obj.get("id");
        String name = (String) obj.get("name");
        String description = (String) obj.get("description");

        // If entity already exists (e.g. remapped actor or re-import), merge
        // non-null fields instead of overwriting to preserve existing data.
        Optional<GscixEntity> existingOpt = entityRepository.findById(id);
        GscixEntity entity = existingOpt.orElseGet(GscixEntity::new);

        entity.setStixId(id);
        entity.setType(type);
        if (name != null) entity.setName(name);
        else if (entity.getName() == null) entity.setName(type);
        if (description != null) entity.setDescription(description);
        if (!existingOpt.isPresent()) {
            entity.setSource("STIX-BUNDLE-INGEST");
            entity.setExtensions(Collections.singletonList(GSCI_EXTENSION_ID));
        }

        // Confidence: use value from bundle object, or fall back to import-level default
        Object confidenceVal = obj.get("confidence");
        if (confidenceVal instanceof Number) {
            entity.setConfidence(((Number) confidenceVal).intValue());
        } else if (entity.getConfidence() == null && defaultConfidence != null) {
            entity.setConfidence(defaultConfidence);
        }

        // Standard STIX 2.1 temporal fields
        String firstSeenStr = (String) obj.get("first_seen");
        String lastSeenStr = (String) obj.get("last_seen");
        if (firstSeenStr != null) {
            entity.setFirstSeen(Instant.parse(firstSeenStr));
        }
        if (lastSeenStr != null) {
            entity.setLastSeen(Instant.parse(lastSeenStr));
        }

        // Standard STIX 2.1 external_references
        if (obj.get("external_references") instanceof List) {
            List<Map<String, Object>> rawRefs = (List<Map<String, Object>>) obj.get("external_references");
            List<GscixEntity.ExternalReference> refs = new java.util.ArrayList<>();
            for (Map<String, Object> rawRef : rawRefs) {
                GscixEntity.ExternalReference ref = new GscixEntity.ExternalReference();
                ref.setSourceName((String) rawRef.get("source_name"));
                ref.setDescription((String) rawRef.get("description"));
                ref.setUrl((String) rawRef.get("url"));
                ref.setExternalId((String) rawRef.get("external_id"));
                refs.add(ref);
            }
            entity.setExternalReferences(refs);
        }

        // Standard STIX 2.1 fields for intrusion-set / threat-actor
        if (obj.get("aliases") instanceof List) {
            entity.setAliases((List<String>) obj.get("aliases"));
        }
        if (obj.get("goals") instanceof List) {
            entity.setGoals((List<String>) obj.get("goals"));
        }
        if (obj.get("resource_level") != null) entity.setResourceLevel((String) obj.get("resource_level"));
        if (obj.get("primary_motivation") != null) entity.setPrimaryMotivation((String) obj.get("primary_motivation"));
        if (obj.get("threat_actor_types") instanceof List) {
            entity.setThreatActorTypes((List<String>) obj.get("threat_actor_types"));
        }

        if (entity.getMetadata() == null) {
            GscixEntity.EntityMetadata metadata = new GscixEntity.EntityMetadata();
            metadata.setCreatedAt(Instant.now());
            entity.setMetadata(metadata);
        }
        entity.getMetadata().setUpdatedAt(Instant.now());

        // Extract OpenCTI internal ID if present (custom property added by OpenCTI exports)
        String openctiId = (String) obj.get("x_opencti_id");
        if (openctiId != null) {
            entity.getMetadata().setOpenctiInternalId(openctiId);
        }

        // Extract GSCIX Attributes
        // 1. From root (handles custom properties at object level)
        GscixEntity.GsciAttributes gsciAttributes = objectMapper.convertValue(obj, GscixEntity.GsciAttributes.class);

        // 2. From extensions (standard STIX 2.1 extension pattern)
        Map<String, Object> extensions = (Map<String, Object>) obj.get("extensions");
        if (extensions != null && extensions.containsKey(GSCI_EXTENSION_ID)) {
            Map<String, Object> gsciData = (Map<String, Object>) extensions.get(GSCI_EXTENSION_ID);

            // Validate against schema if applicable (only for custom types)
            if (type != null && type.startsWith("x-")) {
                validationService.validate(type, gsciData);
            }

            // Merge extension data into root attributes
            GscixEntity.GsciAttributes extAttrs = objectMapper.convertValue(gsciData, GscixEntity.GsciAttributes.class);
            if (extAttrs != null) {
                copyNonNullProperties(extAttrs, gsciAttributes);
            }
        }

        // Merge new gsciAttributes with existing ones if entity already existed
        if (existingOpt.isPresent() && entity.getGsciAttributes() != null && gsciAttributes != null) {
            copyNonNullProperties(gsciAttributes, entity.getGsciAttributes());
        } else {
            entity.setGsciAttributes(gsciAttributes);
        }

        entityRepository.save(entity);
        logger.info("Ingested Entity from Bundle: type={} name={} ({}) [{}]", type,
                entity.getName(), id, existingOpt.isPresent() ? "merged" : "new");
    }

    private void createAttributedToRelation(String actorId, String entityId, Integer defaultConfidence) {
        GscixRelation relation = new GscixRelation();
        relation.setId("relationship--" + java.util.UUID.randomUUID());
        relation.setSourceRef(actorId);
        relation.setTargetRef(entityId);
        relation.setRelationshipType("attributed-to");
        relation.setDescription("Auto-generated link from target actor to ingested entity.");
        relation.setExtensions(Collections.singletonList(GSCI_EXTENSION_ID));
        relation.setStartTime(Instant.now());
        relation.setConfidence(defaultConfidence != null ? defaultConfidence : 85);
        relationRepository.save(relation);
        logger.info("Created attributed-to relation: {} -> {}", actorId, entityId);
    }

    private void processRelationship(Map<String, Object> obj, Integer defaultConfidence) {
        GscixRelation relation = new GscixRelation();
        relation.setId((String) obj.get("id"));
        relation.setSourceRef((String) obj.get("source_ref"));
        relation.setTargetRef((String) obj.get("target_ref"));
        relation.setRelationshipType((String) obj.get("relationship_type"));
        relation.setDescription((String) obj.get("description"));
        relation.setExtensions(Collections.singletonList(GSCI_EXTENSION_ID));
        relation.setStartTime(Instant.now());

        // Confidence: use value from bundle relationship, or fall back to import-level default
        Object confidenceVal = obj.get("confidence");
        if (confidenceVal instanceof Number) {
            relation.setConfidence(((Number) confidenceVal).intValue());
        } else {
            relation.setConfidence(defaultConfidence != null ? defaultConfidence : 85);
        }

        relationRepository.save(relation);
        logger.info("Ingested Relationship from Bundle: {}", relation.getId());
    }

    private void copyNonNullProperties(GscixEntity.GsciAttributes source, GscixEntity.GsciAttributes target) {
        if (source == null || target == null)
            return;
        // Simple manual copy for key fields, as we want to avoid complex reflection or
        // extra dependencies
        if (source.getStrategicAlignment() != null)
            target.setStrategicAlignment(source.getStrategicAlignment());
        if (source.getGeopoliticalDoctrine() != null)
            target.setGeopoliticalDoctrine(source.getGeopoliticalDoctrine());
        if (source.getRevisionistIndex() != null)
            target.setRevisionistIndex(source.getRevisionistIndex());
        if (source.getStrategicAmbiguityScore() != null)
            target.setStrategicAmbiguityScore(source.getStrategicAmbiguityScore());
        if (source.getDoctrineType() != null)
            target.setDoctrineType(source.getDoctrineType());
        if (source.getTechnologicalModernizationRate() != null)
            target.setTechnologicalModernizationRate(source.getTechnologicalModernizationRate());
        if (source.getPowerProjection() != null)
            target.setPowerProjection(source.getPowerProjection());
        if (source.getAssociatedAgencies() != null)
            target.setAssociatedAgencies(source.getAssociatedAgencies());
        if (source.getObjectiveType() != null)
            target.setObjectiveType(source.getObjectiveType());
        if (source.getPriorityLevel() != null)
            target.setPriorityLevel(source.getPriorityLevel());
        if (source.getTimeHorizon() != null)
            target.setTimeHorizon(source.getTimeHorizon());
        if (source.getCivilMilitaryFusion() != null)
            target.setCivilMilitaryFusion(source.getCivilMilitaryFusion());
        if (source.getPhase() != null)
            target.setPhase(source.getPhase());
        if (source.getIntegrationLevel() != null)
            target.setIntegrationLevel(source.getIntegrationLevel());
        if (source.getGeographicScope() != null)
            target.setGeographicScope(source.getGeographicScope());
        if (source.getEscalationRiskScore() != null)
            target.setEscalationRiskScore(source.getEscalationRiskScore());
        if (source.getVelocity() != null)
            target.setVelocity(source.getVelocity());
        if (source.getNature() != null)
            target.setNature(source.getNature());
        if (source.getPoliticalDestabilizationIndex() != null)
            target.setPoliticalDestabilizationIndex(source.getPoliticalDestabilizationIndex());
        if (source.getEconomicDisruptionIndex() != null)
            target.setEconomicDisruptionIndex(source.getEconomicDisruptionIndex());
        if (source.getAllianceFragmentationScore() != null)
            target.setAllianceFragmentationScore(source.getAllianceFragmentationScore());
        if (source.getDeterrenceSignalStrength() != null)
            target.setDeterrenceSignalStrength(source.getDeterrenceSignalStrength());
        if (source.getNarrative() != null)
            target.setNarrative(source.getNarrative());
        if (source.getChannel() != null)
            target.setChannel(source.getChannel());
        if (source.getTargetAudience() != null)
            target.setTargetAudience(source.getTargetAudience());
        if (source.getHybridPressureIndex() != null)
            target.setHybridPressureIndex(source.getHybridPressureIndex());
        if (source.getEscalationProbabilityScore() != null)
            target.setEscalationProbabilityScore(source.getEscalationProbabilityScore());
        if (source.getStrategicSignalingScore() != null)
            target.setStrategicSignalingScore(source.getStrategicSignalingScore());
        if (source.getCyberGeopoliticalCouplingIndex() != null)
            target.setCyberGeopoliticalCouplingIndex(source.getCyberGeopoliticalCouplingIndex());
        if (source.getNarrativePenetrationScore() != null)
            target.setNarrativePenetrationScore(source.getNarrativePenetrationScore());
        if (source.getDoctrineCapacityDivergenceScore() != null)
            target.setDoctrineCapacityDivergenceScore(source.getDoctrineCapacityDivergenceScore());
        if (source.getFirstSeen() != null)
            target.setFirstSeen(source.getFirstSeen());
        if (source.getLastSeen() != null)
            target.setLastSeen(source.getLastSeen());
    }
}
