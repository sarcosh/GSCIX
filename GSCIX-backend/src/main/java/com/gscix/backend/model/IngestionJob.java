package com.gscix.backend.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.elasticsearch.annotations.Document;
import org.springframework.data.elasticsearch.annotations.Field;
import org.springframework.data.elasticsearch.annotations.FieldType;

import java.time.Instant;

@Data
@Document(indexName = "gscix_ingestion_jobs")
public class IngestionJob {
    @Id
    private String id;

    @Field(type = FieldType.Text)
    private String filename;

    @Field(type = FieldType.Keyword)
    private String status; // SUCCESS, WARNING, ERROR

    @Field(type = FieldType.Text)
    private String message;

    @Field(type = FieldType.Date)
    private Instant timestamp;

    @Field(type = FieldType.Integer)
    private int entitiesCreated;

    @Field(type = FieldType.Integer)
    private int relationsCreated;
}
