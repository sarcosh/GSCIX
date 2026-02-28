package com.gscix.backend.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.elasticsearch.annotations.Document;
import org.springframework.data.elasticsearch.annotations.Field;
import org.springframework.data.elasticsearch.annotations.FieldType;

import java.time.Instant;

@Data
@Document(indexName = "gscix_entities")
public class GscixEntity {
    @Id
    private String stixId;

    @Field(type = FieldType.Keyword)
    private java.util.List<String> extensions;

    @Field(type = FieldType.Keyword)
    private String type;

    @Field(type = FieldType.Keyword)
    private String source;

    @Field(type = FieldType.Text)
    private String name;

    @Field(type = FieldType.Text)
    private String description;

    @Field(type = FieldType.Object)
    private GsciAttributes gsciAttributes;

    @Field(type = FieldType.Object)
    private EntityMetadata metadata;

    @Data
    public static class GsciAttributes {
        // x-geo-strategic-actor fields
        @Field(type = FieldType.Keyword)
        private String strategicAlignment;
        @Field(type = FieldType.Text)
        private String geopoliticalDoctrine;
        @Field(type = FieldType.Double)
        private Double revisionistIndex;
        @Field(type = FieldType.Keyword)
        private String powerProjection;
        @Field(type = FieldType.Keyword)
        private String associatedAgencies;

        // x-strategic-objective fields
        @Field(type = FieldType.Keyword)
        private String objectiveType;
        @Field(type = FieldType.Keyword)
        private String priorityLevel;
        @Field(type = FieldType.Keyword)
        private String timeHorizon;

        // x-hybrid-campaign fields
        @Field(type = FieldType.Keyword)
        private String phase;
        @Field(type = FieldType.Keyword)
        private String integrationLevel;
        @Field(type = FieldType.Keyword)
        private String geographicScope;
        @Field(type = FieldType.Double)
        private Double escalationRiskScore;

        // x-strategic-impact fields
        @Field(type = FieldType.Double)
        private Double politicalDestabilizationIndex;
        @Field(type = FieldType.Double)
        private Double economicDisruptionIndex;
        @Field(type = FieldType.Double)
        private Double allianceFragmentationScore;
        @Field(type = FieldType.Double)
        private Double deterrenceSignalStrength;
        @Field(type = FieldType.Double)
        private Double confidenceScore;

        // x-influence-vector fields
        @Field(type = FieldType.Text)
        private String narrative;
        @Field(type = FieldType.Keyword)
        private String channel;
        @Field(type = FieldType.Keyword)
        private String targetAudience;

        // x-strategic-assessment fields
        @Field(type = FieldType.Double)
        private Double hybridPressureIndex;
        @Field(type = FieldType.Double)
        private Double escalationProbabilityScore;
        @Field(type = FieldType.Double)
        private Double strategicSignalingScore;
        @Field(type = FieldType.Double)
        private Double cyberGeopoliticalCouplingIndex;
        @Field(type = FieldType.Double)
        private Double narrativePenetrationScore;
    }

    @Data
    public static class EntityMetadata {
        @Field(type = FieldType.Date)
        private Instant createdAt;

        @Field(type = FieldType.Date)
        private Instant updatedAt;

        @Field(type = FieldType.Keyword)
        private String openctiInternalId;
    }
}
