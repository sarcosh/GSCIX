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
        private String timeHorizon; // short-term, medium-term, long-term
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
    }

    @Data
    public static class SourceMetadataDTO {
        private String tool;

        @JsonProperty("export_date")
        private String exportDate;
    }
}
