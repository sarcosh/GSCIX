package com.gscix.backend.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.elasticsearch.annotations.Document;
import org.springframework.data.elasticsearch.annotations.Field;
import org.springframework.data.elasticsearch.annotations.FieldType;

@Data
@Document(indexName = "gscix_relations")
public class GscixRelation {
    @Id
    private String id;

    @Field(type = FieldType.Keyword)
    private java.util.List<String> extensions;

    @JsonProperty("source_ref")
    @Field(type = FieldType.Keyword)
    private String sourceRef;

    @JsonProperty("target_ref")
    @Field(type = FieldType.Keyword)
    private String targetRef;

    @JsonProperty("relationship_type")
    @Field(type = FieldType.Keyword)
    private String relationshipType;

    @Field(type = FieldType.Text)
    private String description;

    @JsonProperty("start_time")
    @Field(type = FieldType.Date)
    private java.time.Instant startTime;

    @JsonProperty("stop_time")
    @Field(type = FieldType.Date)
    private java.time.Instant stopTime;

    @Field(type = FieldType.Integer)
    private Integer confidence;
}
