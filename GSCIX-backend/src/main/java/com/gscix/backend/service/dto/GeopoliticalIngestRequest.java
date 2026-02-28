package com.gscix.backend.service.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.List;

/**
 * DTO for the geopolitical ingestion endpoint.
 * Covers all 6 GSCIX custom schemas:
 * x-geo-strategic-actor, x-strategic-objective, x-hybrid-campaign,
 * x-influence-vector, x-strategic-impact, x-strategic-assessment.
 */
@Data
public class GeopoliticalIngestRequest {

    // --- x-geo-strategic-actor ---
    @JsonProperty("actor_name")
    private String actorName;

    @JsonProperty("strategic_alignment")
    private String strategicAlignment; // NATO, BRICS, EU, Non-Aligned, Other

    @JsonProperty("geopolitical_doctrine")
    private String geopoliticalDoctrine;

    @JsonProperty("geopolitical_context")
    private String geopoliticalContext;

    @JsonProperty("revisionist_index")
    private Double revisionistIndex;

    @JsonProperty("strategic_ambiguity_score")
    private Double strategicAmbiguityScore;

    @JsonProperty("doctrine_type")
    private String doctrineType; // Stability-Oriented, status-quo, revisionist, expansionist

    @JsonProperty("technological_modernization_rate")
    private Double technologicalModernizationRate;

    @JsonProperty("first_seen")
    private java.time.Instant firstSeen;

    @JsonProperty("last_seen")
    private java.time.Instant lastSeen;

    // --- x-strategic-objective (list) ---
    @JsonProperty("objectives")
    private List<ObjectiveDTO> objectives;

    // --- x-hybrid-campaign ---
    @JsonProperty("campaign")
    private CampaignDTO campaign;

    // --- x-influence-vector (list) ---
    @JsonProperty("influence_vectors")
    private List<InfluenceVectorDTO> influenceVectors;

    // --- x-strategic-impact ---
    @JsonProperty("impact")
    private ImpactDTO impact;

    // --- x-strategic-assessment ---
    @JsonProperty("assessment")
    private AssessmentDTO assessment;

    // --- Source metadata ---
    @JsonProperty("source_metadata")
    private SourceMetadataDTO sourceMetadata;

    // =========================================================================
    // Nested DTOs matching each custom schema
    // =========================================================================

    @Data
    public static class ObjectiveDTO {
        private String name;
        private String description;

        @JsonProperty("objective_type")
        private String objectiveType; // political, military, economic, societal

        @JsonProperty("priority_level")
        private String priorityLevel; // low, medium, high, critical

        @JsonProperty("time_horizon")
        private String timeHorizon; // short-term, medium-term, long-term, decadal

        @JsonProperty("civil_military_fusion")
        private Boolean civilMilitaryFusion;

        @JsonProperty("first_seen")
        private java.time.Instant firstSeen;

        @JsonProperty("last_seen")
        private java.time.Instant lastSeen;
    }

    @Data
    public static class CampaignDTO {
        private String name;
        private String description;
        private String phase; // pre-conflict, escalation, sustained-pressure

        @JsonProperty("integration_level")
        private String integrationLevel;

        @JsonProperty("geographic_scope")
        private String geographicScope;

        @JsonProperty("escalation_risk_score")
        private Double escalationRiskScore;

        private String velocity; // fast-spike, slow-drift
        private List<String> nature; // kinetic, cyber, infrastructural, cognitive, technological

        @JsonProperty("first_seen")
        private java.time.Instant firstSeen;

        @JsonProperty("last_seen")
        private java.time.Instant lastSeen;
    }

    @Data
    public static class InfluenceVectorDTO {
        private String name;
        private String description;
        private String narrative;
        private String channel;

        @JsonProperty("target_audience")
        private String targetAudience;
    }

    @Data
    public static class ImpactDTO {
        private String name;
        private String description;

        @JsonProperty("political_destabilization_index")
        private Double politicalDestabilizationIndex;

        @JsonProperty("economic_disruption_index")
        private Double economicDisruptionIndex;

        @JsonProperty("alliance_fragmentation_score")
        private Double allianceFragmentationScore;

        @JsonProperty("deterrence_signal_strength")
        private Double deterrenceSignalStrength;

        @JsonProperty("confidence_score")
        private Double confidenceScore;

        @JsonProperty("first_seen")
        private java.time.Instant firstSeen;

        @JsonProperty("last_seen")
        private java.time.Instant lastSeen;
    }

    @Data
    public static class AssessmentDTO {
        private String name;
        private String description;

        @JsonProperty("hybrid_pressure_index")
        private Double hybridPressureIndex;

        @JsonProperty("escalation_probability_score")
        private Double escalationProbabilityScore;

        @JsonProperty("strategic_signaling_score")
        private Double strategicSignalingScore;

        @JsonProperty("cyber_geopolitical_coupling_index")
        private Double cyberGeopoliticalCouplingIndex;

        @JsonProperty("narrative_penetration_score")
        private Double narrativePenetrationScore;

        @JsonProperty("doctrine_capacity_divergence_score")
        private Double doctrineCapacityDivergenceScore;

        @JsonProperty("first_seen")
        private java.time.Instant firstSeen;

        @JsonProperty("last_seen")
        private java.time.Instant lastSeen;
    }

    @Data
    public static class SourceMetadataDTO {
        private String tool;

        @JsonProperty("export_date")
        private String exportDate;
    }
}
