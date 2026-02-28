package com.gscix.backend.service.dto;

import lombok.Data;
import java.util.List;

@Data
public class GraphQLResponse {
    private DataNode data;

    @Data
    public static class DataNode {
        private ThreatActors threatActors;
    }

    @Data
    public static class ThreatActors {
        private List<Edge> edges;
    }

    @Data
    public static class Edge {
        private Node node;
    }

    @Data
    public static class Node {
        private String id;
        private String standard_id;
        private String name;
        private String description;
        private Boolean revoked;
    }
}
