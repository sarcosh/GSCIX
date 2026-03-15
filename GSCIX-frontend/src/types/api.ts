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

export interface ExternalReference {
    source_name: string;
    description?: string;
    url?: string;
    external_id?: string;
}

export interface GscixEntity {
    stixId: string;
    type: string;
    name: string;
    description?: string;
    first_seen?: string;
    last_seen?: string;
    aliases?: string[];
    goals?: string[];
    resource_level?: string;
    primary_motivation?: string;
    threat_actor_types?: string[];
    confidence?: number;
    external_references?: ExternalReference[];
    gsciAttributes?: GsciAttributes;
    metadata?: EntityMetadata;
}

export interface GscixRelation {
    id: string;
    type: string;
    source_ref: string;
    target_ref: string;
    relationship_type: string;
    confidence?: number;
}

export interface ValidationError {
    objectId: string;
    objectType: string;
    property?: string;
    error: string;
}

export interface ValidationWarning {
    objectType: string;
    name: string;
}

export interface ValidationResponse {
    status: 'OK' | 'ERROR' | 'WARNING';
    message: string;
    errors?: ValidationError[];
    warnings?: ValidationWarning[];
}

export interface IngestionJob {
    id: string;
    filename: string;
    status: 'OK' | 'WARNING' | 'ERROR';
    message: string;
    timestamp: string;
    entitiesCreated: number;
    relationsCreated: number;
}

export interface HpiTrendPoint {
    date: string;
    hpi: number;
    drift: number;
}

export interface HpiAnalytics {
    current_hpi: number;
    historical_avg: number;
    spike_detected: boolean;
    avg_confidence_score: number;
    pressure_breakdown: Record<string, number>;
    predominant_vector: string;
    trend_data: HpiTrendPoint[];
    max_divergence_score: number;
}

export interface InfluenceGraphData {
    entities: GscixEntity[];
    relations: GscixRelation[];
    rootId: string | null;
    depth: number;
    nodeCount: number;
    edgeCount: number;
}
