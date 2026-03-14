package com.gscix.backend.dto;

import java.util.List;
import java.util.Map;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class HpiAnalysisResponse {
    private Double current_hpi;
    private Double historical_avg;
    private Boolean spike_detected;
    private Double avg_confidence_score;
    private Map<String, Integer> pressure_breakdown;
    private String predominant_vector;
    private List<HpiTrendPoint> trend_data;
    private Double max_divergence_score;
}
