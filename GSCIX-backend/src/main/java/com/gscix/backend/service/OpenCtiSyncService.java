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

    private void saveEntity(GraphQLResponse.Node node, String stixType) {
        if (node.getStandard_id() == null) {
            logger.warn("Skipping {} node with missing standard_id (opencti id: {})", stixType, node.getId());
            return;
        }

        Optional<GscixEntity> existing = repository.findById(node.getStandard_id());
        GscixEntity entity = existing.orElseGet(GscixEntity::new);

        entity.setStixId(node.getStandard_id());
        entity.setType(stixType);
        entity.setSource("OPENCTI");
        entity.setName(node.getName());
        entity.setDescription(node.getDescription());

        // Temporal fields
        if (node.getFirst_seen() != null) {
            try { entity.setFirstSeen(Instant.parse(node.getFirst_seen())); } catch (Exception ignored) {}
        }
        if (node.getLast_seen() != null) {
            try { entity.setLastSeen(Instant.parse(node.getLast_seen())); } catch (Exception ignored) {}
        }

        // Type-specific fields
        entity.setAliases(node.getAliases());
        entity.setGoals(node.getGoals());
        entity.setResourceLevel(node.getResource_level());
        entity.setPrimaryMotivation(node.getPrimary_motivation());
        entity.setThreatActorTypes(node.getThreat_actor_types());

        // Metadata
        if (entity.getMetadata() == null) {
            GscixEntity.EntityMetadata metadata = new GscixEntity.EntityMetadata();
            metadata.setCreatedAt(Instant.now());
            entity.setMetadata(metadata);
        }
        entity.getMetadata().setUpdatedAt(Instant.now());
        entity.getMetadata().setOpenctiInternalId(node.getId());

        repository.save(entity);
        logger.debug("Saved/Updated {}: {} (opencti:{})", stixType, node.getName(), node.getId());
    }
}
