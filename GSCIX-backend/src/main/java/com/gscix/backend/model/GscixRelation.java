package com.gscix.backend.model;

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

    @Field(type = FieldType.Keyword)
    private String sourceRef;

    @Field(type = FieldType.Keyword)
    private String targetRef;

    @Field(type = FieldType.Keyword)
    private String relationshipType;

    @Field(type = FieldType.Text)
    private String description;

    @Field(type = FieldType.Date)
    private java.time.Instant startTime;

    @Field(type = FieldType.Date)
    private java.time.Instant stopTime;

    @Field(type = FieldType.Integer)
    private Integer confidence;
}
