package com.gscix.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class HpiTrendPoint {
    private String date;
    private Double hpi;
    private Double drift;
}
