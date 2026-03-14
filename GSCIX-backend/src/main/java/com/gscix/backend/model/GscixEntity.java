package com.gscix.backend.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.elasticsearch.annotations.Document;
import org.springframework.data.elasticsearch.annotations.Field;
import org.springframework.data.elasticsearch.annotations.FieldType;

import java.time.Instant;
import java.util.List;

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

    // --- Standard STIX 2.1 SDO fields (intrusion-set, threat-actor, etc.) ---

    @JsonProperty("first_seen")
    @Field(type = FieldType.Date)
    private Instant firstSeen;

    @JsonProperty("last_seen")
    @Field(type = FieldType.Date)
    private Instant lastSeen;

    @JsonProperty("aliases")
    @Field(type = FieldType.Keyword)
    private List<String> aliases;

    @JsonProperty("goals")
    @Field(type = FieldType.Text)
    private List<String> goals;

    @JsonProperty("resource_level")
    @Field(type = FieldType.Keyword)
    private String resourceLevel;

    @JsonProperty("primary_motivation")
    @Field(type = FieldType.Keyword)
    private String primaryMotivation;

    @JsonProperty("threat_actor_types")
    @Field(type = FieldType.Keyword)
    private List<String> threatActorTypes;

    @Field(type = FieldType.Object)
    private GsciAttributes gsciAttributes;

    @Field(type = FieldType.Object)
    private EntityMetadata metadata;

    @Data
    public static class GsciAttributes {
        @JsonProperty("strategic_alignment")
        @Field(type = FieldType.Keyword)
        private String strategicAlignment;

        @JsonProperty("geopolitical_doctrine")
        @Field(type = FieldType.Text)
        private String geopoliticalDoctrine;

        @JsonProperty("revisionist_index")
        @Field(type = FieldType.Double)
        private Double revisionistIndex;

        @JsonProperty("strategic_ambiguity_score")
        @Field(type = FieldType.Double)
        private Double strategicAmbiguityScore;

        @JsonProperty("doctrine_type")
        @Field(type = FieldType.Keyword)
        private String doctrineType;

        @JsonProperty("technological_modernization_rate")
        @Field(type = FieldType.Double)
        private Double technologicalModernizationRate;

        @JsonProperty("power_projection")
        @Field(type = FieldType.Keyword)
        private String powerProjection;

        @JsonProperty("associated_agencies")
        @Field(type = FieldType.Keyword)
        private String associatedAgencies;

        @JsonProperty("objective_type")
        @Field(type = FieldType.Keyword)
        private String objectiveType;

        @JsonProperty("priority_level")
        @Field(type = FieldType.Keyword)
        private String priorityLevel;

        @JsonProperty("time_horizon")
        @Field(type = FieldType.Keyword)
        private String timeHorizon;

        @JsonProperty("civil_military_fusion")
        @Field(type = FieldType.Boolean)
        private Boolean civilMilitaryFusion;

        @JsonProperty("phase")
        @Field(type = FieldType.Keyword)
        private String phase;

        @JsonProperty("integration_level")
        @Field(type = FieldType.Keyword)
        private String integrationLevel;

        @JsonProperty("geographic_scope")
        @Field(type = FieldType.Keyword)
        private String geographicScope;

        @JsonProperty("escalation_risk_score")
        @Field(type = FieldType.Double)
        private Double escalationRiskScore;

        @JsonProperty("velocity")
        @Field(type = FieldType.Keyword)
        private String velocity;

        @JsonProperty("nature")
        @Field(type = FieldType.Keyword)
        private java.util.List<String> nature;

        @JsonProperty("political_destabilization_index")
        @Field(type = FieldType.Double)
        private Double politicalDestabilizationIndex;

        @JsonProperty("economic_disruption_index")
        @Field(type = FieldType.Double)
        private Double economicDisruptionIndex;

        @JsonProperty("alliance_fragmentation_score")
        @Field(type = FieldType.Double)
        private Double allianceFragmentationScore;

        @JsonProperty("deterrence_signal_strength")
        @Field(type = FieldType.Double)
        private Double deterrenceSignalStrength;

        @JsonProperty("confidence_score")
        @Field(type = FieldType.Double)
        private Double confidenceScore;

        @JsonProperty("narrative")
        @Field(type = FieldType.Text)
        private String narrative;

        @JsonProperty("channel")
        @Field(type = FieldType.Keyword)
        private String channel;

        @JsonProperty("target_audience")
        @Field(type = FieldType.Keyword)
        private String targetAudience;

        @JsonProperty("hybrid_pressure_index")
        @Field(type = FieldType.Double)
        private Double hybridPressureIndex;

        @JsonProperty("escalation_probability_score")
        @Field(type = FieldType.Double)
        private Double escalationProbabilityScore;

        @JsonProperty("strategic_signaling_score")
        @Field(type = FieldType.Double)
        private Double strategicSignalingScore;

        @JsonProperty("cyber_geopolitical_coupling_index")
        @Field(type = FieldType.Double)
        private Double cyberGeopoliticalCouplingIndex;

        @JsonProperty("narrative_penetration_score")
        @Field(type = FieldType.Double)
        private Double narrativePenetrationScore;

        @JsonProperty("doctrine_capacity_divergence_score")
        @Field(type = FieldType.Double)
        private Double doctrineCapacityDivergenceScore;

        @JsonProperty("first_seen")
        @Field(type = FieldType.Date)
        private Instant firstSeen;

        @JsonProperty("last_seen")
        @Field(type = FieldType.Date)
        private Instant lastSeen;
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
