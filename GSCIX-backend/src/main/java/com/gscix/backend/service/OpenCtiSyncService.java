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

    @Scheduled(fixedDelay = 60000) // Poll every 60 seconds
    public void syncTacticalPointers() {
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
                    
                    if (Boolean.TRUE.equals(node.getRevoked())) {
                        continue;
                    }

                    savePointer(node);
                    count++;
                }
                logger.info("Synchronization completed. Synced {} active Threat Actors.", count);
            } else {
                logger.warn("Received empty or malformed response from OpenCTI.");
            }
        } catch (Exception e) {
            logger.error("Error during OpenCTI synchronization: {}", e.getMessage());
        }
    }

    private void savePointer(GraphQLResponse.Node node) {
        if (node.getStandard_id() == null) {
            logger.warn("Skipping node with missing standard_id (id: {})", node.getId());
            return;
        }

        Optional<GscixEntity> existingEntity = repository.findById(node.getStandard_id());
        
        GscixEntity entity = existingEntity.orElseGet(GscixEntity::new);
        
        entity.setStixId(node.getStandard_id());
        entity.setType("threat-actor");
        entity.setSource("OPENCTI");
        entity.setName(node.getName());
        entity.setDescription(node.getDescription());
        
        if (entity.getMetadata() == null) {
            GscixEntity.EntityMetadata metadata = new GscixEntity.EntityMetadata();
            metadata.setCreatedAt(Instant.now());
            entity.setMetadata(metadata);
        }
        
        entity.getMetadata().setUpdatedAt(Instant.now());
        entity.getMetadata().setOpenctiInternalId(node.getId());

        repository.save(entity);
        logger.debug("Saved/Updated pointer for Threat Actor: {}", node.getName());
    }
}
