package com.gscix.backend.service.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.List;

/**
 * Response DTO for the geopolitical ingestion endpoint.
 * Reports what was created and which OpenCTI actors were auto-discovered.
 */
@Data
public class GeopoliticalIngestResponse {

    private String status;
    private String message;

    @JsonProperty("actor_entity_id")
    private String actorEntityId;

    @JsonProperty("entities_created")
    private int entitiesCreated;

    @JsonProperty("relations_created")
    private int relationsCreated;

    @JsonProperty("opencti_matches")
    private List<OpenCtiMatch> openctiMatches;

    @Data
    public static class OpenCtiMatch {
        private String name;

        @JsonProperty("opencti_id")
        private String openctiId;

        @JsonProperty("standard_id")
        private String standardId;

        @JsonProperty("relationship_type")
        private String relationshipType;
    }
}
