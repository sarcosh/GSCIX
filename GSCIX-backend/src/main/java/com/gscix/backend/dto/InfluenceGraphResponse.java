package com.gscix.backend.dto;

import com.gscix.backend.model.GscixEntity;
import com.gscix.backend.model.GscixRelation;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InfluenceGraphResponse {
    private List<GscixEntity> entities;
    private List<GscixRelation> relations;
    private String rootId;
    private int depth;
    private int nodeCount;
    private int edgeCount;
}
