package com.gscix.backend.service;

import com.gscix.backend.model.GscixEntity;
import com.gscix.backend.model.GscixRelation;
import com.gscix.backend.repository.GscixEntityRepository;
import com.gscix.backend.repository.GscixRelationRepository;
import com.gscix.backend.service.dto.GraphQLResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class OpenCtiSyncService {
    private static final Logger logger = LoggerFactory.getLogger(OpenCtiSyncService.class);

    private final GscixEntityRepository entityRepository;
    private final GscixRelationRepository relationRepository;
    private final WebClient webClient;

    public OpenCtiSyncService(
            GscixEntityRepository entityRepository,
            GscixRelationRepository relationRepository,
            @Value("${opencti.url}") String openctiUrl,
            @Value("${opencti.token}") String openctiToken) {
        this.entityRepository = entityRepository;
        this.relationRepository = relationRepository;
        this.webClient = WebClient.builder()
                .baseUrl(openctiUrl)
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + openctiToken)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .build();
    }

    // =========================================================================
    // Threat Actor synchronization
    // =========================================================================

    @Scheduled(fixedDelay = 60000)
    public void syncThreatActors() {
        logger.info("Starting OpenCTI Threat-Actor synchronization...");

        String query = """
            query GetThreatActors {
              threatActors(first: 100) {
                edges {
                  node {
                    id
                    standard_id
                    name
                    description
                    revoked
                    first_seen
                    last_seen
                    threat_actor_types
                    resource_level
                    primary_motivation
                  }
                }
              }
            }
            """;

        try {
            GraphQLResponse response = webClient.post()
                    .uri("/graphql")
                    .bodyValue(Map.of("query", query))
                    .retrieve()
                    .bodyToMono(GraphQLResponse.class)
                    .block();

            if (response != null && response.getData() != null && response.getData().getThreatActors() != null) {
                int entityCount = 0;
                for (GraphQLResponse.Edge edge : response.getData().getThreatActors().getEdges()) {
                    GraphQLResponse.Node node = edge.getNode();
                    if (Boolean.TRUE.equals(node.getRevoked())) continue;
                    saveEntity(node, "threat-actor");
                    entityCount++;
                }
                logger.info("Threat-Actor sync completed: {} active actors.", entityCount);
            } else {
                logger.warn("Received empty or malformed Threat-Actor response from OpenCTI.");
            }
        } catch (Exception e) {
            logger.error("Error during Threat-Actor synchronization: {}", e.getMessage());
        }
    }

    // =========================================================================
    // Intrusion Set synchronization
    // =========================================================================

    @Scheduled(fixedDelay = 60000)
    public void syncIntrusionSets() {
        logger.info("Starting OpenCTI Intrusion-Set synchronization...");

        String query = """
            query GetIntrusionSets {
              intrusionSets(first: 100) {
                edges {
                  node {
                    id
                    standard_id
                    name
                    description
                    revoked
                    first_seen
                    last_seen
                    aliases
                    goals
                    resource_level
                    primary_motivation
                  }
                }
              }
            }
            """;

        try {
            GraphQLResponse response = webClient.post()
                    .uri("/graphql")
                    .bodyValue(Map.of("query", query))
                    .retrieve()
                    .bodyToMono(GraphQLResponse.class)
                    .block();

            if (response != null && response.getData() != null && response.getData().getIntrusionSets() != null) {
                int entityCount = 0;
                for (GraphQLResponse.Edge edge : response.getData().getIntrusionSets().getEdges()) {
                    GraphQLResponse.Node node = edge.getNode();
                    if (Boolean.TRUE.equals(node.getRevoked())) continue;
                    saveEntity(node, "intrusion-set");
                    entityCount++;
                }
                logger.info("Intrusion-Set sync completed: {} active sets.", entityCount);
            } else {
                logger.warn("Received empty or malformed Intrusion-Set response from OpenCTI.");
            }
        } catch (Exception e) {
            logger.error("Error during Intrusion-Set synchronization: {}", e.getMessage());
        }
    }

    // =========================================================================
    // Relationship synchronization
    // =========================================================================

    @Scheduled(fixedDelay = 60000, initialDelay = 30000)
    public void syncRelationships() {
        logger.info("Starting OpenCTI Relationship synchronization...");

        // Query relationships between threat-actors and intrusion-sets
        String query = """
            query GetRelationships {
              stixCoreRelationships(
                first: 200
                relationship_type: ["attributed-to", "controls", "uses"]
                fromTypes: ["Threat-Actor-Individual", "Threat-Actor-Group", "Intrusion-Set"]
                toTypes: ["Threat-Actor-Individual", "Threat-Actor-Group", "Intrusion-Set"]
              ) {
                edges {
                  node {
                    id
                    standard_id
                    relationship_type
                    from {
                      ... on ThreatActorIndividual { standard_id entity_type name }
                      ... on ThreatActorGroup { standard_id entity_type name }
                      ... on IntrusionSet { standard_id entity_type name }
                    }
                    to {
                      ... on ThreatActorIndividual { standard_id entity_type name }
                      ... on ThreatActorGroup { standard_id entity_type name }
                      ... on IntrusionSet { standard_id entity_type name }
                    }
                  }
                }
              }
            }
            """;

        try {
            // Use a generic map to parse since the top-level response structure is different
            @SuppressWarnings("unchecked")
            Map<String, Object> rawResponse = webClient.post()
                    .uri("/graphql")
                    .bodyValue(Map.of("query", query))
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            if (rawResponse == null || rawResponse.get("data") == null) {
                logger.warn("Received empty response for relationship sync from OpenCTI.");
                return;
            }

            @SuppressWarnings("unchecked")
            Map<String, Object> data = (Map<String, Object>) rawResponse.get("data");
            @SuppressWarnings("unchecked")
            Map<String, Object> relConn = (Map<String, Object>) data.get("stixCoreRelationships");
            if (relConn == null) {
                logger.warn("No stixCoreRelationships in response from OpenCTI.");
                return;
            }

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> edges = (List<Map<String, Object>>) relConn.get("edges");
            if (edges == null) return;

            int count = 0;
            for (Map<String, Object> edge : edges) {
                @SuppressWarnings("unchecked")
                Map<String, Object> node = (Map<String, Object>) edge.get("node");
                if (node == null) continue;

                String relStixId = (String) node.get("standard_id");
                String relType = (String) node.get("relationship_type");

                @SuppressWarnings("unchecked")
                Map<String, Object> from = (Map<String, Object>) node.get("from");
                @SuppressWarnings("unchecked")
                Map<String, Object> to = (Map<String, Object>) node.get("to");

                if (relStixId == null || relType == null || from == null || to == null) continue;

                String sourceId = (String) from.get("standard_id");
                String targetId = (String) to.get("standard_id");
                if (sourceId == null || targetId == null) continue;

                // Ensure both entities exist locally — create stubs for missing ones
                // using the minimal info from the relationship response
                ensureEntityExists(sourceId, from);
                ensureEntityExists(targetId, to);

                Optional<GscixRelation> existingRel = relationRepository.findById(relStixId);
                GscixRelation relation = existingRel.orElseGet(GscixRelation::new);

                relation.setId(relStixId);
                relation.setSourceRef(sourceId);
                relation.setTargetRef(targetId);
                relation.setRelationshipType(relType);
                relation.setExtensions(Collections.singletonList("extension-definition--6b53a3e2-8947-414b-876a-7d499edec5b8"));
                if (relation.getStartTime() == null) relation.setStartTime(Instant.now());
                if (relation.getConfidence() == null) relation.setConfidence(85);

                relationRepository.save(relation);
                count++;
                logger.debug("{} relation from OpenCTI: {} [{}] {} -> {}",
                        existingRel.isPresent() ? "Updated" : "Created", relStixId, relType, sourceId, targetId);
            }
            logger.info("Relationship sync completed: {} relations synced.", count);
        } catch (Exception e) {
            logger.error("Error during Relationship synchronization: {}", e.getMessage());
        }
    }

    // =========================================================================
    // Entity auto-creation for relationship endpoints
    // =========================================================================

    /**
     * Ensures that an entity exists locally. If not, creates a minimal stub
     * using the information available from the relationship's from/to fields.
     * The stub will be fully populated on the next entity sync cycle.
     *
     * @param stixId    The STIX standard_id of the entity
     * @param relEntity Map containing at least standard_id, entity_type, name
     */
    private void ensureEntityExists(String stixId, Map<String, Object> relEntity) {
        if (stixId == null || entityRepository.existsById(stixId)) return;

        String entityType = (String) relEntity.get("entity_type");
        String name = (String) relEntity.get("name");

        // Map OpenCTI entity_type to STIX type
        String stixType = mapOpenCtiTypeToStix(entityType);
        if (stixType == null) {
            logger.warn("Cannot create stub entity for unknown type: {} (stixId: {})", entityType, stixId);
            return;
        }

        GscixEntity entity = new GscixEntity();
        entity.setStixId(stixId);
        entity.setType(stixType);
        entity.setName(name != null ? name : stixType);
        entity.setSource("OPENCTI");

        GscixEntity.EntityMetadata metadata = new GscixEntity.EntityMetadata();
        metadata.setCreatedAt(Instant.now());
        metadata.setUpdatedAt(Instant.now());
        entity.setMetadata(metadata);

        entityRepository.save(entity);
        logger.info("Created stub {} '{}' ({}) to satisfy relationship endpoint.",
                stixType, entity.getName(), stixId);
    }

    /**
     * Maps OpenCTI GraphQL entity_type names to STIX 2.1 type strings.
     */
    private String mapOpenCtiTypeToStix(String openctiType) {
        if (openctiType == null) return null;
        return switch (openctiType) {
            case "Threat-Actor-Individual", "Threat-Actor-Group", "Threat-Actor" -> "threat-actor";
            case "Intrusion-Set" -> "intrusion-set";
            case "Malware" -> "malware";
            case "Attack-Pattern" -> "attack-pattern";
            case "Campaign" -> "campaign";
            case "Tool" -> "tool";
            default -> {
                logger.debug("Unmapped OpenCTI entity type: {}", openctiType);
                yield null;
            }
        };
    }

    // =========================================================================
    // Shared persistence logic
    // =========================================================================

    /**
     * OpenCTI uses sentinel values for unset dates:
     *   first_seen = 1970-01-01T00:00:00.000Z  (epoch 0)
     *   last_seen  = 5138-11-16T09:46:40.000Z  (epoch seconds 100000000000)
     * These must be treated as null (not set) to avoid misleading data.
     * We use a threshold (year 2200) to catch any far-future sentinel generically.
     */
    private static final Instant OPENCTI_EPOCH_SENTINEL = Instant.EPOCH;
    private static final Instant FAR_FUTURE_THRESHOLD = Instant.parse("2200-01-01T00:00:00Z");

    private boolean isOpenCtiSentinelDate(Instant instant) {
        return instant != null
                && (instant.equals(OPENCTI_EPOCH_SENTINEL) || instant.isAfter(FAR_FUTURE_THRESHOLD));
    }

    /**
     * Persists or updates an entity from OpenCTI sync.
     *
     * For NEW entities: all fields from OpenCTI are used.
     * For EXISTING entities: only non-null OpenCTI fields are merged,
     * preserving locally-enriched data (gsciAttributes, confidence,
     * externalReferences) that OpenCTI does not provide.
     */
    private void saveEntity(GraphQLResponse.Node node, String stixType) {
        if (node.getStandard_id() == null) {
            logger.warn("Skipping {} node with missing standard_id (opencti id: {})", stixType, node.getId());
            return;
        }

        Optional<GscixEntity> existing = entityRepository.findById(node.getStandard_id());
        boolean isNew = existing.isEmpty();
        GscixEntity entity = existing.orElseGet(GscixEntity::new);

        entity.setStixId(node.getStandard_id());
        entity.setType(stixType);

        // Source: only set on new entities to preserve manual overrides
        if (isNew) {
            entity.setSource("OPENCTI");
        }

        // Core fields — merge non-null from OpenCTI
        if (node.getName() != null) entity.setName(node.getName());
        if (node.getDescription() != null) entity.setDescription(node.getDescription());

        // Temporal fields — filter out OpenCTI sentinel values, only update if non-sentinel
        if (node.getFirst_seen() != null) {
            try {
                Instant parsed = Instant.parse(node.getFirst_seen());
                if (!isOpenCtiSentinelDate(parsed)) {
                    entity.setFirstSeen(parsed);
                }
            } catch (Exception ignored) {}
        }
        if (node.getLast_seen() != null) {
            try {
                Instant parsed = Instant.parse(node.getLast_seen());
                if (!isOpenCtiSentinelDate(parsed)) {
                    entity.setLastSeen(parsed);
                }
            } catch (Exception ignored) {}
        }

        // Type-specific fields — only update when OpenCTI provides non-null values
        if (node.getAliases() != null && !node.getAliases().isEmpty()) entity.setAliases(node.getAliases());
        if (node.getGoals() != null && !node.getGoals().isEmpty()) entity.setGoals(node.getGoals());
        if (node.getResource_level() != null) entity.setResourceLevel(node.getResource_level());
        if (node.getPrimary_motivation() != null) entity.setPrimaryMotivation(node.getPrimary_motivation());
        if (node.getThreat_actor_types() != null && !node.getThreat_actor_types().isEmpty()) entity.setThreatActorTypes(node.getThreat_actor_types());

        // NOTE: gsciAttributes, confidence, and externalReferences are NOT touched
        // by the sync — they are GSCIX-specific enrichments that only come from
        // manual editing or bundle ingestion.

        // Metadata
        if (entity.getMetadata() == null) {
            GscixEntity.EntityMetadata metadata = new GscixEntity.EntityMetadata();
            metadata.setCreatedAt(Instant.now());
            entity.setMetadata(metadata);
        }
        entity.getMetadata().setUpdatedAt(Instant.now());
        entity.getMetadata().setOpenctiInternalId(node.getId());

        entityRepository.save(entity);
        logger.debug("{} {}: {} (opencti:{})", isNew ? "Created" : "Updated", stixType, node.getName(), node.getId());
    }

}
