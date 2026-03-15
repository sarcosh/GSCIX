package com.gscix.backend.service;

import com.gscix.backend.model.GscixEntity;
import com.gscix.backend.repository.GscixEntityRepository;
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
import java.util.Map;
import java.util.Optional;

@Service
public class OpenCtiSyncService {
    private static final Logger logger = LoggerFactory.getLogger(OpenCtiSyncService.class);

    private final GscixEntityRepository repository;
    private final WebClient webClient;

    public OpenCtiSyncService(
            GscixEntityRepository repository,
            @Value("${opencti.url}") String openctiUrl,
            @Value("${opencti.token}") String openctiToken) {
        this.repository = repository;
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
                int count = 0;
                for (GraphQLResponse.Edge edge : response.getData().getThreatActors().getEdges()) {
                    GraphQLResponse.Node node = edge.getNode();
                    if (Boolean.TRUE.equals(node.getRevoked())) continue;
                    saveEntity(node, "threat-actor");
                    count++;
                }
                logger.info("Threat-Actor sync completed: {} active actors.", count);
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
                int count = 0;
                for (GraphQLResponse.Edge edge : response.getData().getIntrusionSets().getEdges()) {
                    GraphQLResponse.Node node = edge.getNode();
                    if (Boolean.TRUE.equals(node.getRevoked())) continue;
                    saveEntity(node, "intrusion-set");
                    count++;
                }
                logger.info("Intrusion-Set sync completed: {} active sets.", count);
            } else {
                logger.warn("Received empty or malformed Intrusion-Set response from OpenCTI.");
            }
        } catch (Exception e) {
            logger.error("Error during Intrusion-Set synchronization: {}", e.getMessage());
        }
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

        Optional<GscixEntity> existing = repository.findById(node.getStandard_id());
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

        repository.save(entity);
        logger.debug("{} {}: {} (opencti:{})", isNew ? "Created" : "Updated", stixType, node.getName(), node.getId());
    }
}
