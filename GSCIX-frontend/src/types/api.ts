export interface GsciAttributes {
    strategic_alignment?: string;
    geopolitical_doctrine?: string;
    revisionist_index?: number;
    strategic_ambiguity_score?: number;
    doctrine_type?: string;
    technological_modernization_rate?: number;
    power_projection?: string;
    associated_agencies?: string;
    objective_type?: string;
    priority_level?: string;
    time_horizon?: string;
    civil_military_fusion?: boolean;
    phase?: string;
    integration_level?: string;
    geographic_scope?: string;
    escalation_risk_score?: number;
    velocity?: string;
    nature?: string[];
    political_destabilization_index?: number;
    economic_disruption_index?: number;
    alliance_fragmentation_score?: number;
    deterrence_signal_strength?: number;
    confidence_score?: number;
    narrative?: string;
    channel?: string;
    target_audience?: string;
    hybrid_pressure_index?: number;
    escalation_probability_score?: number;
    strategic_signaling_score?: number;
    cyber_geopolitical_coupling_index?: number;
    narrative_penetration_score?: number;
    doctrine_capacity_divergence_score?: number;
    first_seen?: string;
    last_seen?: string;
}

export interface EntityMetadata {
    createdAt?: string;
    updatedAt?: string;
    openctiInternalId?: string;
}

export interface GscixEntity {
    stixId: string;
    type: string;
    name: string;
    description?: string;
    gsciAttributes?: GsciAttributes;
    metadata?: EntityMetadata;
}

export interface GscixRelation {
    id: string;
    type: string;
    sourceRef: string;
    targetRef: string;
    relationship_type: string;
}
