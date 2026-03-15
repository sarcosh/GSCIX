package com.gscix.backend.service.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import java.util.List;

@Data
public class GraphQLResponse {
    private DataNode data;

    @Data
    public static class DataNode {
        private EntityConnection threatActors;
        private EntityConnection intrusionSets;
    }

    @Data
    public static class EntityConnection {
        private List<Edge> edges;
    }

    @Data
    public static class Edge {
        private Node node;
    }

    @Data
    public static class Node {
        private String id;           // OpenCTI internal UUID
        private String standard_id;  // STIX ID (e.g. intrusion-set--uuid)
        private String name;
        private String description;
        private Boolean revoked;
        private String first_seen;
        private String last_seen;
        private List<String> aliases;
        private List<String> goals;
        private String resource_level;
        private String primary_motivation;
        @JsonProperty("threat_actor_types")
        private List<String> threat_actor_types;

        // Nested relationships from OpenCTI GraphQL
        private RelationConnection stixCoreRelationships;
    }

    @Data
    public static class RelationConnection {
        private List<RelationEdge> edges;
    }

    @Data
    public static class RelationEdge {
        private RelationNode node;
    }

    @Data
    public static class RelationNode {
        private String id;
        private String standard_id;
        private String relationship_type;

        // The "from" and "to" sides of the relationship
        private RelationEntity from;
        private RelationEntity to;
    }

    @Data
    public static class RelationEntity {
        private String standard_id;
        private String entity_type;
        private String name;
    }
}
